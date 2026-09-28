/**
 * Wycofanie prośby o akceptację (np. zmiana wyceny albo klient zdecydował telefonicznie).
 * Link przestaje działać – klient zobaczy informację, że warsztat wycofał prośbę.
 */
import { and, eq } from 'drizzle-orm'
import { withTenant } from '../../../db/tenant'
import { recordAudit } from '../../../db/audit'
import { approvalRequest, workOrder } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { workRequest: ['decide'] })
  const id = await getIdParam(event)

  return withTenant(useDb(), ctx, async (tx) => {
    // Kosztorys wycofuje osoba z dostępem do rozliczeń, prośbę o prace dodatkowe – osoba decydująca o zgłoszeniach
    const [target] = await tx.select({ kind: approvalRequest.kind }).from(approvalRequest).where(eq(approvalRequest.id, id)).limit(1)
    if (target?.kind === 'estimate') assertCan(ctx, { billing: ['update'] })
    const [approval] = await tx
      .update(approvalRequest)
      .set({ status: 'cancelled' })
      .where(and(eq(approvalRequest.id, id), eq(approvalRequest.status, 'pending')))
      .returning({ id: approvalRequest.id, workOrderId: approvalRequest.workOrderId, kind: approvalRequest.kind })
    if (!approval) throw createError({ statusCode: 409, message: 'Tej prośby nie można już wycofać.' })
    const [order] = await tx.select({ id: workOrder.id, number: workOrder.number, status: workOrder.status })
      .from(workOrder).where(eq(workOrder.id, approval.workOrderId)).limit(1)
    const meta = requestMeta(event)
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'approval.cancelled',
      entityType: 'approval',
      entityId: id,
      data: { number: order?.number, kind: approval.kind },
      ...meta,
    })
    // Nic więcej nie czeka na klienta → zlecenie wraca do realizacji
    if (order) await resumeOrderIfNoPendingApprovals(tx, ctx.orgId, ctx.userId, order, meta)
    return { ok: true }
  })
})
