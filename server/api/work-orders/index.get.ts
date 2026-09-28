/**
 * Tablica zleceń: aktywne (domyślnie) albo archiwum, filtr „moje”, wyszukiwanie.
 */
import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { withTenant } from '../../db/tenant'
import { customer, task, timeEntry, vehicle, workOrder, workRequest } from '../../db/schema'
import { BOARD_STATUSES } from '../../../shared/workshop'

const querySchema = z.object({
  view: z.enum(['active', 'archive']).default('active'),
  mine: z.enum(['0', '1']).default('0'),
  q: z.string().trim().max(100).optional(),
})

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { workOrder: ['read'] })
  const { view, mine, q } = await getValidatedQuery(event, query => querySchema.parse(query))

  return withTenant(useDb(), ctx, async (tx) => {
    const statuses = view === 'active' ? [...BOARD_STATUSES] : ['closed' as const, 'cancelled' as const]
    const p = q ? likePattern(q) : null
    const rows = await tx
      .select({
        id: workOrder.id,
        number: workOrder.number,
        status: workOrder.status,
        description: workOrder.description,
        promisedAt: workOrder.promisedAt,
        receivedAt: workOrder.receivedAt,
        closedAt: workOrder.closedAt,
        vehicle: {
          id: vehicle.id,
          type: vehicle.type,
          make: vehicle.make,
          model: vehicle.model,
          registrationNumber: vehicle.registrationNumber,
        },
        customer: { id: customer.id, name: customer.name },
        tasksTotal: tx.$count(task, and(eq(task.workOrderId, workOrder.id), ne(task.status, 'cancelled'))),
        tasksDone: tx.$count(task, and(eq(task.workOrderId, workOrder.id), eq(task.status, 'done'))),
        openRequests: tx.$count(workRequest, and(eq(workRequest.workOrderId, workOrder.id), inArray(workRequest.status, ['open', 'quoted']))),
        working: tx.$count(timeEntry, and(eq(timeEntry.workOrderId, workOrder.id), isNull(timeEntry.endedAt))),
        // (złączenia poniżej sprawiają, że Drizzle kwalifikuje ${workOrder.id} nazwą tabeli)
        assignees: sql<{ id: string, name: string }[]>`coalesce((
          select json_agg(distinct jsonb_build_object('id', u.id, 'name', u.name))
          from task_assignment ta
          join task t on t.id = ta.task_id
          join "user" u on u.id = ta.user_id
          where t.work_order_id = ${workOrder.id}
        ), '[]'::json)`,
      })
      .from(workOrder)
      .innerJoin(vehicle, eq(vehicle.id, workOrder.vehicleId))
      .innerJoin(customer, eq(customer.id, workOrder.customerId))
      .where(and(
        inArray(workOrder.status, statuses),
        mine === '1'
          ? sql`exists (
              select 1 from task_assignment ta join task t on t.id = ta.task_id
              where t.work_order_id = ${workOrder.id} and ta.user_id = ${ctx.userId}
            )`
          : undefined,
        p
          ? or(ilike(workOrder.number, p), ilike(vehicle.registrationNumber, p), ilike(vehicle.make, p), ilike(vehicle.model, p), ilike(customer.name, p))
          : undefined,
      ))
      .orderBy(view === 'active' ? asc(workOrder.promisedAt) : desc(workOrder.closedAt), desc(workOrder.receivedAt))
      .limit(view === 'active' ? 300 : 100)

    return {
      orders: rows,
      can: {
        create: can(ctx, { workOrder: ['create'] }),
        update: can(ctx, { workOrder: ['update'] }),
      },
    }
  })
})
