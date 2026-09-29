/**
 * Moje powiadomienia w aktywnym warsztacie (od najnowszych, stronicowane).
 * RLS zwraca wyłącznie powiadomienia zalogowanej osoby.
 */
import { and, desc, eq, isNull, lt, or } from 'drizzle-orm'
import { z } from 'zod'
import { withTenant } from '../../db/tenant'
import { notification, user } from '../../db/schema'

const querySchema = z.object({
  filter: z.enum(['all', 'unread']).default('all'),
  /** kursor: czas utworzenia i id ostatniego wczytanego powiadomienia */
  before: z.string().regex(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z_[0-9a-f-]{36}$/).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
})

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event)
  const query = await getValidatedQuery(event, q => querySchema.parse(q))

  return withTenant(useDb(), ctx, async (tx) => {
    const conditions = [eq(notification.userId, ctx.userId)]
    if (query.filter === 'unread') conditions.push(isNull(notification.readAt))
    if (query.before) {
      const [at, id] = query.before.split('_') as [string, string]
      const date = new Date(at)
      conditions.push(or(lt(notification.createdAt, date), and(eq(notification.createdAt, date), lt(notification.id, id)))!)
    }
    const rows = await tx
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
      .where(and(...conditions))
      .orderBy(desc(notification.createdAt), desc(notification.id))
      .limit(query.limit + 1)
    const items = rows.slice(0, query.limit)
    const last = items.at(-1)
    return {
      items,
      nextCursor: rows.length > query.limit && last ? `${last.createdAt.toISOString()}_${last.id}` : null,
    }
  })
})
