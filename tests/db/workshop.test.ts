/**
 * Rdzeń warsztatu: numeracja zleceń, złożone klucze obce między warsztatami,
 * drzewo zadań i przypisania mechaników.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import { customer, member, task, taskAssignment, vehicle, workOrder } from '../../server/db/schema'
import { withTenant } from '../../server/db/tenant'
import type { Tx } from '../../server/db/client'
import { addMember, createMemberWithOrg, createTestDb, pgErrorMessage } from '../helpers'

const { db, pool } = createTestDb()
type Ctx = { userId: string, orgId: string }
let a: Ctx
let b: Ctx
let mechanicA: Ctx

async function nextNumber(tx: Tx) {
  const result = await tx.execute<{ n: number }>(sql`select app.next_sequence('work_order', 2026) as n`)
  return result.rows[0]!.n
}

/** Klient z pojazdem i zleceniem z jednym zadaniem. */
async function seedOrder(ctx: Ctx) {
  return withTenant(db, ctx, async (tx) => {
    const [c] = await tx.insert(customer).values({ orgId: ctx.orgId, name: 'Jan Kowalski', phone: '+48600100200' }).returning()
    const [v] = await tx.insert(vehicle).values({ orgId: ctx.orgId, customerId: c!.id, type: 'forklift', meterUnit: 'mth', serialNumber: 'WF-123' }).returning()
    const n = await nextNumber(tx)
    const [o] = await tx.insert(workOrder).values({ orgId: ctx.orgId, number: `ZL/2026/${n}`, customerId: c!.id, vehicleId: v!.id }).returning()
    const [t] = await tx.insert(task).values({ orgId: ctx.orgId, workOrderId: o!.id, title: 'Przegląd' }).returning()
    return { customer: c!, vehicle: v!, order: o!, task: t! }
  })
}

let seededA: Awaited<ReturnType<typeof seedOrder>>
let seededB: Awaited<ReturnType<typeof seedOrder>>

beforeAll(async () => {
  a = await createMemberWithOrg(db)
  b = await createMemberWithOrg(db)
  mechanicA = await addMember(db, a.orgId, 'mechanic')
  seededA = await seedOrder(a)
  seededB = await seedOrder(b)
})

afterAll(async () => {
  await pool.end()
})

describe('numeracja zleceń', () => {
  it('każdy warsztat ma własną, rosnącą numerację', async () => {
    const [a2, a3] = await withTenant(db, a, async tx => [await nextNumber(tx), await nextNumber(tx)])
    const b2 = await withTenant(db, b, tx => nextNumber(tx))
    expect(a2).toBe(2)
    expect(a3).toBe(3)
    expect(b2).toBe(2)
  })

  it('numer zlecenia jest unikalny w obrębie warsztatu', async () => {
    const message = await pgErrorMessage(withTenant(db, a, tx => tx.insert(workOrder).values({
      orgId: a.orgId,
      number: seededA.order.number,
      customerId: seededA.customer.id,
      vehicleId: seededA.vehicle.id,
    })))
    expect(message).toMatch(/work_order_org_number_uq/)
  })
})

describe('izolacja danych warsztatu', () => {
  it('warsztat nie widzi klientów, pojazdów ani zleceń innego warsztatu', async () => {
    const seen = await withTenant(db, b, async tx => ({
      customers: await tx.select().from(customer),
      vehicles: await tx.select().from(vehicle),
      orders: await tx.select().from(workOrder),
    }))
    expect(seen.customers.map(c => c.id)).toEqual([seededB.customer.id])
    expect(seen.vehicles.map(v => v.id)).toEqual([seededB.vehicle.id])
    expect(seen.orders.map(o => o.id)).toEqual([seededB.order.id])
  })

  it('nie da się podpiąć pojazdu pod klienta innego warsztatu', async () => {
    const message = await pgErrorMessage(withTenant(db, b, tx => tx.insert(vehicle).values({
      orgId: b.orgId,
      customerId: seededA.customer.id,
      type: 'car',
    })))
    expect(message).toMatch(/vehicle_customer_fk/)
  })

  it('nie da się założyć zlecenia na pojazd innego warsztatu', async () => {
    const message = await pgErrorMessage(withTenant(db, b, tx => tx.insert(workOrder).values({
      orgId: b.orgId,
      number: 'ZL/2026/9999',
      customerId: seededB.customer.id,
      vehicleId: seededA.vehicle.id,
    })))
    expect(message).toMatch(/work_order_vehicle_fk/)
  })

  it('nie da się dodać zadania do zlecenia innego warsztatu', async () => {
    const message = await pgErrorMessage(withTenant(db, b, tx => tx.insert(task).values({
      orgId: b.orgId,
      workOrderId: seededA.order.id,
      title: 'Obce zadanie',
    })))
    expect(message).toMatch(/task_work_order_fk/)
  })
})

