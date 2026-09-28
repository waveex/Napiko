/**
 * Usunięcie pozycji z kosztorysu.
 */
import { eq } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { estimateItem, workOrder } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { billing: ['update'] })
  const id = await getIdParam(event)

  return withTenant(useDb(), ctx, async (tx) => {
    const [row] = await tx.select({ item: estimateItem, order: { id: workOrder.id, number: workOrder.number, status: workOrder.status } })
      .from(estimateItem)
      .innerJoin(workOrder, eq(workOrder.id, estimateItem.workOrderId))
      .where(eq(estimateItem.id, id))
      .limit(1)
    if (!row) throw notFound('Nie znaleziono pozycji kosztorysu.')
    assertOrderOpen(row.order.status)

    await tx.delete(estimateItem).where(eq(estimateItem.id, id))
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'estimate.item_removed',
      entityType: 'work_order',
      entityId: row.order.id,
      data: { number: row.order.number, itemId: id, name: row.item.name, unitPriceNet: row.item.unitPriceNet, quantity: row.item.quantity },
      ...requestMeta(event),
    })
    return loadWorkOrderDetail(tx, ctx, row.order.id)
  })
})
