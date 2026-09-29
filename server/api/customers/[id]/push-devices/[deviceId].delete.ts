/**
 * Wyłączenie powiadomień push na telefonie klienta (np. klient zmienił telefon albo prosi o SMS-y).
 */
import { z } from 'zod'
import { withTenant } from '../../../../db/tenant'
import { recordAudit } from '../../../../db/audit'
import { revokeCustomerPush } from '../../../../db/customer-notifications'

const paramsSchema = z.object({ id: z.uuid(), deviceId: z.uuid() })

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { customer: ['update'], customerContact: ['read'] })
  const { id, deviceId } = await getValidatedRouterParams(event, params => paramsSchema.parse(params))

  return withTenant(useDb(), ctx, async (tx) => {
    const revoked = await revokeCustomerPush(tx, { customerId: id, id: deviceId })
    if (!revoked.length) throw notFound('Nie znaleziono urządzenia.')
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'customer.push_disabled',
      entityType: 'customer',
      entityId: id,
      data: { via: 'office' },
      ...requestMeta(event),
    })
    return { ok: true }
  })
})