describe('zadania i podzadania', () => {
  it('podzadanie należy do tego samego zlecenia', async () => {
    const sub = await withTenant(db, a, async (tx) => {
      const [row] = await tx.insert(task).values({
        orgId: a.orgId,
        workOrderId: seededA.order.id,
        parentId: seededA.task.id,
        title: 'Wymiana dętki',
      }).returning()
      return row!
    })
    expect(sub.parentId).toBe(seededA.task.id)

    const otherOrder = await withTenant(db, a, async (tx) => {
      const [row] = await tx.insert(workOrder).values({
        orgId: a.orgId,
        number: 'ZL/2026/0100',
        customerId: seededA.customer.id,
        vehicleId: seededA.vehicle.id,
      }).returning()
      return row!
    })
    const message = await pgErrorMessage(withTenant(db, a, tx => tx.insert(task).values({
      orgId: a.orgId,
      workOrderId: otherOrder.id,
      parentId: seededA.task.id,
      title: 'Podzadanie z innego zlecenia',
    })))
    expect(message).toMatch(/tego samego zlecenia/)
  })

  it('drzewo zadań ma najwyżej dwa poziomy', async () => {
    const message = await withTenant(db, a, async (tx) => {
      const [sub] = await tx.select().from(task).where(eq(task.parentId, seededA.task.id)).limit(1)
      return pgErrorMessage(withTenant(db, a, inner => inner.insert(task).values({
        orgId: a.orgId,
        workOrderId: seededA.order.id,
        parentId: sub!.id,
        title: 'Trzeci poziom',
      })))
    })
    expect(message).toMatch(/dwa poziomy/)
  })
})

describe('przypisania mechaników', () => {
  it('zadanie może mieć kilku wykonawców z zespołu', async () => {
    await withTenant(db, a, tx => tx.insert(taskAssignment).values([
      { orgId: a.orgId, taskId: seededA.task.id, userId: a.userId, assignedBy: a.userId },
      { orgId: a.orgId, taskId: seededA.task.id, userId: mechanicA.userId, assignedBy: a.userId },
    ]))
    const rows = await withTenant(db, a, tx => tx.select().from(taskAssignment).where(eq(taskAssignment.taskId, seededA.task.id)))
    expect(rows.map(r => r.userId).sort()).toEqual([a.userId, mechanicA.userId].sort())
  })

  it('nie da się przypisać osoby spoza zespołu', async () => {
    const message = await pgErrorMessage(withTenant(db, a, tx => tx.insert(taskAssignment).values({
      orgId: a.orgId,
      taskId: seededA.task.id,
      userId: b.userId,
    })))
    expect(message).toMatch(/task_assignment_member_fk/)
  })

  it('odejście z zespołu usuwa przypisania tej osoby', async () => {
    await db.delete(member).where(and(eq(member.organizationId, a.orgId), eq(member.userId, mechanicA.userId)))
    const rows = await withTenant(db, a, tx => tx.select().from(taskAssignment).where(eq(taskAssignment.taskId, seededA.task.id)))
    expect(rows.map(r => r.userId)).toEqual([a.userId])
  })

  it('usunięcie zlecenia usuwa jego zadania i przypisania', async () => {
    await withTenant(db, b, async (tx) => {
      await tx.insert(taskAssignment).values({ orgId: b.orgId, taskId: seededB.task.id, userId: b.userId })
      await tx.delete(workOrder).where(eq(workOrder.id, seededB.order.id))
    })
    const left = await withTenant(db, b, async tx => ({
      tasks: await tx.select().from(task),
      assignments: await tx.select().from(taskAssignment),
    }))
    expect(left.tasks).toHaveLength(0)
    expect(left.assignments).toHaveLength(0)
  })
})
