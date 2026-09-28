/**
 * Obsługa zgłoszenia przez biuro:
 *  - quote: wycena (części + robocizna netto, stawka VAT),
 *  - decide: decyzja zapisana przez biuro (np. klient zgodził się telefonicznie) – akceptacja
 *    pracy dodatkowej tworzy nowe zadanie w zleceniu,
 *  - status: zamówione / gotowe / anulowane.
 * Zadanie wstrzymane w oczekiwaniu na część lub decyzję wraca do mechanika jako „wstrzymane”.
 */
import { eq, sql } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { workOrder, workRequest } from '../../db/schema'
import { workRequestActionSchema } from '../../../shared/schemas'
import { grossCents, type WorkRequestStatus } from '../../../shared/workshop'

const STATUS_FROM: Record<'ordered' | 'done' | 'cancelled', WorkRequestStatus[]> = {
  ordered: ['open', 'quoted', 'approved'],
  done: ['approved', 'ordered'],
  cancelled: ['open', 'quoted', 'approved', 'ordered'],
}

function conflict(message: string) {
  return createError({ statusCode: 409, statusMessage: 'Conflict', message })
}

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { workRequest: ['read'] })
  const id = await getIdParam(event)
  const input = await readValidatedBody(event, body => workRequestActionSchema.parse(body))
  const meta = requestMeta(event)

  return withTenant(useDb(), ctx, async (tx) => {
    const [request] = await tx.select().from(workRequest).where(eq(workRequest.id, id)).limit(1)
    if (!request) throw notFound('Nie znaleziono zgłoszenia.')
    const [order] = await tx.select({ id: workOrder.id, number: workOrder.number, status: workOrder.status })
      .from(workOrder).where(eq(workOrder.id, request.workOrderId)).limit(1)
    assertOrderOpen(order!.status)
    const audit = (action: string, data: Record<string, unknown>) => recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action,
      entityType: 'work_request',
      entityId: id,
      data: { number: order!.number, title: request.title, ...data },
      ...meta,
    })

    /** Zadanie czekające na tę część wraca do mechanika. */
    async function releaseHeldTask(waitingFor: 'waiting_parts') {
      if (!request!.taskId) return
      const related = await loadTaskWithOrder(tx, request!.taskId)
      if (related.task.status === waitingFor) {
        await applyTaskStatus(tx, ctx, related.task, related.order, 'paused', meta)
      }
    }

    if (input.action === 'quote') {
      assertCan(ctx, { workRequest: ['quote'] })
      if (request.status !== 'open' && request.status !== 'quoted') {
        throw conflict('Zgłoszenie ma już decyzję – wyceny nie można zmienić.')
      }
      await tx.update(workRequest).set({
        partsNet: input.partsNet === null ? null : input.partsNet.toFixed(2),
        laborNet: input.laborNet === null ? null : input.laborNet.toFixed(2),
        vatRate: input.vatRate.toFixed(2),
        officeNote: input.officeNote,
        status: 'quoted',
        quotedBy: ctx.userId,
        quotedAt: sql`now()`,
      }).where(eq(workRequest.id, id))
      await audit('work_request.quoted', { grossCents: grossCents(input.partsNet, input.laborNet, input.vatRate) })
    }
    else if (input.action === 'decide') {
      assertCan(ctx, { workRequest: ['decide'] })
      if (request.status !== 'open' && request.status !== 'quoted') {
        throw conflict('Decyzja w tym zgłoszeniu już zapadła.')
      }
      // Konsument musi znać cenę prac dodatkowych, zanim się na nie zgodzi.
      if (input.decision === 'approved' && request.kind === 'extra_work' && request.status !== 'quoted') {
        throw conflict('Najpierw wyceń pracę dodatkową – klient musi znać jej koszt.')
      }
      await decideWorkRequest(tx, ctx, request, order!, input.decision, { note: input.decisionNote, via: 'office' }, meta)
    }
    else {
      assertCan(ctx, { workRequest: ['quote'] })
      if (!STATUS_FROM[input.status].includes(request.status)) {
        throw conflict('Tej zmiany statusu nie można wykonać na tym etapie zgłoszenia.')
      }
      if (input.status === 'ordered' && request.kind === 'extra_work') {
        throw conflict('Zamówienie dotyczy części – pracę dodatkową zatwierdza się decyzją.')
      }
      await tx.update(workRequest).set({ status: input.status }).where(eq(workRequest.id, id))
      await audit('work_request.status_changed', { from: request.status, to: input.status })
      if (input.status === 'done' && request.kind === 'part') await releaseHeldTask('waiting_parts')
    }

    const [updated] = await tx.select().from(workRequest).where(eq(workRequest.id, id)).limit(1)
    return maskRequestPrices(updated!, can(ctx, { workRequest: ['quote'] }))
  })
})
