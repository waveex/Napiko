/**
 * Zadanie „Wydanie auta”: dokładane, gdy wszystkie zadania robocze są zrobione, wycofywane, gdy praca wraca,
 * kończone razem ze zleceniem; nie wpływa na postęp prac ani na powiadomienie „wszystkie zadania zakończone”.
 */
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, asc, eq } from 'drizzle-orm'
import { auditEvent, customer, notification, task, vehicle, workOrder } from '../../server/db/schema'
import { withTenant } from '../../server/db/tenant'
import { allTasksDone } from '../../server/db/notifications'
import { applyTaskStatus, completeHandoverOnClose, syncHandoverTask, type OrderRef } from '../../server/utils/task-status'
import { HANDOVER_TASK_TITLE, type TaskStatus } from '../../shared/workshop'
import { addMember, createMemberWithOrg, createTestDb, pgErrorMessage } from '../helpers'

const { db, pool } = createTestDb()
type Ctx = { userId: string, orgId: string }
const meta = { ip: null, userAgent: null }
let office: Ctx
let officeColleague: Ctx
let sequence = 0

beforeAll(async () => {
  office = await createMemberWithOrg(db, { role: 'office' })
  officeColleague = await addMember(db, office.orgId, 'office')
})

afterAll(async () => {
  await pool.end()
})

/** Zlecenie z zadaniami o podanych statusach (kolejność = pozycja). */
async function seedOrder(statuses: TaskStatus[]) {
  sequence += 1
  return withTenant(db, office, async (tx) => {
    const [c] = await tx.insert(customer).values({ orgId: office.orgId, name: 'Jan Klient' }).returning()
    const [v] = await tx.insert(vehicle).values({ orgId: office.orgId, customerId: c!.id, type: 'car', make: 'Fiat', model: 'Panda' }).returning()
    const [o] = await tx.insert(workOrder).values({
      orgId: office.orgId, number: `ZL/H/${sequence}`, customerId: c!.id, vehicleId: v!.id, status: 'in_progress',
    }).returning()
    const tasks = statuses.length
      ? await tx.insert(task).values(statuses.map((status, position) => ({
          orgId: office.orgId, workOrderId: o!.id, title: `Praca ${position + 1}`, status, position,
        }))).returning()
      : []
    return { order: { id: o!.id, number: o!.number, status: o!.status } as OrderRef, tasks }
  })
}

function tasksOf(orderId: string) {
  return withTenant(db, office, tx => tx.select().from(task).where(eq(task.workOrderId, orderId)).orderBy(asc(task.position)))
}

async function handoverOf(orderId: string) {
  return (await tasksOf(orderId)).filter(t => t.kind === 'handover')
}

/** Zmiana statusu zadania tą samą ścieżką co aplikacja (zob. applyTaskStatus). */
function setStatus(order: OrderRef, taskId: string, status: TaskStatus, ctx: Ctx = office) {
  return withTenant(db, ctx, async (tx) => {
    const [row] = await tx.select().from(task).where(eq(task.id, taskId)).limit(1)
    await applyTaskStatus(tx, ctx, row!, order, status, meta)
  })
}

