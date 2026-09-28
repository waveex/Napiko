/**
 * Mechanik zgłasza potrzebę: część do zamówienia albo pracę dodatkową (np. „tylne klocki do wymiany”).
 * Biuro dostaje zgłoszenie do wyceny; praca dodatkowa wymaga później zgody klienta.
 * Opcjonalnie wstrzymuje zadanie do czasu dostawy części / decyzji.
 */
import { eq } from 'drizzle-orm'
import { withTenant } from '../../../db/tenant'
import { recordAudit } from '../../../db/audit'
import { workOrder, workRequest } from '../../../db/schema'
import { workRequestCreateSchema } from '../../../../shared/schemas'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { workRequest: ['create'] })
  const workOrderId = await getIdParam(event)
  const input = await readValidatedBody(event, body => workRequestCreateSchema.parse(body))
  const meta = requestMeta(event)

  return withTenant(useDb(), ctx, async (tx) => {
    const [order] = await tx.select({ id: workOrder.id, number: workOrder.number, status: workOrder.status })
      .from(workOrder).where(eq(workOrder.id, workOrderId)).limit(1)
    if (!order) throw notFound('Nie znaleziono zlecenia.')
    assertOrderOpen(order.status)

    const related = input.taskId ? await loadTaskWithOrder(tx, input.taskId) : null
    if (related && related.order.id !== order.id) {
      throw createError({ statusCode: 422, message: 'Zadanie nie należy do tego zlecenia.' })
    }

    const [row] = await tx.insert(workRequest).values({
      orgId: ctx.orgId,
      workOrderId,
      taskId: input.taskId,
      kind: input.kind,
      title: input.title,
      description: input.description,
      urgency: input.urgency,
      reportedBy: ctx.userId,
    }).returning()

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'work_request.created',
      entityType: 'work_request',
      entityId: row!.id,
      data: { number: order.number, title: row!.title, kind: row!.kind, urgency: row!.urgency },
      ...meta,
    })

    if (input.holdTask && related) {
      const allowed = can(ctx, { task: ['update'] })
        || (can(ctx, { task: ['work'] }) && await isAssignedToTask(tx, related.task.id, related.task.parentId, ctx.userId))
      if (!allowed) throw createError({ statusCode: 403, message: 'Wstrzymać zadanie może osoba do niego przypisana.' })
      await applyTaskStatus(tx, ctx, related.task, order, input.kind === 'part' ? 'waiting_parts' : 'waiting_approval', meta)
    }

    return { id: row!.id }
  })
})
