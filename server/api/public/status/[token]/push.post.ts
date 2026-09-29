/**
 * „Powiadamiaj mnie w tym telefonie”: klient włącza (albo wyłącza) powiadomienia push na stronie statusu naprawy.
 * Subskrypcja trafia do karty klienta razem z jego numerem telefonu – kolejne wiadomości
 * (gotowy do odbioru, prośby o akceptację) przychodzą pushem zamiast SMS-em.
 */
import { z } from 'zod'
import { withSystem } from '../../../../db/tenant'
import { recordAudit } from '../../../../db/audit'
import { registerCustomerPush, revokeCustomerPush } from '../../../../db/customer-notifications'
import { pushSubscriptionSchema, statusTokenSchema } from '../../../../../shared/notifications'

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('subscribe'), subscription: pushSubscriptionSchema }),
  z.object({ action: z.literal('unsubscribe'), endpoint: z.url().max(1000) }),
])

export default defineEventHandler(async (event) => {
  const { token } = await getValidatedRouterParams(event, params => statusTokenSchema.parse(params))
  const input = await readValidatedBody(event, body => bodySchema.parse(body))
  if (input.action === 'subscribe' && !usePush().enabled) {
    throw createError({ statusCode: 409, message: 'Powiadomienia w telefonie są chwilowo niedostępne.' })
  }
  const meta = requestMeta(event)

  const target = await findStatusTarget(token)
  if (await isOrganizationMember(event, target.orgId)) {
    throw createError({ statusCode: 403, message: 'To podgląd warsztatu – powiadomienia włącza klient na swoim telefonie.' })
  }

  await withSystem(useDb(), async (tx) => {
    if (input.action === 'subscribe') {
      await registerCustomerPush(tx, {
        orgId: target.orgId,
        customerId: target.customerId,
        phone: target.phone,
        endpoint: input.subscription.endpoint,
        p256dh: input.subscription.keys.p256dh,
        auth: input.subscription.keys.auth,
        userAgent: meta.userAgent,
      })
    }
    else {
      await revokeCustomerPush(tx, { customerId: target.customerId, endpoint: input.endpoint })
    }
    await recordAudit(tx, {
      orgId: target.orgId,
      action: input.action === 'subscribe' ? 'customer.push_enabled' : 'customer.push_disabled',
      entityType: 'customer',
      entityId: target.customerId,
      data: { number: target.number, via: 'status_page' },
      ...meta,
    })
  })
  return { ok: true, enabled: input.action === 'subscribe' }
})
