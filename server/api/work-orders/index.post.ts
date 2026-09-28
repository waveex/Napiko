/**
 * Nowe zlecenie: numer z kolejnej sekwencji organizacji, opcjonalnie lista zadań i stan licznika.
 */
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { task, vehicle, workOrder } from '../../db/schema'
import { workOrderCreateSchema } from '../../../shared/schemas'
import { formatWorkOrderNumber } from '../../../shared/workshop'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { workOrder: ['create'] })
  const input = await readValidatedBody(event, body => workOrderCreateSchema.parse(body))

  return withTenant(useDb(), ctx, async (tx) => {
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

    if (input.tasks.length) {
      await tx.insert(task).values(input.tasks.map((title, position) => ({
        orgId: ctx.orgId,
        workOrderId: order!.id,
        title,
        position,
        createdBy: ctx.userId,
      })))
    }

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
    return order!
  })
})
