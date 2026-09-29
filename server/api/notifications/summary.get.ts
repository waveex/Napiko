/**
 * Licznik w dzwonku (odpytywany co ~30 s): nieprzeczytane w aktywnym warsztacie, nowe od ostatniego sprawdzenia
 * (do powiadomień „w locie”) i nieprzeczytane w innych warsztatach tej samej osoby.
 */
import { and, count, desc, eq, gt, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { withTenant } from '../../db/tenant'
import { notification, user } from '../../db/schema'
import { unreadElsewhere } from '../../db/notifications'

const querySchema = z.object({ since: z.iso.datetime().optional() })

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event)
  const { since } = await getValidatedQuery(event, q => querySchema.parse(q))

  const result = await withTenant(useDb(), ctx, async (tx) => {
    const [unread] = await tx.select({ n: count() }).from(notification)
      .where(and(eq(notification.userId, ctx.userId), isNull(notification.readAt)))
    const [latest] = await tx.select({ createdAt: notification.createdAt }).from(notification)
      .where(eq(notification.userId, ctx.userId))
      .orderBy(desc(notification.createdAt))
      .limit(1)
    const fresh = since
      ? await tx
          .select({
            id: notification.id,
            type: notification.type,
            data: notification.data,
            link: notification.link,
            workOrderId: notification.workOrderId,
            readAt: notification.readAt,
            createdAt: notification.createdAt,
            actorName: user.name,
          })
          .from(notification)
          .leftJoin(user, eq(user.id, notification.actorUserId))
          .where(and(eq(notification.userId, ctx.userId), gt(notification.createdAt, new Date(since)), isNull(notification.readAt)))
          .orderBy(desc(notification.createdAt))
          .limit(5)
      : []
    return { unreadCount: unread?.n ?? 0, latestAt: latest?.createdAt ?? null, fresh }
  })
  return { ...result, unreadElsewhere: await unreadElsewhere(useDb(), ctx.userId, ctx.orgId) }
})
