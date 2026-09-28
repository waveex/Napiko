/**
 * Usunięcie zadania dodanego przez pomyłkę – tylko zanim ktokolwiek zaczął nad nim pracę.
 * Rozpoczęte zadania się anuluje (status „anulowane”), żeby historia pracy została zachowana.
 */
import { and, eq, ne } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { task } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { task: ['update'] })
  const id = await getIdParam(event)

  return withTenant(useDb(), ctx, async (tx) => {
    const { task: current, order } = await loadTaskWithOrder(tx, id)
    assertOrderOpen(order.status)

    const [startedSubtask] = await tx.select({ id: task.id }).from(task)
      .where(and(eq(task.parentId, id), ne(task.status, 'todo'))).limit(1)
    if (current.status !== 'todo' || current.startedAt || startedSubtask) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: 'Praca nad tym zadaniem już się zaczęła – zamiast usuwać, zmień status na „anulowane”.',
      })
    }

    await tx.delete(task).where(eq(task.id, id))
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'task.deleted',
      entityType: 'task',
      entityId: id,
      data: { number: order.number, title: current.title, subtask: !!current.parentId },
      ...requestMeta(event),
    })
    return loadWorkOrderDetail(tx, ctx, current.workOrderId)
  })
})
