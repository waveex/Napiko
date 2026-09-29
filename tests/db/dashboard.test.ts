/**
 * Pulpit: liczniki i listy dla biura, mechanika i właściciela liczone w bazie – z izolacją warsztatów,
 * granicami dnia i miesiąca w strefie czasowej warsztatu i kwotami zgodnymi co do grosza z kosztorysem.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import {
  approvalItem, approvalRequest, companyProfile, customer, estimateItem, servicePrice, task, taskAssignment,
  timeEntry, vehicle, workOrder, workRequest, type ApprovalSnapshot,
} from '../../server/db/schema'
import { withTenant } from '../../server/db/tenant'
import {
  loadMyReportedRequests, loadOfficeOverview, loadOwnerReport, loadSecondsToday, loadSetupChecklist, loadTeamNow, periodBounds,
} from '../../server/utils/dashboard'
import { hasPermission } from '../../shared/permissions'
import { estimateLine, grossCents, type WorkOrderStatus } from '../../shared/workshop'
import { addMember, createMemberWithOrg, createTestDb } from '../helpers'

const { db, pool } = createTestDb()
type Ctx = { userId: string, orgId: string }
const TZ = 'Europe/Warsaw'
const HOUR = 3_600_000

let owner: Ctx
let mechanic: Ctx
let other: Ctx
/** Chwile z zegara bazy: teraz, początek dnia i granice okresów miesięcznych w strefie warsztatu. */
let clock: { now: Date, dayStart: Date, monthStart: Date, prevMonthStart: Date, monthAgo: Date }

const snapshot: ApprovalSnapshot = {
  version: 1,
  organization: { name: 'Test' },
  order: { number: 'ZL/T/1' },
  vehicle: { type: 'car', make: null, model: null, registrationNumber: null },
  message: null,
  currency: 'PLN',
  items: [],
  totalGrossCents: 12300,
  createdAt: new Date().toISOString(),
}
let token = 0
function approval(ctx: Ctx, workOrderId: string, values: Partial<typeof approvalRequest.$inferInsert> = {}) {
  token += 1
  return {
    orgId: ctx.orgId,
    workOrderId,
    tokenHash: `token-${ctx.orgId}-${token}`,
    channel: 'link' as const,
    snapshot,
    snapshotHash: 'x',
    expiresAt: new Date(clock.now.getTime() + 24 * HOUR),
    ...values,
  }
}

async function order(ctx: Ctx, number: string, values: Partial<typeof workOrder.$inferInsert> & { status?: WorkOrderStatus } = {}) {
  return withTenant(db, ctx, async (tx) => {
    const [c] = await tx.insert(customer).values({ orgId: ctx.orgId, name: `Klient ${number}` }).returning()
    const [v] = await tx.insert(vehicle).values({ orgId: ctx.orgId, customerId: c!.id, type: 'car', make: 'Skoda', registrationNumber: number.replace(/\W/g, '') }).returning()
    const [o] = await tx.insert(workOrder).values({ orgId: ctx.orgId, number, customerId: c!.id, vehicleId: v!.id, ...values }).returning()
    return o!
  })
}

const at = (base: Date, ms: number) => new Date(base.getTime() + ms)

let overdue: typeof workOrder.$inferSelect
let active: typeof workOrder.$inferSelect
let ready: typeof workOrder.$inferSelect
let closedNow: typeof workOrder.$inferSelect
let closedBefore: typeof workOrder.$inferSelect
let closedOld: typeof workOrder.$inferSelect
let mechanicTask: typeof task.$inferSelect
const lines = [
  { quantity: '1', unitPriceNet: '199.99', discountPercent: '0', vatRate: '23' },
  { quantity: '2.5', unitPriceNet: '80.10', discountPercent: '10', vatRate: '23' },
  { quantity: '1', unitPriceNet: '0.05', discountPercent: '0', vatRate: '8' },
]

