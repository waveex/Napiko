/**
 * Nowe zadanie albo podzadanie w zleceniu. Przy zasadzie „mechanicy sami biorą zadania” nowe zadanie główne
 * trafia do mechaników jako powiadomienie o zadaniu do wzięcia.
 */
import { and, eq, isNull, sql } from 'drizzle-orm'
import { withTenant } from '../../../db/tenant'
import { recordAudit } from '../../../db/audit'
import { notifyTasksAvailable } from '../../../db/notifications'
import { task, workOrder } from '../../../db/schema'
import { taskCreateSchema } from '../../../../shared/schemas'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { task: ['create'] })
  const workOrderId = await getIdParam(event)
  const input = await readValidatedBody(event, body => taskCreateSchema.parse(body))

  let notified = false
  const detail = await withTenant(useDb(), ctx, async (tx) => {
    const [order] = await tx.select({ id: workOrder.id, number: workOrder.number, status: workOrder.status }).from(workOrder)
      .where(eq(workOrder.id, workOrderId)).limit(1)
    if (!order) throw notFound('Nie znaleziono zlecenia.')
    assertOrderOpen(order.status)

    // Te same reguły pilnuje wyzwalacz w bazie – tu dajemy czytelny komunikat zamiast błędu 500.
    if (input.parentId) {
      const [parent] = await tx.select({ workOrderId: task.workOrderId, parentId: task.parentId }).from(task)
        .where(eq(task.id, input.parentId)).limit(1)
      if (!parent || parent.workOrderId !== workOrderId) {
        throw createError({ statusCode: 422, message: 'Zadanie nadrzędne musi należeć do tego zlecenia.' })
      }
      if (parent.parentId) {
        throw createError({ statusCode: 422, message: 'Podzadanie nie może mieć własnych podzadań.' })
      }
    }

    const [{ next } = { next: 0 }] = await tx
      .select({ next: sql<number>`coalesce(max(${task.position}) + 1, 0)::int` })
      .from(task)
      .where(and(eq(task.workOrderId, workOrderId), input.parentId ? eq(task.parentId, input.parentId) : isNull(task.parentId)))

    const [row] = await tx.insert(task).values({
      orgId: ctx.orgId,
      workOrderId,
      parentId: input.parentId,
      title: input.title,
      description: input.description,
      estimatedMinutes: input.estimatedMinutes,
      position: next,
      createdBy: ctx.userId,
    }).returning()

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'task.created',
      entityType: 'task',
      entityId: row!.id,
      data: { number: order.number, title: row!.title, subtask: !!input.parentId },
      ...requestMeta(event),
    })
    if (!input.parentId) {
      const sent = await notifyTasksAvailable(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        workOrderId,
        taskIds: [row!.id],
        taskTitle: row!.title,
      })
      notified = sent.length > 0
    }
    return loadWorkOrderDetail(tx, ctx, workOrderId)
  })

  if (notified) await deliverNotifications(event)
  return detail
})