describe('dokładanie zadania „Wydanie auta”', () => {
  it('zakończenie ostatniego zadania dokłada jedno wydanie na końcu listy', async () => {
    const { order, tasks } = await seedOrder(['done', 'todo'])
    expect(await handoverOf(order.id)).toHaveLength(0)

    await setStatus(order, tasks[1]!.id, 'done')

    const all = await tasksOf(order.id)
    expect(all.map(t => t.title)).toEqual(['Praca 1', 'Praca 2', HANDOVER_TASK_TITLE])
    expect(all[2]).toMatchObject({ kind: 'handover', status: 'todo', parentId: null, position: 2 })
    const events = await withTenant(db, office, tx => tx.select().from(auditEvent)
      .where(and(eq(auditEvent.entityId, all[2]!.id), eq(auditEvent.action, 'task.created'))))
    expect(events).toHaveLength(1)
    expect(events[0]!.data).toMatchObject({ number: order.number, kind: 'handover', automatic: true })
  })

  it('nie dokłada wydania, dopóki jakieś zadanie jest niezrobione (anulowane się nie liczą)', async () => {
    const { order, tasks } = await seedOrder(['todo', 'todo', 'cancelled'])
    await setStatus(order, tasks[0]!.id, 'done')
    expect(await handoverOf(order.id)).toHaveLength(0)
    await setStatus(order, tasks[1]!.id, 'done')
    expect(await handoverOf(order.id)).toHaveLength(1)
  })

  it('ponowne zakończenia i zmiany statusów nie dublują wydania', async () => {
    const { order, tasks } = await seedOrder(['todo'])
    await setStatus(order, tasks[0]!.id, 'done')
    await withTenant(db, office, tx => syncHandoverTask(tx, office, order, meta))
    await withTenant(db, office, tx => syncHandoverTask(tx, office, order, meta))
    expect(await handoverOf(order.id)).toHaveLength(1)
  })

  it('zlecenie bez zadań ani zamknięte nie dostaje wydania', async () => {
    const empty = await seedOrder([])
    await withTenant(db, office, tx => syncHandoverTask(tx, office, empty.order, meta))
    expect(await handoverOf(empty.order.id)).toHaveLength(0)

    const done = await seedOrder(['done'])
    await withTenant(db, office, tx => syncHandoverTask(tx, office, { ...done.order, status: 'closed' }, meta))
    expect(await handoverOf(done.order.id)).toHaveLength(0)
  })
})

describe('wycofywanie i zachowanie wydania', () => {
  it('wróć do pracy: cofnięcie zadania albo nowe zadanie wycofuje nietknięte wydanie', async () => {
    const { order, tasks } = await seedOrder(['todo'])
    await setStatus(order, tasks[0]!.id, 'done')
    expect(await handoverOf(order.id)).toHaveLength(1)

    await setStatus(order, tasks[0]!.id, 'in_progress')
    expect(await handoverOf(order.id)).toHaveLength(0)

    await setStatus(order, tasks[0]!.id, 'done')
    expect(await handoverOf(order.id)).toHaveLength(1)

    await withTenant(db, office, async (tx) => {
      await tx.insert(task).values({ orgId: office.orgId, workOrderId: order.id, title: 'Dodatkowa praca', position: 5 })
      await syncHandoverTask(tx, office, order, meta)
    })
    expect(await handoverOf(order.id)).toHaveLength(0)
  })

  it('wydanie, którym ktoś się zajął, zostaje; anulowanego nie dokładamy ponownie', async () => {
    const { order, tasks } = await seedOrder(['todo'])
    await setStatus(order, tasks[0]!.id, 'done')
    const [handover] = await handoverOf(order.id)

    // wydanie rozpoczęte → praca wróciła, ale wydania nie ruszamy
    await setStatus(order, handover!.id, 'in_progress')
    await setStatus(order, tasks[0]!.id, 'paused')
    expect(await handoverOf(order.id)).toHaveLength(1)

    // anulowane wydanie nie wraca po kolejnym zakończeniu prac
    await setStatus(order, handover!.id, 'cancelled')
    await setStatus(order, tasks[0]!.id, 'done')
    expect(await handoverOf(order.id)).toMatchObject([{ id: handover!.id, status: 'cancelled' }])
  })

  it('wycofanie wydania trafia do dziennika zdarzeń jako działanie automatyczne', async () => {
    const { order, tasks } = await seedOrder(['todo'])
    await setStatus(order, tasks[0]!.id, 'done')
    const [handover] = await handoverOf(order.id)
    await setStatus(order, tasks[0]!.id, 'todo')
    const events = await withTenant(db, office, tx => tx.select().from(auditEvent)
      .where(and(eq(auditEvent.entityId, handover!.id), eq(auditEvent.action, 'task.deleted'))))
    expect(events).toHaveLength(1)
    expect(events[0]!.data).toMatchObject({ kind: 'handover', automatic: true })
  })
})

