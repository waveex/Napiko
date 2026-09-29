/**
 * Pulpit – podsumowania dla ról warsztatu, liczone w bazie (zegarem bazy, w strefie czasowej warsztatu).
 *
 * Funkcje nie sprawdzają uprawnień: endpoint server/api/dashboard.get.ts decyduje, które sekcje policzyć
 * dla danej roli. Plik nie korzysta z auto-importów Nuxta – sprawdzają go testy bazy (tests/db/dashboard.test.ts).
 * Liczniki obejmują wszystkie pasujące rekordy; listy pokazują tylko kilka najpilniejszych pozycji,
 * a pełne widoki są na stronach zleceń i potrzeb.
 */
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, ne, notInArray, or, sql, type SQL } from 'drizzle-orm'
import type { Tx } from '../db/client'
import {
  approvalRequest, companyProfile, customer, estimateItem, invitation, member, organizationSettings, servicePrice,
  task, taskAssignment, timeEntry, user, vehicle, workOrder, workRequest,
} from '../db/schema'
import { parseRoles } from '../../shared/permissions'
import { estimateLine, grossCents } from '../../shared/workshop'

const CLOSED_ORDER = ['closed', 'cancelled'] as const
/** Zlecenia, w których praca trwa albo czeka (bez gotowych do odbioru). */
const UNFINISHED_ORDER = ['received', 'in_progress', 'waiting_approval', 'waiting_parts'] as const
/** Zgłoszenia wymagające działania biura (jak na stronie „Potrzeby”). */
const OPEN_REQUEST = ['open', 'quoted', 'approved', 'ordered'] as const

const vehicleFields = {
  type: vehicle.type,
  make: vehicle.make,
  model: vehicle.model,
  registrationNumber: vehicle.registrationNumber,
  serialNumber: vehicle.serialNumber,
}

const orderFields = {
  id: workOrder.id,
  number: workOrder.number,
  status: workOrder.status,
  promisedAt: workOrder.promisedAt,
  receivedAt: workOrder.receivedAt,
  vehicle: vehicleFields,
  customerName: customer.name,
}

export async function getOrgTimezone(tx: Tx) {
  const [row] = await tx.select({ timezone: organizationSettings.timezone }).from(organizationSettings).limit(1)
  return row?.timezone ?? 'Europe/Warsaw'
}

