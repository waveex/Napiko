import { eq } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { customer } from '../../db/schema'
import { customerUpdateSchema } from '../../../shared/schemas'
import { normalizePhone } from '../../../shared/workshop'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { customer: ['update'] })
  const id = await getIdParam(event)
  const input = await readValidatedBody(event, body => customerUpdateSchema.parse(body))
  if ('phone' in input) input.phone = normalizePhone(input.phone)

  return withTenant(useDb(), ctx, async (tx) => {
    if (Object.keys(input).length === 0) {
      const [current] = await tx.select().from(customer).where(eq(customer.id, id)).limit(1)
      if (!current) throw notFound()
      return current
    }
    const [row] = await tx.update(customer).set(input).where(eq(customer.id, id)).returning()
    if (!row) throw notFound('Nie znaleziono klienta.')
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'customer.updated',
      entityType: 'customer',
      entityId: id,
      // bez wartości – w dzienniku nie powielamy danych osobowych
      data: { fields: Object.keys(input) },
      ...requestMeta(event),
    })
    return row
  })
})
