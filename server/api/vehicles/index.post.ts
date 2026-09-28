import { eq } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { customer, vehicle } from '../../db/schema'
import { vehicleSchema } from '../../../shared/schemas'
import { normalizeRegistration } from '../../../shared/workshop'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { vehicle: ['create'] })
  const input = await readValidatedBody(event, body => vehicleSchema.parse(body))

  return withTenant(useDb(), ctx, async (tx) => {
    const [owner] = await tx.select({ id: customer.id }).from(customer).where(eq(customer.id, input.customerId)).limit(1)
    if (!owner) throw notFound('Nie znaleziono klienta.')
    const [row] = await tx.insert(vehicle).values({
      ...input,
      registrationNumber: normalizeRegistration(input.registrationNumber),
      vin: input.vin?.toUpperCase() ?? null,
      orgId: ctx.orgId,
      createdBy: ctx.userId,
    }).returning()
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'vehicle.created',
      entityType: 'vehicle',
      entityId: row!.id,
      data: { type: row!.type },
      ...requestMeta(event),
    })
    return row!
  })
})
