/**
 * Zmiana usługi w cenniku. Kosztorysy już utworzone zachowują swoje ceny.
 */
import { eq } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { servicePrice } from '../../db/schema'
import { servicePriceSchema } from '../../../shared/schemas'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { billing: ['update'] })
  const id = await getIdParam(event)
  const input = await readValidatedBody(event, body => servicePriceSchema.parse(body))

  return withTenant(useDb(), ctx, async (tx) => {
    const [before] = await tx.select().from(servicePrice).where(eq(servicePrice.id, id)).limit(1)
    if (!before) throw notFound('Nie znaleziono usługi w cenniku.')
    try {
      const [after] = await tx.update(servicePrice).set(servicePriceValues(input)).where(eq(servicePrice.id, id)).returning()
      await recordAudit(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'price.updated',
        entityType: 'service_price',
        entityId: id,
        data: { name: after!.name },
        ...requestMeta(event),
      })
      return after!
    }
    catch (error) {
      throw priceNameConflict(error)
    }
  })
})
