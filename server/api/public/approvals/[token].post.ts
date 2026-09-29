/**
 * Odpowiedź klienta na prośbę o akceptację – prace dodatkowe (decyzja przy każdej pozycji)
 * albo kosztorys (jedna decyzja o całości). Zapisujemy decyzję, czas, adres IP i przeglądarkę
 * oraz skrót treści, którą klient zobaczył – to dowód zgody (forma dokumentowa).
 * Osoba, która wysłała prośbę, dostaje powiadomienie (dzwonek, push, e-mail – według jej ustawień),
 * a mechanik, który zgłosił pracę – informację o decyzji.
 */
import { and, eq, inArray } from 'drizzle-orm'
import type { Tx } from '../../../db/client'
import { withSystem } from '../../../db/tenant'
import { recordAudit } from '../../../db/audit'
import { loadOrderSummary, notifyApprovalOutcome } from '../../../db/notifications'
import {
  approvalItem, approvalRequest, isEstimateSnapshot, workOrder, workRequest,
  type ApprovalSnapshot, type EstimateSnapshot,
} from '../../../db/schema'
import { approvalAnswerSchema, approvalTokenSchema, estimateAnswerSchema } from '../../../../shared/schemas'
import type { WorkOrderStatus } from '../../../../shared/workshop'

type Approval = typeof approvalRequest.$inferSelect
type Meta = ReturnType<typeof requestMeta>

function invalidBody(issues: unknown) {
  return createError({ statusCode: 400, statusMessage: 'Validation Error', message: 'Nieprawidłowe dane odpowiedzi.', data: issues })
}

export default defineEventHandler(async (event) => {
  const { token } = await getValidatedRouterParams(event, params => approvalTokenSchema.parse(params))
  const body = await readBody(event)
  const meta = requestMeta(event)

  await withSystem(useDb(), async (tx) => {
    // Blokada wiersza – dwa równoległe wysłania formularza nie zapiszą dwóch odpowiedzi
    const [approval] = await tx.select().from(approvalRequest)
      .where(eq(approvalRequest.tokenHash, hashApprovalToken(token)))
      .limit(1)
      .for('update')
    if (!approval) throw createError({ statusCode: 404, message: 'Link jest nieprawidłowy albo został usunięty.' })
    if (approval.status === 'answered') throw createError({ statusCode: 409, message: 'Odpowiedź została już wysłana.' })
    if (approval.status === 'cancelled') throw createError({ statusCode: 409, message: 'Warsztat wycofał tę prośbę.' })
    if (approval.expiresAt.getTime() < Date.now()) {
      throw createError({ statusCode: 410, message: 'Link wygasł. Skontaktuj się z warsztatem.' })
    }
    // Zgodę wyraża klient – zespół warsztatu zapisuje decyzję w zleceniu (np. „zgoda telefoniczna”)
    if (await isOrganizationMember(event, approval.orgId)) {
      throw createError({ statusCode: 403, message: 'To podgląd warsztatu. Decyzję klienta zapisz w karcie zlecenia.' })
    }

    const [order] = await tx.select({ id: workOrder.id, number: workOrder.number, status: workOrder.status })
      .from(workOrder).where(eq(workOrder.id, approval.workOrderId)).limit(1)

    if (isEstimateSnapshot(approval.snapshot)) {
      const parsed = estimateAnswerSchema.safeParse(body)
      if (!parsed.success) throw invalidBody(parsed.error.issues)
      await answerEstimate(tx, approval, approval.snapshot, order!, parsed.data, meta)
    }
    else {
      const parsed = approvalAnswerSchema.safeParse(body)
      if (!parsed.success) throw invalidBody(parsed.error.issues)
      await answerWorkRequests(tx, approval, approval.snapshot, order!, parsed.data, meta)
    }

    // Nic więcej nie czeka na klienta → zlecenie wraca do realizacji
    await resumeOrderIfNoPendingApprovals(tx, approval.orgId, null, order!, meta)
  })

  await deliverNotifications(event)
  return { ok: true }
})

type Order = { id: string, number: string, status: WorkOrderStatus }

