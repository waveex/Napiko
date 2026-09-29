/**
 * Zdjęcie osoby z zadania (te same zasady co przy przypisaniu). Osoba zdjęta przez kogoś innego dostaje powiadomienie.
 */
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { withTenant } from '../../../../db/tenant'
import { recordAudit } from '../../../../db/audit'
import { notifyTaskAssignment } from '../../../../db/notifications'
import { taskAssignment } from '../../../../db/schema'

const paramsSchema = z.object({ id: z.uuid(), userId: z.uuid() })

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { task: ['read'] })
  const { id: taskId, userId } = await getValidatedRouterParams(event, params => paramsSchema.parse(params))

  let notified = false
  const detail = await withTenant(useDb(), ctx, async (tx) => {
    const { task: current, order } = await loadTaskWithOrder(tx, taskId)
    assertOrderOpen(order.status)
    await assertMayChangeAssignment(tx, ctx, userId, 'unassign')

    const removed = await tx.delete(taskAssignment)
      .where(and(eq(taskAssignment.taskId, taskId), eq(taskAssignment.userId, userId)))
      .returning({ userId: taskAssignment.userId })

    if (removed.length) {
      await recordAudit(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'task.unassigned',
        entityType: 'task',
        entityId: taskId,
        data: { number: order.number, title: current.title, userId },
        ...requestMeta(event),
      })
      const sent = await notifyTaskAssignment(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        userId,
        taskId,
        taskTitle: current.title,
        workOrderId: current.workOrderId,
        assigned: false,
      })
      notified = sent.length > 0
    }
    return loadWorkOrderDetail(tx, ctx, current.workOrderId)
  })

  if (notified) await deliverNotifications(event)
  return detail
})
