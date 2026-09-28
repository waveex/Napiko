/**
 * Ostatnie wpisy dziennika zdarzeń aktywnej organizacji + stan łańcucha hashy.
 */
import { desc, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { withTenant } from '../db/tenant'
import { auditEvent, user } from '../db/schema'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { audit: ['read'] })
  const { limit } = await getValidatedQuery(event, query => z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }).parse(query))

  return withTenant(useDb(), ctx, async (tx) => {
    const events = await tx.select().from(auditEvent).orderBy(desc(auditEvent.seq)).limit(limit)
    const actorIds = [...new Set(events.map(e => e.actorUserId).filter((id): id is string => !!id))]
    const actors = actorIds.length
      ? await tx.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, actorIds))
      : []
    const names = new Map(actors.map(a => [a.id, a.name]))
    const [chain] = (await tx.execute<{ broken: string | null }>(
      sql`select app.audit_chain_first_broken(${ctx.orgId}::uuid) as broken`,
    )).rows

    return {
      chainIntact: chain?.broken == null,
      events: events.map(e => ({
        seq: e.seq,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        data: e.data,
        actorName: e.actorUserId ? names.get(e.actorUserId) ?? null : null,
        createdAt: e.createdAt,
      })),
    }
  })
})
