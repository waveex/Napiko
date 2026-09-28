/**
 * Akceptacje klienta: pozycje z tego samego zlecenia, unikalne tokeny i izolacja warsztatów.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { customer, vehicle, workOrder, workRequest, approvalItem, approvalRequest } from '../../server/db/schema'
import type { ApprovalSnapshot } from '../../server/db/schema'
import { withSystem, withTenant } from '../../server/db/tenant'
import { createMemberWithOrg, createTestDb, pgErrorMessage } from '../helpers'

const { db, pool } = createTestDb()
type Ctx = { userId: string, orgId: string }
let a: Ctx
let b: Ctx

const snapshot: ApprovalSnapshot = {
  version: 1,
  organization: { name: 'Test' },
  order: { number: 'ZL/T/1' },
  vehicle: { type: 'car', make: null, model: null, registrationNumber: null },
  message: null,
  currency: 'PLN',
  items: [],
  totalGrossCents: 0,
  createdAt: new Date().toISOString(),
}

async function seed(ctx: Ctx, number: string) {
  return withTenant(db, ctx, async (tx) => {
    const [c] = await tx.insert(customer).values({ orgId: ctx.orgId, name: 'Klient' }).returning()
    const [v] = await tx.insert(vehicle).values({ orgId: ctx.orgId, customerId: c!.id, type: 'car' }).returning()
    const [o] = await tx.insert(workOrder).values({ orgId: ctx.orgId, number, customerId: c!.id, vehicleId: v!.id }).returning()
    const [r] = await tx.insert(workRequest).values({ orgId: ctx.orgId, workOrderId: o!.id, title: 'Klocki tył', status: 'quoted', laborNet: '100.00' }).returning()
    return { order: o!, request: r! }
  })
}

function approval(orgId: string, workOrderId: string, tokenHash: string) {
  return {
    orgId,
    workOrderId,
    tokenHash,
    channel: 'link' as const,
    snapshot,
    snapshotHash: 'x',
    expiresAt: new Date(Date.now() + 3600_000),
  }
}

let a1: Awaited<ReturnType<typeof seed>>
let a2: Awaited<ReturnType<typeof seed>>

beforeAll(async () => {
  a = await createMemberWithOrg(db)
  b = await createMemberWithOrg(db)
  a1 = await seed(a, 'ZL/A/1')
  a2 = await seed(a, 'ZL/A/2')
})

afterAll(async () => {
  await pool.end()
})

describe('akceptacje klienta', () => {
  it('pozycja prośby musi pochodzić z tego samego zlecenia', async () => {
    const message = await pgErrorMessage(withTenant(db, a, async (tx) => {
      const [row] = await tx.insert(approvalRequest).values(approval(a.orgId, a1.order.id, 'hash-1')).returning()
      await tx.insert(approvalItem).values({ orgId: a.orgId, approvalId: row!.id, workRequestId: a2.request.id })
    }))
    expect(message).toMatch(/tego samego zlecenia/)
  })

  it('skrót tokenu jest unikalny w całym systemie', async () => {
    await withTenant(db, a, tx => tx.insert(approvalRequest).values(approval(a.orgId, a1.order.id, 'hash-unikalny')))
    const bOrder = await seed(b, 'ZL/B/1')
    const message = await pgErrorMessage(withTenant(db, b, tx => tx.insert(approvalRequest).values(approval(b.orgId, bOrder.order.id, 'hash-unikalny'))))
    expect(message).toMatch(/approval_request_token_hash_uq/)
  })

  it('odpowiedź wymaga daty odpowiedzi (spójność statusu)', async () => {
    const message = await pgErrorMessage(withTenant(db, a, tx => tx.insert(approvalRequest).values({
      ...approval(a.orgId, a1.order.id, 'hash-status'),
      status: 'answered',
    })))
    expect(message).toMatch(/approval_request_answer_check/)
  })

  it('inny warsztat nie widzi próśb; system (strona publiczna) – tak', async () => {
    const seenByB = await withTenant(db, b, tx => tx.select().from(approvalRequest))
    expect(seenByB.every(r => r.orgId === b.orgId)).toBe(true)
    const all = await withSystem(db, tx => tx.select().from(approvalRequest))
    expect(all.some(r => r.orgId === a.orgId)).toBe(true)
  })
})
