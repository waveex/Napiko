/**
 * Moje ustawienia powiadomień w aktywnym warsztacie: typy zdarzeń, które dotyczą mojej roli,
 * z kanałami e-mail i push (dzwonek w aplikacji jest zawsze), stan push na serwerze i liczba moich urządzeń.
 */
import { and, count, eq } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { notificationPreference, pushSubscription } from '../../db/schema'
import { isTeamNotificationFor, TEAM_NOTIFICATION_TYPES, TEAM_NOTIFICATIONS } from '../../../shared/notifications'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event)
  const session = await requireSession(event)
  const prefs = await withTenant(useDb(), ctx, tx => tx.select().from(notificationPreference)
    .where(and(eq(notificationPreference.orgId, ctx.orgId), eq(notificationPreference.userId, ctx.userId))))
  // urządzenia należą do osoby (bez warsztatu) – polityka push_subscription przepuszcza tylko moje
  const [devices] = await withTenant(useDb(), ctx, tx => tx.select({ n: count() }).from(pushSubscription)
    .where(eq(pushSubscription.userId, ctx.userId)))
  const push = usePush()
  return {
    types: TEAM_NOTIFICATION_TYPES
      .filter(type => isTeamNotificationFor(type, ctx.role))
      .map((type) => {
        const info = TEAM_NOTIFICATIONS[type]
        const pref = prefs.find(p => p.type === type)
        return {
          type,
          key: info.key,
          icon: info.icon,
          email: pref?.email ?? info.defaults.email,
          push: pref?.push ?? info.defaults.push,
          defaults: info.defaults,
        }
      }),
    email: session.user.email,
    emailVerified: session.user.emailVerified,
    push: { enabled: push.enabled, publicKey: push.publicKey, devices: devices?.n ?? 0 },
  }
})
