/**
 * Usunięcie usługi z cennika (archiwizacja – kosztorysy dalej się do niej odwołują).
 */
import { and, eq, isNull, sql } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { servicePrice } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { billing: ['update'] })
  const id = await getIdParam(event)

  return withTenant(useDb(), ctx, async (tx) => {
    const [archived] = await tx.update(servicePrice).set({ archivedAt: sql`now()` })
      .where(and(eq(servicePrice.id, id), isNull(servicePrice.archivedAt)))
      .returning({ id: servicePrice.id, name: servicePrice.name })
    if (!archived) throw notFound('Nie znaleziono usługi w cenniku.')
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'price.archived',
      entityType: 'service_price',
      entityId: id,
      data: { name: archived.name },
      ...requestMeta(event),
    })
    return { ok: true }
  })
})