describe('wydanie a postęp prac i powiadomienia', () => {
  it('allTasksDone pomija wydanie – zlecenie z samym wydaniem do zrobienia ma prace zakończone', async () => {
    const { order, tasks } = await seedOrder(['todo'])
    expect(await withTenant(db, office, tx => allTasksDone(tx, order.id))).toBe(false)
    await setStatus(order, tasks[0]!.id, 'done')
    expect(await handoverOf(order.id)).toHaveLength(1)
    expect(await withTenant(db, office, tx => allTasksDone(tx, order.id))).toBe(true)
  })

  it('biuro dostaje powiadomienie o końcu prac raz – zrobienie wydania go nie powtarza', async () => {
    const { order, tasks } = await seedOrder(['todo'])
    const count = () => withTenant(db, officeColleague, tx => tx.select().from(notification)
      .where(and(eq(notification.workOrderId, order.id), eq(notification.type, 'work_order.tasks_completed')))).then(r => r.length)

    await setStatus(order, tasks[0]!.id, 'done')
    expect(await count()).toBe(1)

    const [handover] = await handoverOf(order.id)
    await setStatus(order, handover!.id, 'in_progress')
    await setStatus(order, handover!.id, 'done')
    expect(await count()).toBe(1)
    expect(await handoverOf(order.id)).toMatchObject([{ status: 'done' }])
  })
})

describe('zamknięcie zlecenia', () => {
  it('kończy otwarte wydanie (pojazd został odebrany)', async () => {
    const { order, tasks } = await seedOrder(['todo'])
    await setStatus(order, tasks[0]!.id, 'done')
    await withTenant(db, office, tx => completeHandoverOnClose(tx, office, { ...order, status: 'closed' }, meta))
    const [handover] = await handoverOf(order.id)
    expect(handover).toMatchObject({ status: 'done' })
    expect(handover!.completedAt).toBeInstanceOf(Date)
  })

  it('nie rusza anulowanego wydania ani zlecenia bez wydania', async () => {
    const { order, tasks } = await seedOrder(['todo'])
    await setStatus(order, tasks[0]!.id, 'done')
    const [handover] = await handoverOf(order.id)
    await setStatus(order, handover!.id, 'cancelled')
    await withTenant(db, office, tx => completeHandoverOnClose(tx, office, { ...order, status: 'closed' }, meta))
    expect(await handoverOf(order.id)).toMatchObject([{ status: 'cancelled' }])

    const other = await seedOrder(['todo'])
    await withTenant(db, office, tx => completeHandoverOnClose(tx, office, { ...other.order, status: 'closed' }, meta))
    expect(await handoverOf(other.order.id)).toHaveLength(0)
  })
})

describe('reguły w bazie', () => {
  it('zlecenie ma co najwyżej jedno wydanie, a wydanie nie ma zadania nadrzędnego', async () => {
    const { order, tasks } = await seedOrder(['todo'])
    await setStatus(order, tasks[0]!.id, 'done')
    const [handover] = await handoverOf(order.id)

    const duplicate = await pgErrorMessage(withTenant(db, office, tx => tx.insert(task).values({
      orgId: office.orgId, workOrderId: order.id, kind: 'handover', title: HANDOVER_TASK_TITLE,
    })))
    expect(duplicate).toContain('task_handover_per_order_uq')

    const other = await seedOrder(['todo'])
    const child = await pgErrorMessage(withTenant(db, office, tx => tx.insert(task).values({
      orgId: office.orgId, workOrderId: order.id, parentId: tasks[0]!.id, kind: 'handover', title: HANDOVER_TASK_TITLE,
    })))
    expect(child).toContain('task_handover_top_level_check')

    const unknown = await pgErrorMessage(withTenant(db, office, tx => tx.insert(task).values({
      orgId: office.orgId, workOrderId: other.order.id, kind: 'inne' as 'work', title: 'X',
    })))
    expect(unknown).toContain('task_kind_check')
    expect(handover).toBeTruthy()
  })

  it('migracja uzupełnia wydanie w otwartych zleceniach z zakończonymi pracami', async () => {
    const finished = await seedOrder(['done', 'cancelled'])
    const working = await seedOrder(['done', 'todo'])
    const closed = await seedOrder(['done'])
    await withTenant(db, office, tx => tx.update(workOrder).set({ status: 'closed' }).where(eq(workOrder.id, closed.order.id)))

    const sql = await readFile('netlify/database/migrations/20261008100000_handover-task/migration.sql', 'utf8')
    const backfill = sql.slice(sql.indexOf('DO $$'))
    expect(backfill).toContain('INSERT INTO public.task')
    await pool.query(backfill)

    expect(await handoverOf(finished.order.id)).toMatchObject([{ status: 'todo', position: 2 }])
    expect(await handoverOf(working.order.id)).toHaveLength(0)
    expect(await handoverOf(closed.order.id)).toHaveLength(0)
  })
})
