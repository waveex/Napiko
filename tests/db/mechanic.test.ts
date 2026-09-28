/**
 * Praca mechanika: liczniki czasu, zgłoszenia potrzeb i załączniki – reguły pilnowane przez bazę.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import {
  customer, fileObject, task, timeEntry, vehicle, workOrder, workOrderAttachment, workRequest,
} from '../../server/db/schema'
import { withTenant } from '../../server/db/tenant'
import { addMember, createMemberWithOrg, createTestDb, pgErrorMessage } from '../helpers'

const { db, pool } = createTestDb()
type Ctx = { userId: string, orgId: string }
let a: Ctx
let b: Ctx
let mechanicA: Ctx

async function seedOrder(ctx: Ctx, number: string) {
  return withTenant(db, ctx, async (tx) => {
    const [c] = await tx.insert(customer).values({ orgId: ctx.orgId, name: 'Klient Testowy' }).returning()
    const [v] = await tx.insert(vehicle).values({ orgId: ctx.orgId, customerId: c!.id, type: 'car' }).returning()
    const [o] = await tx.insert(workOrder).values({ orgId: ctx.orgId, number, customerId: c!.id, vehicleId: v!.id }).returning()
    const [t1] = await tx.insert(task).values({ orgId: ctx.orgId, workOrderId: o!.id, title: 'Klocki przód' }).returning()
    const [t2] = await tx.insert(task).values({ orgId: ctx.orgId, workOrderId: o!.id, title: 'Kontrola tyłu' }).returning()
    return { order: o!, tasks: [t1!, t2!] }
  })
}

function file(orgId: string, name: string) {
  return {
    orgId,
    storageKey: `org/${orgId}/test/${name}`,
    fileName: name,
    contentType: 'image/jpeg',
    sizeBytes: 2048,
    purpose: 'attachment' as const,
    status: 'uploaded' as const,
  }
}

let orderA: Awaited<ReturnType<typeof seedOrder>>
let orderA2: Awaited<ReturnType<typeof seedOrder>>
let orderB: Awaited<ReturnType<typeof seedOrder>>

beforeAll(async () => {
  a = await createMemberWithOrg(db)
  b = await createMemberWithOrg(db)
  mechanicA = await addMember(db, a.orgId, 'mechanic')
  orderA = await seedOrder(a, 'ZL/T/1')
  orderA2 = await seedOrder(a, 'ZL/T/2')
  orderB = await seedOrder(b, 'ZL/T/1')
})

afterAll(async () => {
  await pool.end()
})

describe('czas pracy', () => {
  it('zlecenie wpisu czasu uzupełnia baza na podstawie zadania', async () => {
    const entry = await withTenant(db, mechanicA, async (tx) => {
      const [row] = await tx.insert(timeEntry).values({
        orgId: a.orgId,
        taskId: orderA.tasks[0].id,
        // celowo inne zlecenie – wyzwalacz i tak wpisze właściwe
        workOrderId: orderA2.order.id,
        userId: mechanicA.userId,
      }).returning()
      return row!
    })
    expect(entry.workOrderId).toBe(orderA.order.id)
  })

  it('jedna osoba ma naraz tylko jeden uruchomiony licznik', async () => {
    const message = await pgErrorMessage(withTenant(db, mechanicA, tx => tx.insert(timeEntry).values({
      orgId: a.orgId,
      taskId: orderA.tasks[1].id,
      workOrderId: orderA.order.id,
      userId: mechanicA.userId,
    })))
    expect(message).toMatch(/time_entry_one_running_uq/)
  })

  it('po zatrzymaniu licznika można uruchomić kolejny', async () => {
    await withTenant(db, mechanicA, async (tx) => {
      await tx.update(timeEntry).set({ endedAt: sql`now()` }).where(eq(timeEntry.userId, mechanicA.userId))
      await tx.insert(timeEntry).values({ orgId: a.orgId, taskId: orderA.tasks[1].id, workOrderId: orderA.order.id, userId: mechanicA.userId })
    })
    const rows = await withTenant(db, a, tx => tx.select().from(timeEntry))
    expect(rows).toHaveLength(2)
    expect(rows.filter(r => r.endedAt === null)).toHaveLength(1)
  })

  it('koniec wpisu nie może być przed początkiem', async () => {
    const message = await pgErrorMessage(withTenant(db, a, tx => tx.insert(timeEntry).values({
      orgId: a.orgId,
      taskId: orderA.tasks[0].id,
      workOrderId: orderA.order.id,
      userId: a.userId,
      startedAt: new Date('2026-09-26T10:00:00Z'),
      endedAt: new Date('2026-09-26T09:00:00Z'),
    })))
    expect(message).toMatch(/time_entry_range_check/)
  })

  it('inny warsztat nie widzi czasu pracy', async () => {
    expect(await withTenant(db, b, tx => tx.select().from(timeEntry))).toHaveLength(0)
  })
})

describe('zgłoszenia potrzeb', () => {
  it('zgłoszenie może wskazać tylko zadanie z tego samego zlecenia', async () => {
    const message = await pgErrorMessage(withTenant(db, a, tx => tx.insert(workRequest).values({
      orgId: a.orgId,
      workOrderId: orderA.order.id,
      taskId: orderA2.tasks[0].id,
      title: 'Tylne klocki',
    })))
    expect(message).toMatch(/tego samego zlecenia/)
  })

  it('nie da się podpiąć zgłoszenia pod zlecenie innego warsztatu', async () => {
    const message = await pgErrorMessage(withTenant(db, b, tx => tx.insert(workRequest).values({
      orgId: b.orgId,
      workOrderId: orderA.order.id,
      title: 'Obce',
    })))
    expect(message).toMatch(/work_request_work_order_fk/)
  })

  it('usunięcie zadania zostawia zgłoszenie (bez powiązania z zadaniem)', async () => {
    const request = await withTenant(db, a, async (tx) => {
      const [extra] = await tx.insert(task).values({ orgId: a.orgId, workOrderId: orderA.order.id, title: 'Tymczasowe' }).returning()
      const [row] = await tx.insert(workRequest).values({
        orgId: a.orgId,
        workOrderId: orderA.order.id,
        taskId: extra!.id,
        kind: 'part',
        title: 'Zestaw klocków tył',
        urgency: 'urgent',
        partsNet: '180.50',
        laborNet: '120.00',
      }).returning()
      await tx.delete(task).where(eq(task.id, extra!.id))
      const [after] = await tx.select().from(workRequest).where(eq(workRequest.id, row!.id))
      return after!
    })
    expect(request.taskId).toBeNull()
    expect(request.orgId).toBe(a.orgId)
    expect(request.partsNet).toBe('180.50')
    expect(request.vatRate).toBe('23.00')
  })

  it('kwoty nie mogą być ujemne', async () => {
    const message = await pgErrorMessage(withTenant(db, a, tx => tx.insert(workRequest).values({
      orgId: a.orgId,
      workOrderId: orderA.order.id,
      title: 'Ujemna',
      laborNet: '-1.00',
    })))
    expect(message).toMatch(/work_request_amounts_check/)
  })
})

describe('załączniki', () => {
  it('zdjęcie przypina się do zlecenia i zadania', async () => {
    const attachment = await withTenant(db, a, async (tx) => {
      const [f] = await tx.insert(fileObject).values(file(a.orgId, 'klocki.jpg')).returning()
      const [row] = await tx.insert(workOrderAttachment).values({
        orgId: a.orgId,
        workOrderId: orderA.order.id,
        taskId: orderA.tasks[0].id,
        fileId: f!.id,
      }).returning()
      return row!
    })
    expect(attachment.customerVisible).toBe(false)
  })

  it('nie da się przypiąć pliku innego warsztatu', async () => {
    const foreignFile = await withTenant(db, b, async (tx) => {
      const [f] = await tx.insert(fileObject).values(file(b.orgId, 'obcy.jpg')).returning()
      return f!
    })
    const message = await pgErrorMessage(withTenant(db, a, tx => tx.insert(workOrderAttachment).values({
      orgId: a.orgId,
      workOrderId: orderA.order.id,
      fileId: foreignFile.id,
    })))
    expect(message).toMatch(/work_order_attachment_file_fk/)
  })

  it('zadanie w załączniku musi być z tego samego zlecenia', async () => {
    const message = await withTenant(db, a, async (tx) => {
      const [f] = await tx.insert(fileObject).values(file(a.orgId, 'inne.jpg')).returning()
      return pgErrorMessage(withTenant(db, a, inner => inner.insert(workOrderAttachment).values({
        orgId: a.orgId,
        workOrderId: orderA.order.id,
        taskId: orderA2.tasks[0].id,
        fileId: f!.id,
      })))
    })
    expect(message).toMatch(/tego samego zlecenia/)
  })

  it('inny warsztat nie widzi załączników ani zgłoszeń', async () => {
    const seen = await withTenant(db, b, async tx => ({
      attachments: await tx.select().from(workOrderAttachment),
      requests: await tx.select().from(workRequest),
    }))
    expect(seen.attachments).toHaveLength(0)
    expect(seen.requests).toHaveLength(0)
    expect(orderB.order.orgId).toBe(b.orgId)
  })
})
