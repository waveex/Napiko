/**
 * Nowa usługa w cenniku.
 */
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { servicePrice } from '../../db/schema'
import { servicePriceSchema } from '../../../shared/schemas'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { billing: ['update'] })
  const input = await readValidatedBody(event, body => servicePriceSchema.parse(body))

  return withTenant(useDb(), ctx, async (tx) => {
    try {
      const [created] = await tx.insert(servicePrice).values({
        orgId: ctx.orgId,
        ...servicePriceValues(input),
        createdBy: ctx.userId,
      }).returning()
      await recordAudit(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'price.created',
        entityType: 'service_price',
        entityId: created!.id,
        data: { name: created!.name },
        ...requestMeta(event),
      })
      return created!
    }
    catch (error) {
      throw priceNameConflict(error)
    }
  })
})
