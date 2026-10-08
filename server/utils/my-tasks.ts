/**
 * „Moje zadania” – praca zalogowanej osoby: zadania przypisane do niej (także podzadania zadań, które ma),
 * jej uruchomiony licznik, czas pracy i zgłoszone potrzeby; w trybie „sami biorą” także zadania do wzięcia.
 * Korzystają z tego ekran „Moje zadania” i pulpit – obie strony pokazują te same liczby.
 */
import { and, asc, eq, inArray, isNull, ne, notInArray, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Tx } from '../db/client'
import { customer, task, timeEntry, vehicle, workOrder, workRequest } from '../db/schema'
import type { TenantRequestContext } from './tenant'

const CLOSED_ORDER = ['closed', 'cancelled'] as const

/** @param timezone strefa czasowa warsztatu, gdy wywołujący już ją zna (inaczej odczyt z ustawień) */
export async function loadMyTasks(tx: Tx, ctx: TenantRequestContext, timezone?: string) {
  const policy = await getAssignmentPolicy(tx)
  const caps = assignmentCapabilities(ctx, policy)
  const tz = timezone ?? await getOrgTimezone(tx)

  const parent = alias(task, 'parent')
  const fields = {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    kind: task.kind,
    parentId: task.parentId,
    parentTitle: parent.title,
    estimatedMinutes: task.estimatedMinutes,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    order: {
      id: workOrder.id,
      number: workOrder.number,
      status: workOrder.status,
      description: workOrder.description,
      promisedAt: workOrder.promisedAt,
    },
    vehicle: {
      id: vehicle.id,
      type: vehicle.type,
      make: vehicle.make,
      model: vehicle.model,
      registrationNumber: vehicle.registrationNumber,
      serialNumber: vehicle.serialNumber,
    },
    customerName: customer.name,
  }
  const ordering = [
    sql`${workOrder.promisedAt} asc nulls last`,
    asc(workOrder.receivedAt),
    asc(sql`coalesce(${parent.position}, ${task.position})`),
    sql`${task.parentId} asc nulls first`,
    asc(task.position),
  ]

  const assignedToMe = sql`(
    exists (select 1 from task_assignment ta where ta.task_id = ${task.id} and ta.user_id = ${ctx.userId})
    or exists (select 1 from task_assignment ta where ta.task_id = ${task.parentId} and ta.user_id = ${ctx.userId})
  )`
  // Zrobione pokazujemy tylko z dzisiaj (dzień w strefie czasowej warsztatu)
  const doneToday = sql`${task.completedAt} >= ${periodBounds(tz).dayStart}`

  const mine = await tx.select(fields)
    .from(task)
    .innerJoin(workOrder, eq(workOrder.id, task.workOrderId))
    .innerJoin(vehicle, eq(vehicle.id, workOrder.vehicleId))
    .innerJoin(customer, eq(customer.id, workOrder.customerId))
    .leftJoin(parent, eq(parent.id, task.parentId))
    .where(and(
      notInArray(workOrder.status, [...CLOSED_ORDER]),
      ne(task.status, 'cancelled'),
      or(ne(task.status, 'done'), doneToday),
      assignedToMe,
    ))
    .orderBy(...ordering)
    .limit(200)

  // Do wzięcia: zadania główne bez nikogo przypisanego (gdy polityka pozwala brać samemu)
  const available = caps.selfAssign && !caps.assignOthers
    ? await tx.select(fields)
        .from(task)
        .innerJoin(workOrder, eq(workOrder.id, task.workOrderId))
        .innerJoin(vehicle, eq(vehicle.id, workOrder.vehicleId))
        .innerJoin(customer, eq(customer.id, workOrder.customerId))
        .leftJoin(parent, eq(parent.id, task.parentId))
        .where(and(
          notInArray(workOrder.status, [...CLOSED_ORDER, 'ready']),
          isNull(task.parentId),
          eq(task.kind, 'work'),
          inArray(task.status, ['todo', 'paused']),
          sql`not exists (select 1 from task_assignment ta where ta.task_id = ${task.id})`,
        ))
        .orderBy(...ordering)
        .limit(50)
    : []

  const ids = mine.map(t => t.id)
  const times = ids.length
    ? await tx
        .select({
          taskId: timeEntry.taskId,
          mine: sql<number>`coalesce(sum(extract(epoch from coalesce(${timeEntry.endedAt}, now()) - ${timeEntry.startedAt})) filter (where ${timeEntry.userId} = ${ctx.userId}), 0)::int`,
          total: sql<number>`coalesce(sum(extract(epoch from coalesce(${timeEntry.endedAt}, now()) - ${timeEntry.startedAt})), 0)::int`,
        })
        .from(timeEntry)
        .where(inArray(timeEntry.taskId, ids))
        .groupBy(timeEntry.taskId)
    : []
  const requests = ids.length
    ? await tx
        .select({
          id: workRequest.id,
          taskId: workRequest.taskId,
          title: workRequest.title,
          kind: workRequest.kind,
          urgency: workRequest.urgency,
          status: workRequest.status,
        })
        .from(workRequest)
        .where(inArray(workRequest.taskId, ids))
    : []
  const [running] = await tx
    .select({ id: timeEntry.id, taskId: timeEntry.taskId, workOrderId: timeEntry.workOrderId, startedAt: timeEntry.startedAt })
    .from(timeEntry)
    .where(and(eq(timeEntry.userId, ctx.userId), isNull(timeEntry.endedAt)))
    .limit(1)

  return {
    serverTime: new Date(),
    running: running ?? null,
    tasks: mine.map(t => ({
      ...t,
      mySeconds: times.find(x => x.taskId === t.id)?.mine ?? 0,
      totalSeconds: times.find(x => x.taskId === t.id)?.total ?? 0,
      requests: requests.filter(r => r.taskId === t.id),
    })),
    available,
    assignmentPolicy: policy,
    can: {
      work: can(ctx, { task: ['work'] }),
      selfAssign: caps.selfAssign,
      reportNeeds: can(ctx, { workRequest: ['create'] }),
      uploadFiles: can(ctx, { file: ['upload'] }),
    },
  }
}
