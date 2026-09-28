/**
 * Przypisanie osoby do zadania (jedna lub kilka osób na zadanie).
 * Kto może przypisywać, decyduje polityka organizacji: biuro, sami mechanicy albo tryb mieszany.
 */
import { withTenant } from '../../../db/tenant'
import { recordAudit } from '../../../db/audit'
import { taskAssignment } from '../../../db/schema'
import { assignmentSchema } from '../../../../shared/schemas'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { task: ['read'] })
  const taskId = await getIdParam(event)
  const { userId } = await readValidatedBody(event, body => assignmentSchema.parse(body))

  return withTenant(useDb(), ctx, async (tx) => {
    const { task: current, order } = await loadTaskWithOrder(tx, taskId)
    assertOrderOpen(order.status)
    await assertMayChangeAssignment(tx, ctx, userId, 'assign')

    const inserted = await tx.insert(taskAssignment)
      .values({ orgId: ctx.orgId, taskId, userId, assignedBy: ctx.userId })
      .onConflictDoNothing()
      .returning({ userId: taskAssignment.userId })

    if (inserted.length) {
      await recordAudit(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'task.assigned',
        entityType: 'task',
        entityId: taskId,
        data: { number: order.number, title: current.title, userId },
        ...requestMeta(event),
      })
    }
    return loadWorkOrderDetail(tx, ctx, current.workOrderId)
  })
})
