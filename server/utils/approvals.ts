/**
 * Akceptacje klienta: tokeny linków (w bazie tylko skrót), adresy i skrót treści pokazanej klientowi.
 */
import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { and, eq, gt, sql } from 'drizzle-orm'
import { getEnv } from '../lib/env'
import type { Tx } from '../db/client'
import { recordAudit } from '../db/audit'
import { approvalRequest, member, workOrder } from '../db/schema'

/** 192 bity losowości – linku nie da się odgadnąć; w bazie zapisujemy tylko skrót. */
export function generateApprovalToken() {
  return randomBytes(24).toString('base64url')
}

export function hashApprovalToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function approvalUrl(token: string) {
  return `${getEnv().appUrl}/approve/${token}`
}

/** Skrót treści – pozwala później wykazać, co dokładnie klient zobaczył i zatwierdził. */
export function hashSnapshot(snapshot: unknown) {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
}

/**
 * Czy link otwiera ktoś z zespołu warsztatu (podgląd) – wtedy nie oznaczamy prośby jako otwartej
 * przez klienta i nie pozwalamy odpowiedzieć w jego imieniu.
 */
export async function isOrganizationMember(event: H3Event, orgId: string) {
  try {
    const session = await useAuth().api.getSession({ headers: event.headers })
    if (!session) return false
    const [row] = await useDb().select({ id: member.id }).from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, session.user.id)))
      .limit(1)
    return !!row
  }
  catch {
    return false
  }
}

/**
 * Gdy nic już nie czeka na klienta, zlecenie „czeka na akceptację” wraca do realizacji
 * (po odpowiedzi klienta albo po wycofaniu prośby przez warsztat).
 */
export async function resumeOrderIfNoPendingApprovals(
  tx: Tx,
  orgId: string,
  actorUserId: string | null,
  order: { id: string, number: string, status: string },
  meta: { ip: string | null, userAgent: string | null },
) {
  if (order.status !== 'waiting_approval') return
  const [stillPending] = await tx.select({ id: approvalRequest.id }).from(approvalRequest)
    .where(and(eq(approvalRequest.workOrderId, order.id), eq(approvalRequest.status, 'pending'), gt(approvalRequest.expiresAt, sql`now()`)))
    .limit(1)
  if (stillPending) return
  await tx.update(workOrder).set({ status: 'in_progress' }).where(eq(workOrder.id, order.id))
  await recordAudit(tx, {
    orgId,
    actorUserId,
    action: 'work_order.status_changed',
    entityType: 'work_order',
    entityId: order.id,
    data: { number: order.number, from: 'waiting_approval', to: 'in_progress', automatic: true },
    ...meta,
  })
}
