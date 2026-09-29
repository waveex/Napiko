/**
 * Zmiana kanałów (e-mail, push) dla jednego typu powiadomień – tylko własnych ustawień (RLS).
 */
import { withTenant } from '../../db/tenant'
import { notificationPreference } from '../../db/schema'
import { isTeamNotificationFor, notificationPreferenceSchema } from '../../../shared/notifications'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event)
  const input = await readValidatedBody(event, body => notificationPreferenceSchema.parse(body))
  if (!isTeamNotificationFor(input.type, ctx.role)) {
    throw createError({ statusCode: 422, message: 'Ten typ powiadomień nie dotyczy Twojej roli.' })
  }
  await withTenant(useDb(), ctx, tx => tx.insert(notificationPreference)
    .values({ orgId: ctx.orgId, userId: ctx.userId, type: input.type, email: input.email, push: input.push })
    .onConflictDoUpdate({
      target: [notificationPreference.orgId, notificationPreference.userId, notificationPreference.type],
      set: { email: input.email, push: input.push },
    }))
  return input
})
