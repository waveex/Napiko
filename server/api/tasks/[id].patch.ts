/**
 * Zmiana zadania.
 *  - tytuł, opis, czas normatywny, kolejność: biuro (task:update),
 *  - status: biuro albo mechanik przypisany do zadania lub zadania nadrzędnego (task:work).
 * Pierwsze rozpoczęte zadanie przenosi przyjęte zlecenie do realizacji, a zakończenie
 * lub wstrzymanie zadania zatrzymuje liczniki czasu (zob. applyTaskStatus).
 */
import { eq } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { task } from '../../db/schema'
import { taskUpdateSchema } from '../../../shared/schemas'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { task: ['read'] })
  const id = await getIdParam(event)
  const input = await readValidatedBody(event, body => taskUpdateSchema.parse(body))

  const detailFields = (['title', 'description', 'estimatedMinutes', 'position'] as const).filter(k => input[k] !== undefined)
  if (detailFields.length) assertCan(ctx, { task: ['update'] })
  if (input.status !== undefined) assertCan(ctx, { task: ['work'] })

  return withTenant(useDb(), ctx, async (tx) => {
    const { task: current, order } = await loadTaskWithOrder(tx, id)
    assertOrderOpen(order.status)
    const meta = requestMeta(event)

    if (input.status !== undefined && input.status !== current.status) {
      if (!can(ctx, { task: ['update'] }) && !(await isAssignedToTask(tx, current.id, current.parentId, ctx.userId))) {
        throw createError({ statusCode: 403, message: 'Status zmienia osoba przypisana do zadania albo biuro.' })
      }
      await applyTaskStatus(tx, ctx, current, order, input.status, meta)
    }

    if (detailFields.length) {
      const values: Partial<typeof task.$inferInsert> = {}
      for (const field of detailFields) Object.assign(values, { [field]: input[field] })
      await tx.update(task).set(values).where(eq(task.id, id))
      await recordAudit(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'task.updated',
        entityType: 'task',
        entityId: id,
        data: { number: order.number, fields: detailFields },
        ...meta,
      })
    }
    return loadWorkOrderDetail(tx, ctx, current.workOrderId)
  })
})