/** Granice okresów w strefie czasowej warsztatu (timestamptz liczone zegarem bazy). */
export function periodBounds(timezone: string) {
  const local = sql`(now() at time zone ${timezone})`
  return {
    dayStart: sql`(date_trunc('day', ${local}) at time zone ${timezone})`,
    dayEnd: sql`((date_trunc('day', ${local}) + interval '1 day') at time zone ${timezone})`,
    monthStart: sql`(date_trunc('month', ${local}) at time zone ${timezone})`,
    prevMonthStart: sql`((date_trunc('month', ${local}) - interval '1 month') at time zone ${timezone})`,
    /** ta sama chwila miesiąc temu – porównujemy równe okresy („od 1. dnia miesiąca do teraz”) */
    monthAgo: sql`((${local} - interval '1 month') at time zone ${timezone})`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Praca mechanika (uzupełnienie danych z „Moich zadań”)
// ─────────────────────────────────────────────────────────────────────────────

/** Czas pracy osoby od początku dnia (w sekundach), razem z trwającym licznikiem. */
export async function loadSecondsToday(tx: Tx, userId: string, timezone: string) {
  const { dayStart } = periodBounds(timezone)
  const [row] = await tx
    .select({
      seconds: sql<number>`coalesce(sum(extract(epoch from coalesce(${timeEntry.endedAt}, now()) - greatest(${timeEntry.startedAt}, ${dayStart}))), 0)::int`,
    })
    .from(timeEntry)
    .where(and(eq(timeEntry.userId, userId), sql`coalesce(${timeEntry.endedAt}, now()) > ${dayStart}`))
  return row?.seconds ?? 0
}

/**
 * Potrzeby zgłoszone przez osobę: te, które biuro jeszcze obsługuje, oraz zmiany z ostatnich 3 dni
 * (np. klient zatwierdził pracę, część dotarła). Bez cen – mechanik ich nie widzi.
 */
export async function loadMyReportedRequests(tx: Tx, userId: string, limit = 5) {
  return tx
    .select({
      id: workRequest.id,
      title: workRequest.title,
      kind: workRequest.kind,
      urgency: workRequest.urgency,
      status: workRequest.status,
      updatedAt: workRequest.updatedAt,
      order: { id: workOrder.id, number: workOrder.number },
      vehicle: vehicleFields,
    })
    .from(workRequest)
    .innerJoin(workOrder, eq(workOrder.id, workRequest.workOrderId))
    .innerJoin(vehicle, eq(vehicle.id, workOrder.vehicleId))
    .where(and(
      eq(workRequest.reportedBy, userId),
      ne(workRequest.status, 'cancelled'),
      or(
        and(inArray(workRequest.status, [...OPEN_REQUEST]), notInArray(workOrder.status, [...CLOSED_ORDER])),
        sql`${workRequest.updatedAt} > now() - interval '3 days'`,
      ),
    ))
    .orderBy(desc(workRequest.updatedAt))
    .limit(limit)
}

// ─────────────────────────────────────────────────────────────────────────────
// Biuro: co wymaga reakcji, dzisiejsze odbiory, tablica
// ─────────────────────────────────────────────────────────────────────────────

export interface OfficeOverviewOptions {
  timezone: string
  /** zgłoszenia mechaników z cenami (uprawnienie workRequest.quote) */
  requests: boolean
  /** prośby o akceptację klienta (workRequest.decide) */
  approvals: boolean
  /** prośby o akceptację kosztorysu – tylko z dostępem do rozliczeń (billing.read) */
  estimates: boolean
  /** zlecenia bez zadań (task.create) */
  planTasks: boolean
  /** zadania bez wykonawcy – gdy biuro przydziela pracę (polityka „biuro” albo „mieszana”) */
  planAssign: boolean
  /** ile pozycji pokazać w każdej karcie */
  limit?: number
}

export async function loadOfficeOverview(tx: Tx, opts: OfficeOverviewOptions) {
  const limit = opts.limit ?? 3
  const { dayStart, dayEnd } = periodBounds(opts.timezone)
  const openOrder = notInArray(workOrder.status, [...CLOSED_ORDER])

  const [orders] = await tx
    .select({
      received: sql<number>`count(*) filter (where ${workOrder.status} = 'received')::int`,
      inProgress: sql<number>`count(*) filter (where ${workOrder.status} = 'in_progress')::int`,
      waitingApproval: sql<number>`count(*) filter (where ${workOrder.status} = 'waiting_approval')::int`,
      waitingParts: sql<number>`count(*) filter (where ${workOrder.status} = 'waiting_parts')::int`,
      ready: sql<number>`count(*) filter (where ${workOrder.status} = 'ready')::int`,
      overdue: sql<number>`count(*) filter (where ${inArray(workOrder.status, [...UNFINISHED_ORDER])} and ${workOrder.promisedAt} < now())::int`,
      dueToday: sql<number>`count(*) filter (where ${openOrder} and ${workOrder.promisedAt} >= ${dayStart} and ${workOrder.promisedAt} < ${dayEnd})::int`,
      receivedToday: sql<number>`count(*) filter (where ${workOrder.receivedAt} >= ${dayStart})::int`,
      closedToday: sql<number>`count(*) filter (where ${workOrder.status} = 'closed' and ${workOrder.closedAt} >= ${dayStart})::int`,
    })
    .from(workOrder)

  const c = orders!
  const orderList = (where: SQL | undefined, size = limit) => tx
    .select(orderFields)
    .from(workOrder)
    .innerJoin(vehicle, eq(vehicle.id, workOrder.vehicleId))
    .innerJoin(customer, eq(customer.id, workOrder.customerId))
    .where(where)
    .orderBy(sql`${workOrder.promisedAt} asc nulls last`, asc(workOrder.receivedAt))
    .limit(size)

  const overdue = c.overdue
    ? await orderList(and(inArray(workOrder.status, [...UNFINISHED_ORDER]), lt(workOrder.promisedAt, sql`now()`)))
    : []
  const ready = c.ready ? await orderList(eq(workOrder.status, 'ready')) : []
  const dueToday = c.dueToday
    ? await orderList(and(openOrder, gte(workOrder.promisedAt, dayStart), lt(workOrder.promisedAt, dayEnd)), 6)
    : []

  return {
    board: {
      received: c.received,
      in_progress: c.inProgress,
      waiting_approval: c.waitingApproval,
      waiting_parts: c.waitingParts,
      ready: c.ready,
    },
    today: {
      due: c.dueToday,
      received: c.receivedToday,
      closed: c.closedToday,
      orders: dueToday,
    },
    overdue: { count: c.overdue, items: overdue },
    ready: { count: c.ready, items: ready },
    requests: opts.requests ? await loadRequestAttention(tx, limit) : null,
    approvals: opts.approvals ? await loadApprovalAttention(tx, opts.estimates, limit) : null,
    planning: opts.planTasks || opts.planAssign ? await loadPlanning(tx, opts.planTasks, opts.planAssign, limit) : null,
  }
}

/** Zgłoszenia mechaników w otwartych zleceniach: nowe, wycenione bez decyzji i części. */
async function loadRequestAttention(tx: Tx, limit: number) {
  // Wyceniona pozycja jest „w drodze do klienta”, gdy ma aktywną (niewygasłą) prośbę o akceptację
  const sentToCustomer = sql`exists (
    select 1 from approval_item ai join approval_request ar on ar.id = ai.approval_id
    where ai.work_request_id = ${workRequest.id} and ar.status = 'pending' and ar.expires_at > now()
  )`
  const openOrder = notInArray(workOrder.status, [...CLOSED_ORDER])
  const [counts] = await tx
    .select({
      open: sql<number>`count(*) filter (where ${workRequest.status} = 'open')::int`,
      urgent: sql<number>`count(*) filter (where ${workRequest.status} = 'open' and ${workRequest.urgency} = 'urgent')::int`,
      quoted: sql<number>`count(*) filter (where ${workRequest.status} = 'quoted' and not ${sentToCustomer})::int`,
      partsToOrder: sql<number>`count(*) filter (where ${workRequest.kind} = 'part' and ${workRequest.status} = 'approved')::int`,
      partsOrdered: sql<number>`count(*) filter (where ${workRequest.status} = 'ordered')::int`,
    })
    .from(workRequest)
    .innerJoin(workOrder, eq(workOrder.id, workRequest.workOrderId))
    .where(openOrder)
  const r = counts!

  const fields = {
    id: workRequest.id,
    title: workRequest.title,
    kind: workRequest.kind,
    urgency: workRequest.urgency,
    status: workRequest.status,
    partsNet: workRequest.partsNet,
    laborNet: workRequest.laborNet,
    vatRate: workRequest.vatRate,
    createdAt: workRequest.createdAt,
    reporterName: user.name,
    order: { id: workOrder.id, number: workOrder.number },
    vehicle: vehicleFields,
  }
  const list = (where: SQL | undefined) => tx
    .select(fields)
    .from(workRequest)
    .innerJoin(workOrder, eq(workOrder.id, workRequest.workOrderId))
    .innerJoin(vehicle, eq(vehicle.id, workOrder.vehicleId))
    .leftJoin(user, eq(user.id, workRequest.reportedBy))
    .where(and(openOrder, where))
    .orderBy(
      asc(sql`case ${workRequest.urgency} when 'urgent' then 0 when 'recommended' then 1 else 2 end`),
      asc(workRequest.createdAt),
    )
    .limit(limit)
  const withGross = <T extends { partsNet: string | null, laborNet: string | null, vatRate: string }>(rows: T[]) =>
    rows.map(({ partsNet, laborNet, vatRate, ...row }) => ({ ...row, grossCents: grossCents(partsNet, laborNet, vatRate) }))

  return {
    open: { count: r.open, urgent: r.urgent, items: r.open ? withGross(await list(eq(workRequest.status, 'open'))) : [] },
    quoted: {
      count: r.quoted,
      items: r.quoted ? withGross(await list(and(eq(workRequest.status, 'quoted'), sql`not ${sentToCustomer}`))) : [],
    },
    parts: {
      toOrder: r.partsToOrder,
      ordered: r.partsOrdered,
      items: r.partsToOrder || r.partsOrdered
        ? withGross(await list(or(
            and(eq(workRequest.kind, 'part'), eq(workRequest.status, 'approved')),
            eq(workRequest.status, 'ordered'),
          )))
        : [],
    },
  }
}

/** Prośby o akceptację w otwartych zleceniach: odpowiedzi klientów, wygasłe linki i te, na które czekamy. */
async function loadApprovalAttention(tx: Tx, estimates: boolean, limit: number) {
  const scope = and(
    notInArray(workOrder.status, [...CLOSED_ORDER]),
    estimates ? undefined : ne(approvalRequest.kind, 'estimate'),
  )
  // Wygasła prośba przestaje być sprawą do załatwienia, gdy biuro wysłało już nowszą tego samego rodzaju
  const superseded = sql`exists (
    select 1 from approval_request newer
    where newer.work_order_id = ${approvalRequest.workOrderId} and newer.kind = ${approvalRequest.kind}
      and newer.created_at > ${approvalRequest.createdAt}
  )`
  const active = sql`${approvalRequest.status} = 'pending' and ${approvalRequest.expiresAt} > now()`
  const expired = sql`${approvalRequest.status} = 'pending' and ${approvalRequest.expiresAt} <= now() and not ${superseded}`
  const answered = sql`${approvalRequest.status} = 'answered' and ${approvalRequest.answeredAt} > now() - interval '48 hours'`

  const [counts] = await tx
    .select({
      waiting: sql<number>`count(*) filter (where ${active})::int`,
      notViewed: sql<number>`count(*) filter (where ${active} and ${approvalRequest.viewedAt} is null)::int`,
      expired: sql<number>`count(*) filter (where ${expired})::int`,
      answered: sql<number>`count(*) filter (where ${answered})::int`,
    })
    .from(approvalRequest)
    .innerJoin(workOrder, eq(workOrder.id, approvalRequest.workOrderId))
    .where(scope)
  const a = counts!

  const list = (where: SQL, orderBy: SQL) => tx
    .select({
      id: approvalRequest.id,
      kind: approvalRequest.kind,
      decision: approvalRequest.decision,
      createdAt: approvalRequest.createdAt,
      expiresAt: approvalRequest.expiresAt,
      viewedAt: approvalRequest.viewedAt,
      answeredAt: approvalRequest.answeredAt,
      totalGrossCents: sql<number>`(${approvalRequest.snapshot}->>'totalGrossCents')::int`,
      approvedItems: sql<number>`(select count(*) from approval_item ai where ai.approval_id = ${approvalRequest.id} and ai.decision = 'approved')::int`,
      rejectedItems: sql<number>`(select count(*) from approval_item ai where ai.approval_id = ${approvalRequest.id} and ai.decision = 'rejected')::int`,
      order: { id: workOrder.id, number: workOrder.number },
      vehicle: vehicleFields,
    })
    .from(approvalRequest)
    .innerJoin(workOrder, eq(workOrder.id, approvalRequest.workOrderId))
    .innerJoin(vehicle, eq(vehicle.id, workOrder.vehicleId))
    .where(and(scope, where))
    .orderBy(orderBy)
    .limit(limit)

  return {
    answered: { count: a.answered, items: a.answered ? await list(answered, desc(approvalRequest.answeredAt)) : [] },
    expired: { count: a.expired, items: a.expired ? await list(expired, asc(approvalRequest.expiresAt)) : [] },
    waiting: {
      count: a.waiting,
      notViewed: a.notViewed,
      items: a.waiting ? await list(active, asc(approvalRequest.createdAt)) : [],
    },
  }
}

/** Zlecenia do zaplanowania: bez żadnego zadania albo z zadaniami, których nikt nie wykonuje. */
async function loadPlanning(tx: Tx, planTasks: boolean, planAssign: boolean, limit: number) {
  const taskCount = sql<number>`(select count(*) from task t where t.work_order_id = ${workOrder.id} and t.status <> 'cancelled')::int`
  const unassigned = sql<number>`(
    select count(*) from task t
    where t.work_order_id = ${workOrder.id} and t.parent_id is null and t.status in ('todo', 'paused')
      and not exists (select 1 from task_assignment ta where ta.task_id = t.id)
  )::int`
  const scope = and(
    inArray(workOrder.status, [...UNFINISHED_ORDER]),
    or(
      planTasks ? sql`${taskCount} = 0` : undefined,
      planAssign ? sql`${unassigned} > 0` : undefined,
    ),
  )
  const [counts] = await tx
    .select({
      count: sql<number>`count(*)::int`,
      noTasks: sql<number>`count(*) filter (where ${taskCount} = 0)::int`,
      unassignedTasks: sql<number>`coalesce(sum(${unassigned}), 0)::int`,
    })
    .from(workOrder)
    .where(scope)
  const items = counts!.count
    ? await tx
        .select({ ...orderFields, taskCount, unassigned })
        .from(workOrder)
        .innerJoin(vehicle, eq(vehicle.id, workOrder.vehicleId))
        .innerJoin(customer, eq(customer.id, workOrder.customerId))
        .where(scope)
        .orderBy(sql`${workOrder.promisedAt} asc nulls last`, asc(workOrder.receivedAt))
        .limit(limit)
    : []
  return {
    count: counts!.count,
    noTasks: counts!.noTasks,
    unassignedTasks: planAssign ? counts!.unassignedTasks : 0,
    items: items.map(({ taskCount: tasks, ...row }) => ({ ...row, reason: tasks === 0 ? 'noTasks' as const : 'unassigned' as const })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Zespół przy pracy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mechanicy i osoby, które dziś pracowały: kto teraz przy czym pracuje, czas pracy dziś, zadania w kolejce.
 * Tabele członkostwa nie mają RLS, dlatego filtrujemy je jawnie po organizacji.
 */
export async function loadTeamNow(tx: Tx, orgId: string, timezone: string) {
  const { dayStart } = periodBounds(timezone)
  const people = await tx
    .select({ id: member.userId, name: user.name, role: member.role })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, orgId))
    .orderBy(asc(user.name))
  const running = await tx
    .select({
      userId: timeEntry.userId,
      startedAt: timeEntry.startedAt,
      task: { id: task.id, title: task.title },
      order: { id: workOrder.id, number: workOrder.number },
      vehicle: vehicleFields,
    })
    .from(timeEntry)
    .innerJoin(task, eq(task.id, timeEntry.taskId))
    .innerJoin(workOrder, eq(workOrder.id, timeEntry.workOrderId))
    .innerJoin(vehicle, eq(vehicle.id, workOrder.vehicleId))
    .where(isNull(timeEntry.endedAt))
  const today = await tx
    .select({
      userId: timeEntry.userId,
      seconds: sql<number>`coalesce(sum(extract(epoch from coalesce(${timeEntry.endedAt}, now()) - greatest(${timeEntry.startedAt}, ${dayStart}))), 0)::int`,
    })
    .from(timeEntry)
    .where(sql`coalesce(${timeEntry.endedAt}, now()) > ${dayStart}`)
    .groupBy(timeEntry.userId)
  const queue = await tx
    .select({ userId: taskAssignment.userId, tasks: sql<number>`count(*)::int` })
    .from(taskAssignment)
    .innerJoin(task, eq(task.id, taskAssignment.taskId))
    .innerJoin(workOrder, eq(workOrder.id, task.workOrderId))
    .where(and(inArray(task.status, ['todo', 'in_progress', 'paused']), notInArray(workOrder.status, [...CLOSED_ORDER])))
    .groupBy(taskAssignment.userId)

  return people
    .map(person => ({
      id: person.id,
      name: person.name,
      roles: parseRoles(person.role),
      running: running.find(r => r.userId === person.id) ?? null,
      secondsToday: today.find(r => r.userId === person.id)?.seconds ?? 0,
      queue: queue.find(r => r.userId === person.id)?.tasks ?? 0,
    }))
    .filter(p => p.roles.includes('mechanic') || p.running || p.secondsToday > 0 || p.queue > 0)
    .sort((a, b) => Number(!!b.running) - Number(!!a.running) || a.name.localeCompare(b.name, 'pl'))
}

// ─────────────────────────────────────────────────────────────────────────────
// Właściciel: wyniki miesiąca
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wyniki od początku miesiąca w porównaniu z tym samym okresem poprzedniego miesiąca.
 * Wartość zleceń to suma kosztorysów zamkniętych zleceń (brutto) – liczona tą samą funkcją co kosztorys,
 * co do grosza. Faktury dojdą z integracją (E4.6); do tego czasu kosztorys jest najlepszą miarą przychodu.
 */
export async function loadOwnerReport(tx: Tx, timezone: string) {
  const p = periodBounds(timezone)
  const closed = await tx
    .select({
      id: workOrder.id,
      receivedAt: workOrder.receivedAt,
      closedAt: workOrder.closedAt,
      current: sql<boolean>`${workOrder.closedAt} >= ${p.monthStart}`,
    })
    .from(workOrder)
    .where(and(
      eq(workOrder.status, 'closed'),
      gte(workOrder.closedAt, p.prevMonthStart),
      or(gte(workOrder.closedAt, p.monthStart), lt(workOrder.closedAt, p.monthAgo)),
    ))
  const current = closed.filter(o => o.current)
  const previous = closed.filter(o => !o.current)

  const lines = closed.length
    ? await tx
        .select({
          workOrderId: estimateItem.workOrderId,
          quantity: estimateItem.quantity,
          unitPriceNet: estimateItem.unitPriceNet,
          discountPercent: estimateItem.discountPercent,
          vatRate: estimateItem.vatRate,
        })
        .from(estimateItem)
        .where(inArray(estimateItem.workOrderId, closed.map(o => o.id)))
    : []
  const grossByOrder = new Map<string, number>()
  for (const line of lines) {
    grossByOrder.set(line.workOrderId, (grossByOrder.get(line.workOrderId) ?? 0) + estimateLine(line).grossCents)
  }
  const sumGross = (rows: typeof closed) => rows.reduce((sum, o) => sum + (grossByOrder.get(o.id) ?? 0), 0)

  // Zlecenia z cyfrową akceptacją klienta (kryterium pilotażu): co najmniej jedna odpowiedź przez link
  const digital = current.length
    ? await tx
        .selectDistinct({ workOrderId: approvalRequest.workOrderId })
        .from(approvalRequest)
        .where(and(inArray(approvalRequest.workOrderId, current.map(o => o.id)), eq(approvalRequest.status, 'answered')))
    : []

  const leadHours = current.length
    ? current.reduce((sum, o) => sum + (o.closedAt!.getTime() - o.receivedAt.getTime()), 0) / current.length / 3_600_000
    : null

  // Prace dodatkowe, o których zdecydowano w tym miesiącu (przez biuro albo klienta przez link)
  const decided = await tx
    .select({
      status: workRequest.status,
      partsNet: workRequest.partsNet,
      laborNet: workRequest.laborNet,
      vatRate: workRequest.vatRate,
    })
    .from(workRequest)
    .where(and(
      eq(workRequest.kind, 'extra_work'),
      inArray(workRequest.status, ['approved', 'done', 'rejected']),
      gte(workRequest.decidedAt, p.monthStart),
    ))
  const approved = decided.filter(r => r.status !== 'rejected')

  const [time] = await tx
    .select({
      seconds: sql<number>`coalesce(sum(extract(epoch from coalesce(${timeEntry.endedAt}, now()) - greatest(${timeEntry.startedAt}, ${p.monthStart}))), 0)::int`,
      people: sql<number>`count(distinct ${timeEntry.userId})::int`,
    })
    .from(timeEntry)
    .where(sql`coalesce(${timeEntry.endedAt}, now()) > ${p.monthStart}`)
  const tasksDone = await tx.$count(task, and(eq(task.status, 'done'), gte(task.completedAt, p.monthStart)))

  return {
    closedOrders: {
      count: current.length,
      previousCount: previous.length,
      grossCents: sumGross(current),
      previousGrossCents: sumGross(previous),
      withoutEstimate: current.filter(o => !grossByOrder.get(o.id)).length,
      digitalApproval: digital.length,
      averageLeadHours: leadHours === null ? null : Math.round(leadHours * 10) / 10,
    },
    extraWork: {
      approved: approved.length,
      rejected: decided.length - approved.length,
      approvedGrossCents: approved.reduce((sum, r) => sum + grossCents(r.partsNet, r.laborNet, r.vatRate), 0),
    },
    work: {
      seconds: time?.seconds ?? 0,
      people: time?.people ?? 0,
      tasksDone,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Konfiguracja warsztatu
// ─────────────────────────────────────────────────────────────────────────────

export const SETUP_STEPS = ['company', 'laborRate', 'priceList', 'team', 'firstOrder'] as const
export type SetupStep = (typeof SETUP_STEPS)[number]

/** Kroki potrzebne do pracy z klientem: dane firmy na kosztorysie, stawka, cennik, zespół, pierwsze zlecenie. */
export async function loadSetupChecklist(tx: Tx, orgId: string, solo: boolean) {
  const [profile] = await tx
    .select({
      legalName: companyProfile.legalName,
      taxId: companyProfile.taxId,
      city: companyProfile.city,
      laborRateNet: companyProfile.laborRateNet,
    })
    .from(companyProfile)
    .limit(1)
  const services = await tx.$count(servicePrice, isNull(servicePrice.archivedAt))
  const orders = await tx.$count(workOrder)
  const members = solo ? 1 : await tx.$count(member, eq(member.organizationId, orgId))
  const invites = solo
    ? 0
    : await tx.$count(invitation, and(
        eq(invitation.organizationId, orgId),
        eq(invitation.status, 'pending'),
        gt(invitation.expiresAt, sql`now()`),
      ))

  const done: Record<SetupStep, boolean> = {
    company: !!(profile?.legalName && profile.taxId && profile.city),
    laborRate: profile?.laborRateNet != null,
    priceList: services > 0,
    team: members > 1 || invites > 0,
    firstOrder: orders > 0,
  }
  const steps = SETUP_STEPS
    .filter(key => !(solo && key === 'team'))
    .map(key => ({ key, done: done[key] }))
  return { steps, completed: steps.filter(s => s.done).length, total: steps.length }
}
