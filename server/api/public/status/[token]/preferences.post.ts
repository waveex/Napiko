/**
 * Klient na stronie statusu naprawy włącza albo wyłącza wiadomości o naprawie (SMS, e-mail).
 * Dotyczy wszystkich zleceń tego klienta w warsztacie; zmiana trafia do dziennika zdarzeń.
 * Prośby o akceptację wysyła biuro świadomie na wskazany numer / adres – rezygnacja ich nie blokuje.
 */
import { eq } from 'drizzle-orm'
import { withCustomerLink } from '../../../../db/tenant'
import { recordAudit } from '../../../../db/audit'
import { customer } from '../../../../db/schema'
import { statusPreferencesSchema, statusTokenSchema } from '../../../../../shared/notifications'

export default defineEventHandler(async (event) => {
  const { token } = await getValidatedRouterParams(event, params => statusTokenSchema.parse(params))
  const input = await readValidatedBody(event, body => statusPreferencesSchema.parse(body))
  const meta = requestMeta(event)

  const target = await findStatusTarget(token)
  if (await isOrganizationMember(event, target.orgId)) {
    throw createError({ statusCode: 403, message: 'To podgląd warsztatu – zgody klienta zmień w karcie klienta.' })
  }

  return withCustomerLink(useDb(), target.orgId, async (tx) => {
    const values: Partial<typeof customer.$inferInsert> = {}
    if (input.sms !== undefined) values.notifySms = input.sms
    if (input.email !== undefined) values.notifyEmail = input.email
    const [row] = await tx.update(customer).set(values).where(eq(customer.id, target.customerId))
      .returning({ notifySms: customer.notifySms, notifyEmail: customer.notifyEmail })
    await recordAudit(tx, {
      orgId: target.orgId,
      action: 'customer.notifications_changed',
      entityType: 'customer',
      entityId: target.customerId,
      data: { number: target.number, via: 'status_page', ...input },
      ...meta,
    })
    return { sms: row!.notifySms, email: row!.notifyEmail }
  })
})