beforeAll(async () => {
  owner = await createMemberWithOrg(db)
  mechanic = await addMember(db, owner.orgId, 'mechanic')
  other = await createMemberWithOrg(db)

  const [row] = await withTenant(db, owner, (tx) => {
    const p = periodBounds(TZ)
    return tx.execute<{ now: string, day_start: string, month_start: string, prev_month_start: string, month_ago: string }>(sql`
      select now() as now, ${p.dayStart} as day_start, ${p.monthStart} as month_start,
             ${p.prevMonthStart} as prev_month_start, ${p.monthAgo} as month_ago
    `).then(r => r.rows)
  })
  clock = {
    now: new Date(row!.now),
    dayStart: new Date(row!.day_start),
    monthStart: new Date(row!.month_start),
    prevMonthStart: new Date(row!.prev_month_start),
    monthAgo: new Date(row!.month_ago),
  }

  // Po terminie (przyjęte, bez zadań), w realizacji (zadania i zgłoszenia), gotowe na dziś
  overdue = await order(owner, 'ZL/T/1', { promisedAt: at(clock.dayStart, -2 * HOUR) })
  active = await order(owner, 'ZL/T/2', { status: 'in_progress', promisedAt: at(clock.now, 72 * HOUR) })
  ready = await order(owner, 'ZL/T/3', { status: 'ready', promisedAt: clock.now })
  // Zamknięte: w tym miesiącu, w tym samym okresie poprzedniego miesiąca i wcześniej (poza porównaniem)
  closedNow = await order(owner, 'ZL/T/4', { status: 'closed', receivedAt: at(clock.now, -30 * HOUR), closedAt: clock.now })
  closedBefore = await order(owner, 'ZL/T/5', {
    status: 'closed',
    receivedAt: at(clock.prevMonthStart, -HOUR),
    closedAt: new Date((clock.prevMonthStart.getTime() + clock.monthAgo.getTime()) / 2),
  })
  closedOld = await order(owner, 'ZL/T/6', { status: 'closed', closedAt: at(clock.prevMonthStart, -HOUR) })
  // Drugi warsztat: to samo zlecenie po terminie nie może trafić do liczników pierwszego
  await order(other, 'ZL/T/1', { promisedAt: at(clock.now, -2 * HOUR) })

  await withTenant(db, owner, async (tx) => {
    const [t1] = await tx.insert(task).values({ orgId: owner.orgId, workOrderId: active.id, title: 'Klocki przód' }).returning()
    await tx.insert(task).values({ orgId: owner.orgId, workOrderId: active.id, title: 'Bez wykonawcy', position: 1 })
    await tx.insert(task).values({ orgId: owner.orgId, workOrderId: closedNow.id, title: 'Zrobione', status: 'done', completedAt: clock.now })
    await tx.insert(taskAssignment).values({ orgId: owner.orgId, taskId: t1!.id, userId: mechanic.userId })
    mechanicTask = t1!

    const request = (values: Partial<typeof workRequest.$inferInsert>) => ({
      orgId: owner.orgId, workOrderId: active.id, reportedBy: mechanic.userId, title: 'Zgłoszenie', ...values,
    })
    await tx.insert(workRequest).values([
      request({ title: 'Pilne – wyciek', urgency: 'urgent' }),
      request({ title: 'Wycenione, nie wysłane', status: 'quoted', laborNet: '100.00' }),
      request({ title: 'Część zatwierdzona', kind: 'part', status: 'approved', partsNet: '50.00' }),
      request({ title: 'Część zamówiona', kind: 'part', status: 'ordered', partsNet: '20.00' }),
      request({ title: 'Anulowane', status: 'cancelled' }),
      // w zamkniętym zleceniu nic już nie da się zrobić – nie liczymy (i nie jest to nowość dla mechanika)
      request({ workOrderId: closedNow.id, title: 'W zamkniętym', updatedAt: at(clock.now, -240 * HOUR) }),
      // prace dodatkowe z decyzją w tym miesiącu (sprzedaż prac dodatkowych)
      request({ workOrderId: closedNow.id, title: 'Tarcze tył', status: 'approved', partsNet: '100.00', laborNet: '50.00', vatRate: '23', decidedAt: clock.now }),
      request({ workOrderId: closedNow.id, title: 'Amortyzatory', status: 'rejected', partsNet: '900.00', decidedAt: clock.now }),
    ])
    const [sent] = await tx.insert(workRequest).values(request({ title: 'Wycenione i wysłane', status: 'quoted', laborNet: '10.00' })).returning()

    // Prośby: aktywna (nieotwarta), odpowiedź sprzed godziny, wygasła, wygasła zastąpiona nowszą, kosztorys
    const [pending] = await tx.insert(approvalRequest).values(approval(owner, active.id)).returning()
    await tx.insert(approvalItem).values({ orgId: owner.orgId, approvalId: pending!.id, workRequestId: sent!.id })
    await tx.insert(approvalRequest).values([
      approval(owner, active.id, { status: 'answered', answeredAt: at(clock.now, -HOUR), createdAt: at(clock.now, -3 * HOUR) }),
      approval(owner, overdue.id, { expiresAt: at(clock.now, -HOUR), createdAt: at(clock.now, -48 * HOUR) }),
      approval(owner, ready.id, { expiresAt: at(clock.now, -HOUR), createdAt: at(clock.now, -48 * HOUR) }),
      approval(owner, ready.id, { status: 'cancelled', createdAt: at(clock.now, -HOUR) }),
      approval(owner, ready.id, { kind: 'estimate', createdAt: at(clock.now, -HOUR) }),
      approval(owner, closedNow.id, { status: 'answered', answeredAt: at(clock.now, -2 * HOUR), kind: 'estimate', decision: 'approved' }),
    ])

    await tx.insert(estimateItem).values([
      ...lines.map((line, i) => ({ orgId: owner.orgId, workOrderId: closedNow.id, name: `Pozycja ${i}`, ...line })),
      { orgId: owner.orgId, workOrderId: closedBefore.id, name: 'Poprzednio', unitPriceNet: '100.00' },
      { orgId: owner.orgId, workOrderId: closedOld.id, name: 'Dawno', unitPriceNet: '1000.00' },
    ])

    // Czas pracy mechanika: wpis przez północ, zakończony dziś i trwający od 10 minut
    await tx.insert(timeEntry).values([
      { orgId: owner.orgId, taskId: t1!.id, workOrderId: active.id, userId: mechanic.userId, startedAt: at(clock.dayStart, -30 * 60_000), endedAt: at(clock.dayStart, 30 * 60_000) },
      { orgId: owner.orgId, taskId: t1!.id, workOrderId: active.id, userId: mechanic.userId, startedAt: at(clock.now, -3 * HOUR), endedAt: at(clock.now, -2 * HOUR) },
      { orgId: owner.orgId, taskId: t1!.id, workOrderId: active.id, userId: mechanic.userId, startedAt: at(clock.now, -10 * 60_000) },
    ])
  })
})

