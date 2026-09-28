/**
 * Zmiana pozycji kosztorysu (ilość, cena, rabat, VAT, nazwa). Wysłana wcześniej wersja zostaje
 * w prośbie o akceptację jako dowód – kosztorys oznaczamy wtedy jako zmieniony od wysyłki.
 */
import { eq } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { estimateItem, workOrder } from '../../db/schema'
import { estimateItemUpdateSchema } from '../../../shared/schemas'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { billing: ['update'] })
  const id = await getIdParam(event)
  const input = await readValidatedBody(event, body => estimateItemUpdateSchema.parse(body))

  return withTenant(useDb(), ctx, async (tx) => {
    const [row] = await tx.select({ item: estimateItem, order: { id: workOrder.id, number: workOrder.number, status: workOrder.status } })
      .from(estimateItem)
      .innerJoin(workOrder, eq(workOrder.id, estimateItem.workOrderId))
      .where(eq(estimateItem.id, id))
      .limit(1)
    if (!row) throw notFound('Nie znaleziono pozycji kosztorysu.')
    assertOrderOpen(row.order.status)

    const values: Partial<typeof estimateItem.$inferInsert> = {}
    if (input.kind !== undefined) values.kind = input.kind
    if (input.name !== undefined) values.name = input.name
    if (input.unit !== undefined) values.unit = input.unit
    if (input.quantity !== undefined) values.quantity = input.quantity.toFixed(3)
    if (input.unitPriceNet !== undefined) values.unitPriceNet = input.unitPriceNet.toFixed(2)
    if (input.discountPercent !== undefined) values.discountPercent = input.discountPercent.toFixed(2)
    if (input.vatRate !== undefined) values.vatRate = input.vatRate.toFixed(2)

    const changed = (Object.keys(values) as (keyof typeof values)[])
      .filter(key => String(values[key]) !== String(row.item[key as keyof typeof row.item]))
    if (changed.length) {
      await tx.update(estimateItem).set(values).where(eq(estimateItem.id, id))
      await recordAudit(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'estimate.item_updated',
        entityType: 'work_order',
        entityId: row.order.id,
        data: {
          number: row.order.number,
          itemId: id,
          name: values.name ?? row.item.name,
          changed: Object.fromEntries(changed.map(key => [key, { from: row.item[key as keyof typeof row.item], to: values[key] }])),
        },
        ...requestMeta(event),
      })
    }
    return loadWorkOrderDetail(tx, ctx, row.order.id)
  })
})
