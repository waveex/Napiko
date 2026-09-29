/**
 * Oznaczenie powiadomień jako przeczytane: wybranych albo wszystkich w aktywnym warsztacie.
 */
import { and, count, eq, inArray, isNull } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { notification } from '../../db/schema'
import { notificationReadSchema } from '../../../shared/notifications'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event)
  const input = await readValidatedBody(event, body => notificationReadSchema.parse(body))

  return withTenant(useDb(), ctx, async (tx) => {
    const mine = and(eq(notification.userId, ctx.userId), isNull(notification.readAt))
    await tx.update(notification).set({ readAt: new Date() })
      .where('ids' in input ? and(mine, inArray(notification.id, input.ids)) : mine)
    const [unread] = await tx.select({ n: count() }).from(notification)
      .where(and(eq(notification.userId, ctx.userId), isNull(notification.readAt)))
    return { unreadCount: unread?.n ?? 0 }
  })
})