afterAll(async () => {
  await pool.end()
})

const office = (ctx: Ctx, overrides: Partial<Parameters<typeof loadOfficeOverview>[1]> = {}) =>
  withTenant(db, ctx, tx => loadOfficeOverview(tx, {
    timezone: TZ, requests: true, approvals: true, estimates: true, planTasks: true, planAssign: true, ...overrides,
  }))

/** Czas wpisu przypadający na dziś – ta sama reguła co w bazie, liczona w teście niezależnie. */
function todayPart(start: Date, end: Date | null, now: Date) {
  const from = Math.max(start.getTime(), clock.dayStart.getTime())
  const to = (end ?? now).getTime()
  return Math.max(0, to - from) / 1000
}

describe('biuro', () => {
  it('liczy zlecenia na tablicy, po terminie i gotowe do odbioru', async () => {
    const o = await office(owner)
    expect(o.board).toEqual({ received: 1, in_progress: 1, waiting_approval: 0, waiting_parts: 0, ready: 1 })
    expect(o.overdue.count).toBe(1)
    expect(o.overdue.items.map(i => i.number)).toEqual(['ZL/T/1'])
    expect(o.ready.items[0]).toMatchObject({ number: 'ZL/T/3', customerName: 'Klient ZL/T/3' })
    expect(o.today.due).toBe(1)
    expect(o.today.orders.map(i => i.number)).toEqual(['ZL/T/3'])
    expect(o.today.closed).toBe(1)
  })

  it('zgłoszenia: nowe, wycenione bez prośby do klienta i części – tylko w otwartych zleceniach', async () => {
    const r = (await office(owner)).requests!
    expect(r.open).toMatchObject({ count: 1, urgent: 1 })
    expect(r.open.items[0]).toMatchObject({ title: 'Pilne – wyciek', urgency: 'urgent', order: { number: 'ZL/T/2' } })
    expect(r.quoted.count).toBe(1)
    expect(r.quoted.items[0]).toMatchObject({ title: 'Wycenione, nie wysłane', grossCents: 12300 })
    expect(r.parts).toMatchObject({ toOrder: 1, ordered: 1 })
    expect(r.parts.items.map(i => i.title).sort()).toEqual(['Część zamówiona', 'Część zatwierdzona'])
  })

  it('prośby o akceptację: odpowiedzi, wygasłe (bez zastąpionych) i oczekujące', async () => {
    const a = (await office(owner)).approvals!
    expect(a.answered.count).toBe(1)
    expect(a.answered.items[0]).toMatchObject({ order: { number: 'ZL/T/2' }, totalGrossCents: 12300 })
    expect(a.expired.count).toBe(1)
    expect(a.expired.items[0]!.order.number).toBe('ZL/T/1')
    expect(a.waiting).toMatchObject({ count: 2, notViewed: 2 })
  })

  it('kosztorysy do akceptacji widzi tylko osoba z dostępem do rozliczeń', async () => {
    const a = (await office(owner, { estimates: false })).approvals!
    expect(a.waiting.count).toBe(1)
    expect(a.waiting.items.every(i => i.kind === 'work_requests')).toBe(true)
  })

  it('do zaplanowania: zlecenie bez zadań i zadanie bez wykonawcy', async () => {
    const plan = (await office(owner)).planning!
    expect(plan).toMatchObject({ count: 2, noTasks: 1, unassignedTasks: 1 })
    expect(plan.items.map(i => [i.number, i.reason])).toEqual([['ZL/T/1', 'noTasks'], ['ZL/T/2', 'unassigned']])
    // przy polityce „sami biorą” biuro nie przydziela – zostają tylko zlecenia bez zadań
    expect((await office(owner, { planAssign: false })).planning!.count).toBe(1)
  })

  it('sekcje bez uprawnień nie są liczone', async () => {
    const o = await office(owner, { requests: false, approvals: false, planTasks: false, planAssign: false })
    expect(o.requests).toBeNull()
    expect(o.approvals).toBeNull()
    expect(o.planning).toBeNull()
  })

  it('inny warsztat nie widzi niczego z pierwszego', async () => {
    const o = await office(other)
    expect(o.board).toEqual({ received: 1, in_progress: 0, waiting_approval: 0, waiting_parts: 0, ready: 0 })
    expect(o.requests!.open.count).toBe(0)
    expect(o.approvals!.waiting.count).toBe(0)
    expect(await withTenant(db, other, tx => loadTeamNow(tx, other.orgId, TZ))).toEqual([])
  })
})

