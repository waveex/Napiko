/**
 * Ręczna wysyłka do klienta: potwierdzenie przyjęcia pojazdu albo „gotowy do odbioru” (np. ponownie,
 * na inny kanał albo gdy automatyczne powiadomienia są wyłączone).
 */
import { withTenant } from '../../../db/tenant'
import { loadOrderSummary } from '../../../db/notifications'
import { queueOrderStatusNotification } from '../../../db/customer-notifications'
import { getEnv } from '../../../lib/env'
import { customerNotifySchema } from '../../../../shared/notifications'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { customerNotification: ['send'] })
  const id = await getIdParam(event)
  const input = await readValidatedBody(event, body => customerNotifySchema.parse(body))

  const result = await withTenant(useDb(), ctx, async (tx) => {
    const order = await loadOrderSummary(tx, id)
    if (!order) throw notFound('Nie znaleziono zlecenia.')
    if (order.status === 'cancelled') {
      throw createError({ statusCode: 409, message: 'Zlecenie jest anulowane – nie wysyłamy powiadomień.' })
    }
    const queued = await queueOrderStatusNotification(tx, getEnv(), {
      orgId: ctx.orgId,
      workOrderId: id,
      event: input.event,
      trigger: 'manual',
      actorUserId: ctx.userId,
      channels: { phone: input.phone, email: input.email },
      meta: requestMeta(event),
    })
    return { queued: queued.map(q => ({ status: q.status, via: q.via, skipReason: q.skipReason })) }
  })
  await deliverNotifications(event)
  const panel = await withTenant(useDb(), ctx, tx => loadCustomerNotificationPanel(tx, ctx, id))
  return { ...panel, queued: result.queued }
})
