/**
 * Próbne powiadomienie push na wszystkie moje urządzenia („czy to działa na tym telefonie?”).
 */
import { count, eq } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { enqueueJob } from '../../db/jobs'
import { pushSubscription } from '../../db/schema'
import type { TeamNotificationJob } from '../../db/notifications'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event)
  if (!usePush().enabled) throw createError({ statusCode: 409, message: 'Powiadomienia push nie są skonfigurowane na serwerze.' })
  const devices = await withTenant(useDb(), ctx, async (tx) => {
    const [row] = await tx.select({ n: count() }).from(pushSubscription).where(eq(pushSubscription.userId, ctx.userId))
    if (row?.n) {
      const payload: TeamNotificationJob = {
        orgId: ctx.orgId,
        userId: ctx.userId,
        notificationId: '',
        title: 'OXY: powiadomienia działają',
        body: 'Tak będą wyglądać powiadomienia o nowych zadaniach i odpowiedziach klientów.',
        url: '/app/notifications',
        tag: 'oxy-test',
        lang: 'pl',
      }
      await enqueueJob(tx, { type: 'push.send', orgId: ctx.orgId, payload: { ...payload }, maxAttempts: 2 })
    }
    return row?.n ?? 0
  })
  if (devices) await deliverNotifications(event)
  return { devices }
})
