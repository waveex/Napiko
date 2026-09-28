/**
 * Nowa pozycja kosztorysu: z cennika (usługa o cenie stałej albo norma czasu × stawka roboczogodziny)
 * albo wpisana ręcznie (część, robocizna, inne).
 */
import { and, eq, isNull } from 'drizzle-orm'
import { withTenant } from '../../../db/tenant'
import { recordAudit } from '../../../db/audit'
import { estimateItem, servicePrice, workOrder } from '../../../db/schema'
import { estimateItemCreateSchema } from '../../../../shared/schemas'
import { multiplyDecimals } from '../../../../shared/workshop'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { billing: ['update'] })
  const workOrderId = await getIdParam(event)
  const input = await readValidatedBody(event, body => estimateItemCreateSchema.parse(body))

  return withTenant(useDb(), ctx, async (tx) => {
    const [order] = await tx.select({ id: workOrder.id, number: workOrder.number, status: workOrder.status })
      .from(workOrder).where(eq(workOrder.id, workOrderId)).limit(1)
    if (!order) throw notFound('Nie znaleziono zlecenia.')
    assertOrderOpen(order.status)

    let values: Omit<typeof estimateItem.$inferInsert, 'orgId' | 'workOrderId' | 'position'>
    if (input.source === 'price_list') {
      const [service] = await tx.select().from(servicePrice)
        .where(and(eq(servicePrice.id, input.servicePriceId), isNull(servicePrice.archivedAt)))
        .limit(1)
      if (!service) throw createError({ statusCode: 422, message: 'Tej usługi nie ma już w cenniku.' })
      if (service.pricing === 'hourly') {
        const profile = await loadCompanyProfile(tx, ctx.orgId)
        if (profile.laborRateNet === null) {
          throw createError({ statusCode: 422, message: 'Ustaw stawkę roboczogodziny w danych firmy (Ustawienia), aby liczyć usługi z normy czasu.' })
        }
        values = {
          kind: 'labor',
          name: service.name,
          quantity: multiplyDecimals(service.laborHours!, input.count, 3),
          unit: 'h',
          unitPriceNet: profile.laborRateNet,
          vatRate: service.vatRate,
          source: 'price_list',
          servicePriceId: service.id,
        }
      }
      else {
        values = {
          kind: 'labor',
          name: service.name,
          quantity: input.count.toFixed(3),
          unit: 'usł.',
          unitPriceNet: service.priceNet!,
          vatRate: service.vatRate,
          source: 'price_list',
          servicePriceId: service.id,
        }
      }
    }
    else {
      values = {
        kind: input.kind,
        name: input.name,
        quantity: input.quantity.toFixed(3),
        unit: input.unit,
        unitPriceNet: input.unitPriceNet.toFixed(2),
        discountPercent: input.discountPercent.toFixed(2),
        vatRate: input.vatRate.toFixed(2),
        source: 'manual',
      }
    }

    const [created] = await tx.insert(estimateItem).values({
      ...values,
      orgId: ctx.orgId,
      workOrderId,
      position: await nextEstimatePosition(tx, workOrderId),
      createdBy: ctx.userId,
    }).returning({ id: estimateItem.id })

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'estimate.item_added',
      entityType: 'work_order',
      entityId: workOrderId,
      data: { number: order.number, itemId: created!.id, name: values.name, source: values.source },
      ...requestMeta(event),
    })
    return loadWorkOrderDetail(tx, ctx, workOrderId)
  })
})
