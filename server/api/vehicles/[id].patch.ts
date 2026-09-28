import { eq } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { vehicle } from '../../db/schema'
import { vehicleUpdateSchema } from '../../../shared/schemas'
import { normalizeRegistration } from '../../../shared/workshop'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { vehicle: ['update'] })
  const id = await getIdParam(event)
  const input = await readValidatedBody(event, body => vehicleUpdateSchema.parse(body))
  if ('registrationNumber' in input) input.registrationNumber = normalizeRegistration(input.registrationNumber)
  if (input.vin) input.vin = input.vin.toUpperCase()

  return withTenant(useDb(), ctx, async (tx) => {
    if (Object.keys(input).length === 0) {
      const [current] = await tx.select().from(vehicle).where(eq(vehicle.id, id)).limit(1)
      if (!current) throw notFound()
      return current
    }
    const [row] = await tx.update(vehicle).set(input).where(eq(vehicle.id, id)).returning()
    if (!row) throw notFound('Nie znaleziono pojazdu.')
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'vehicle.updated',
      entityType: 'vehicle',
      entityId: id,
      data: { fields: Object.keys(input) },
      ...requestMeta(event),
    })
    return row
  })
})