describe('mechanik', () => {
  it('czas pracy dziś obejmuje część wpisu sprzed północy i trwający licznik', async () => {
    const [seconds, now] = await withTenant(db, mechanic, async tx => [
      await loadSecondsToday(tx, mechanic.userId, TZ),
      new Date((await tx.execute<{ now: string }>(sql`select now() as now`)).rows[0]!.now),
    ] as const)
    const expected = todayPart(at(clock.dayStart, -30 * 60_000), at(clock.dayStart, 30 * 60_000), now)
      + todayPart(at(clock.now, -3 * HOUR), at(clock.now, -2 * HOUR), now)
      + todayPart(at(clock.now, -10 * 60_000), null, now)
    expect(Math.abs(seconds - expected)).toBeLessThanOrEqual(2)
  })

  it('zgłoszone potrzeby: bez anulowanych i bez spraw z zamkniętych zleceń sprzed kilku dni', async () => {
    const rows = await withTenant(db, mechanic, tx => loadMyReportedRequests(tx, mechanic.userId, 20))
    const titles = rows.map(r => r.title)
    expect(titles).not.toContain('Anulowane')
    expect(titles).not.toContain('W zamkniętym')
    expect(titles).toContain('Pilne – wyciek')
    // decyzja sprzed chwili w zamkniętym zleceniu jest nowością dla mechanika
    expect(titles).toContain('Tarcze tył')
    expect(rows[0]).not.toHaveProperty('partsNet')
  })

  it('zespół: kto pracuje, czas dziś i zadania w kolejce', async () => {
    const team = await withTenant(db, owner, tx => loadTeamNow(tx, owner.orgId, TZ))
    expect(team).toHaveLength(1)
    expect(team[0]).toMatchObject({
      id: mechanic.userId,
      roles: ['mechanic'],
      queue: 1,
      running: { task: { id: mechanicTask.id }, order: { number: 'ZL/T/2' } },
    })
    expect(team[0]!.secondsToday).toBeGreaterThan(0)
  })
})

