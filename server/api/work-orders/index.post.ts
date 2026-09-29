/**
 * Nowe zlecenie: numer z kolejnej sekwencji organizacji, opcjonalnie lista zadań i stan licznika.
 * Klient dostaje potwierdzenie przyjęcia pojazdu z linkiem do statusu naprawy (pole „Powiadom klienta”),
 * a przy zasadzie „mechanicy sami biorą zadania” mechanicy – powiadomienie o zadaniach do wzięcia.
 */
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { notifyTasksAvailable } from '../../db/notifications'
import { queueOrderStatusNotification } from '../../db/customer-notifications'
import { getEnv } from '../../lib/env'
import { task, vehicle, workOrder } from '../../db/schema'
import { workOrderCreateSchema } from '../../../shared/schemas'
import { formatWorkOrderNumber } from '../../../shared/workshop'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { workOrder: ['create'] })
  const input = await readValidatedBody(event, body => workOrderCreateSchema.parse(body))
  if (input.notifyCustomer) assertCan(ctx, { customerNotification: ['send'] })

  const created = await withTenant(useDb(), ctx, async (tx) => {
    const [veh] = await tx.select({ id: vehicle.id, customerId: vehicle.customerId }).from(vehicle)
      .where(eq(vehicle.id, input.vehicleId)).limit(1)
    if (!veh) throw notFound('Nie znaleziono pojazdu.')
    if (veh.customerId !== input.customerId) {
      throw createError({ statusCode: 422, message: 'Pojazd nie należy do wybranego klienta.' })
    }

    const year = new Date().getFullYear()
    const seq = await tx.execute<{ n: number }>(sql`select app.next_sequence('work_order', ${year}) as n`)
    const number = formatWorkOrderNumber(year, seq.rows[0]!.n)

    const [order] = await tx.insert(workOrder).values({
      orgId: ctx.orgId,
      number,
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      description: input.description,
      meterValue: input.meterValue,
      promisedAt: input.promisedAt ? new Date(input.promisedAt) : null,
      createdBy: ctx.userId,
    }).returning()

    const tasks = input.tasks.length
      ? await tx.insert(task).values(input.tasks.map((title, position) => ({
          orgId: ctx.orgId,
          workOrderId: order!.id,
          title,
          position,
          createdBy: ctx.userId,
        }))).returning({ id: task.id, title: task.title })
      : []

    // Aktualizacja licznika pojazdu (tylko w górę)
    if (input.meterValue !== null) {
      await tx.update(vehicle)
        .set({ meterValue: input.meterValue })
        .where(and(eq(vehicle.id, veh.id), or(isNull(vehicle.meterValue), lt(vehicle.meterValue, input.meterValue))))
    }

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'work_order.created',
      entityType: 'work_order',
      entityId: order!.id,
      data: { number, tasks: input.tasks.length },
      ...requestMeta(event),
    })

    await notifyTasksAvailable(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      workOrderId: order!.id,
      taskIds: tasks.map(t => t.id),
      taskTitle: tasks[0]?.title,
    })
    // Potwierdzenie przyjęcia pojazdu: zaznaczone pole wysyła zawsze, brak decyzji – według ustawień warsztatu
    if (input.notifyCustomer !== false && can(ctx, { customerNotification: ['send'] })) {
      await queueOrderStatusNotification(tx, getEnv(), {
        orgId: ctx.orgId,
        workOrderId: order!.id,
        event: 'order_received',
        trigger: 'auto',
        force: input.notifyCustomer === true,
        actorUserId: ctx.userId,
        meta: requestMeta(event),
      })
    }
    return order!
  })

  await deliverNotifications(event)
  return created
})
