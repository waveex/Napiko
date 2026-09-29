/**
 * Rezygnacja z e-maili o naprawie jednym kliknięciem (nagłówek List-Unsubscribe-Post, RFC 8058):
 * program pocztowy wysyła POST bez logowania i bez dodatkowego potwierdzenia.
 */
import { eq } from 'drizzle-orm'
import { withSystem } from '../../../../db/tenant'
import { recordAudit } from '../../../../db/audit'
import { customer } from '../../../../db/schema'
import { statusTokenSchema } from '../../../../../shared/notifications'

export default defineEventHandler(async (event) => {
  const { token } = await getValidatedRouterParams(event, params => statusTokenSchema.parse(params))
  const target = await findStatusTarget(token)
  await withSystem(useDb(), async (tx) => {
    await tx.update(customer).set({ notifyEmail: false }).where(eq(customer.id, target.customerId))
    await recordAudit(tx, {
      orgId: target.orgId,
      action: 'customer.notifications_changed',
      entityType: 'customer',
      entityId: target.customerId,
      data: { number: target.number, via: 'email_unsubscribe', email: false },
      ...requestMeta(event),
    })
  })
  return { ok: true, email: false }
})
