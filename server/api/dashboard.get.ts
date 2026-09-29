/**
 * Pulpit: najważniejsze sprawy dla roli zalogowanej osoby, policzone na serwerze.
 *  - praca przy zadaniach (mechanik, a także biuro i właściciel, gdy mają przydzielone zadania):
 *    bieżące zadanie z licznikiem, kolejka, czas pracy dziś, zgłoszone potrzeby,
 *  - biuro i właściciel: sprawy wymagające reakcji, odbiory na dziś, tablica zleceń, zespół przy pracy,
 *    konfiguracja warsztatu,
 *  - właściciel: wyniki miesiąca (uprawnienie `report`).
 * Sekcja bez uprawnienia nie jest liczona – w odpowiedzi ma wartość null.
 * Zapytania: server/utils/dashboard.ts i server/utils/my-tasks.ts.
 */
import { eq } from 'drizzle-orm'
import type { Tx } from '../db/client'
import { withTenant } from '../db/tenant'
import { organization } from '../db/schema'
import type { TaskStatus } from '../../shared/workshop'
import type { TenantRequestContext } from '../utils/tenant'

/** Grupy jak w „Moich zadaniach”: do zrobienia oraz czekające na część albo decyzję klienta. */
const QUEUE: TaskStatus[] = ['todo', 'in_progress', 'paused']
const WAITING: TaskStatus[] = ['waiting_parts', 'waiting_approval']

/** Moja praca: te same dane co „Moje zadania”, skrócone do tego, co najważniejsze teraz. */
async function loadMyWork(tx: Tx, ctx: TenantRequestContext, timezone: string) {
  const my = await loadMyTasks(tx, ctx, timezone)
  const runningTask = my.running ? my.tasks.find(t => t.id === my.running!.taskId) ?? null : null
  const rest = my.tasks.filter(t => t.id !== runningTask?.id)
  const queue = rest.filter(t => QUEUE.includes(t.status))
  const waiting = rest.filter(t => WAITING.includes(t.status))
  return {
    running: my.running,
    runningTask,
    queue: queue.slice(0, 4),
    waiting: waiting.slice(0, 3),
    counts: {
      queue: queue.length,
      waiting: waiting.length,
      doneToday: rest.filter(t => t.status === 'done').length,
      available: my.available.length,
    },
    secondsToday: await loadSecondsToday(tx, ctx.userId, timezone),
    requests: can(ctx, { workRequest: ['create'] }) ? await loadMyReportedRequests(tx, ctx.userId) : [],
    can: my.can,
  }
}

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event)

  return withTenant(useDb(), ctx, async (tx) => {
    const timezone = await getOrgTimezone(tx)
    const [org] = await tx.select({ kind: organization.kind }).from(organization).where(eq(organization.id, ctx.orgId)).limit(1)
    const solo = org?.kind === 'solo'
    const assign = assignmentCapabilities(ctx, await getAssignmentPolicy(tx))

    const mine = can(ctx, { task: ['work'] }) ? await loadMyWork(tx, ctx, timezone) : null
    const office = can(ctx, { workOrder: ['update'] })
      ? await loadOfficeOverview(tx, {
          timezone,
          requests: can(ctx, { workRequest: ['quote'] }),
          approvals: can(ctx, { workRequest: ['decide'] }),
          estimates: can(ctx, { billing: ['read'] }),
          planTasks: can(ctx, { task: ['create'] }),
          planAssign: assign.assignOthers,
        })
      : null
    const team = !solo && can(ctx, { task: ['assign'] }) ? await loadTeamNow(tx, ctx.orgId, timezone) : null
    const report = can(ctx, { report: ['read'] }) ? await loadOwnerReport(tx, timezone) : null
    const setup = can(ctx, { settings: ['update'] }) ? await loadSetupChecklist(tx, ctx.orgId, solo) : null

    return {
      serverTime: new Date(),
      timezone,
      mine,
      office,
      team,
      report,
      setup,
    }
  })
})