async function answerWorkRequests(
  tx: Tx,
  approval: Approval,
  snapshot: ApprovalSnapshot,
  order: Order,
  input: { decisions: { requestId: string, decision: 'approved' | 'rejected' }[], note: string | null, consent: boolean },
  meta: Meta,
) {
  const expected = snapshot.items.map(item => item.requestId)
  const given = new Map(input.decisions.map(d => [d.requestId, d.decision]))
  if (given.size !== expected.length || !expected.every(id => given.has(id))) {
    throw createError({ statusCode: 422, message: 'Zdecyduj o każdej pozycji.' })
  }
  const approvedIds = expected.filter(id => given.get(id) === 'approved')
  if (approvedIds.length && !input.consent) {
    throw createError({ statusCode: 422, message: 'Potwierdź zgodę na koszt zatwierdzonych prac.' })
  }

  for (const id of expected) {
    await tx.update(approvalItem).set({ decision: given.get(id)! })
      .where(and(eq(approvalItem.approvalId, approval.id), eq(approvalItem.workRequestId, id)))
  }
  await tx.update(approvalRequest).set({
    status: 'answered',
    answeredAt: new Date(),
    answerIp: meta.ip,
    answerUserAgent: meta.userAgent?.slice(0, 500) ?? null,
    customerNote: input.note,
  }).where(eq(approvalRequest.id, approval.id))

  const actor = { orgId: approval.orgId, userId: null }
  const requests = await tx.select().from(workRequest).where(inArray(workRequest.id, expected))
  for (const request of requests) {
    // Jeśli biuro zdecydowało w międzyczasie (np. telefonicznie), zostawiamy jego decyzję
    if (request.status !== 'quoted') continue
    await decideWorkRequest(tx, actor, request, order, given.get(request.id)!, {
      note: `Decyzja klienta przez link (${new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })})`,
      via: 'customer',
      approvalId: approval.id,
    }, meta)
  }

  await recordAudit(tx, {
    orgId: approval.orgId,
    action: 'approval.answered',
    entityType: 'approval',
    entityId: approval.id,
    data: {
      number: order.number,
      approved: approvedIds.length,
      rejected: expected.length - approvedIds.length,
      consent: input.consent,
      snapshotHash: approval.snapshotHash,
    },
    ...meta,
  })

  await notifyOutcome(tx, approval, order, {
    approved: approvedIds.length,
    rejected: expected.length - approvedIds.length,
    note: input.note ?? undefined,
  })
}

async function answerEstimate(
  tx: Tx,
  approval: Approval,
  snapshot: EstimateSnapshot,
  order: Order,
  input: { decision: 'approved' | 'rejected', note: string | null, consent: boolean },
  meta: Meta,
) {
  if (input.decision === 'approved' && !input.consent) {
    throw createError({ statusCode: 422, message: 'Potwierdź akceptację kosztorysu i jego kwoty.' })
  }
  await tx.update(approvalRequest).set({
    status: 'answered',
    decision: input.decision,
    answeredAt: new Date(),
    answerIp: meta.ip,
    answerUserAgent: meta.userAgent?.slice(0, 500) ?? null,
    customerNote: input.note,
  }).where(eq(approvalRequest.id, approval.id))

  await recordAudit(tx, {
    orgId: approval.orgId,
    action: 'approval.answered',
    entityType: 'approval',
    entityId: approval.id,
    data: {
      number: order.number,
      kind: 'estimate',
      decision: input.decision,
      totalGrossCents: snapshot.totalGrossCents,
      consent: input.consent,
      estimateHash: snapshot.estimateHash,
      snapshotHash: approval.snapshotHash,
    },
    ...meta,
  })

  await notifyOutcome(tx, approval, order, {
    decision: input.decision,
    total: formatPln(snapshot.totalGrossCents),
    note: input.note ?? undefined,
  })
}

/** Powiadomienie dla osoby, która wysłała prośbę (a gdy odeszła z zespołu – dla biura). */
async function notifyOutcome(tx: Tx, approval: Approval, order: Order, data: Record<string, string | number | undefined>) {
  const summary = await loadOrderSummary(tx, order.id)
  if (!summary) return
  await notifyApprovalOutcome(tx, 'approval.answered', approval, summary, data)
}
