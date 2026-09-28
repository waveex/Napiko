import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { customer } from '../../db/schema'
import { customerSchema } from '../../../shared/schemas'
import { normalizePhone } from '../../../shared/workshop'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { customer: ['create'] })
  const input = await readValidatedBody(event, body => customerSchema.parse(body))

  return withTenant(useDb(), ctx, async (tx) => {
    const [row] = await tx.insert(customer).values({
      ...input,
      phone: normalizePhone(input.phone),
      orgId: ctx.orgId,
      createdBy: ctx.userId,
    }).returning()
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'customer.created',
      entityType: 'customer',
      entityId: row!.id,
      ...requestMeta(event),
    })
    return row!
  })
})