describe('właściciel', () => {
  it('wyniki warsztatu widzi tylko właściciel', () => {
    expect(hasPermission('owner', { report: ['read'] })).toBe(true)
    expect(hasPermission('office', { report: ['read'] })).toBe(false)
    expect(hasPermission('mechanic', { report: ['read'] })).toBe(false)
    expect(hasPermission('office,mechanic', { report: ['read'] })).toBe(false)
    expect(hasPermission('mechanic,owner', { report: ['read'] })).toBe(true)
  })

  it('wartość zamkniętych zleceń co do grosza jak kosztorys, porównanie z tym samym okresem', async () => {
    const report = await withTenant(db, owner, tx => loadOwnerReport(tx, TZ))
    const expected = lines.reduce((sum, line) => sum + estimateLine(line).grossCents, 0)
    expect(report.closedOrders).toMatchObject({
      count: 1,
      grossCents: expected,
      previousCount: 1,
      previousGrossCents: 12300,
      withoutEstimate: 0,
      digitalApproval: 1,
      averageLeadHours: 30,
    })
  })

  it('prace dodatkowe z decyzją w tym miesiącu i czas pracy zespołu', async () => {
    const report = await withTenant(db, owner, tx => loadOwnerReport(tx, TZ))
    expect(report.extraWork).toEqual({ approved: 1, rejected: 1, approvedGrossCents: grossCents('100.00', '50.00', '23') })
    expect(report.extraWork.approvedGrossCents).toBe(18450)
    expect(report.work.people).toBe(1)
    expect(report.work.seconds).toBeGreaterThan(0)
    expect(report.work.tasksDone).toBe(1)
  })

  it('konfiguracja warsztatu: kroki do uzupełnienia i ich zaliczenie', async () => {
    const before = await withTenant(db, owner, tx => loadSetupChecklist(tx, owner.orgId, false))
    expect(before.steps.filter(s => !s.done).map(s => s.key)).toEqual(['company', 'laborRate', 'priceList'])
    await withTenant(db, owner, async (tx) => {
      await tx.insert(companyProfile).values({ orgId: owner.orgId, legalName: 'Auto-Test', taxId: '5260250274', city: 'Białystok', laborRateNet: '150.00' })
      await tx.insert(servicePrice).values({ orgId: owner.orgId, name: 'Wymiana oleju', priceNet: '100.00' })
    })
    const after = await withTenant(db, owner, tx => loadSetupChecklist(tx, owner.orgId, false))
    expect(after).toMatchObject({ completed: 5, total: 5 })
    // mechanik solo nie zaprasza zespołu
    const solo = await withTenant(db, other, tx => loadSetupChecklist(tx, other.orgId, true))
    expect(solo.steps.map(s => s.key)).not.toContain('team')
  })
})
