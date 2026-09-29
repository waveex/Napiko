/**
 * Węższe konteksty bazy: klient z linku (withCustomerLink) i osoba bez aktywnego warsztatu (withUser).
 * Zastępują kontekst systemowy w endpointach publicznych i w rzeczach należących do osoby.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { customer, member, notification, pushSubscription } from '../../server/db/schema'
import { withCustomerLink, withSystem, withTenant, withUser } from '../../server/db/tenant'
import { addMember, createMemberWithOrg, createTestDb, pgErrorMessage } from '../helpers'

const { db, pool } = createTestDb()
let a: { userId: string, orgId: string }
let b: { userId: string, orgId: string }
let customerA: string
let customerB: string

beforeAll(async () => {
  a = await createMemberWithOrg(db)
  b = await createMemberWithOrg(db)
  customerA = (await withTenant(db, a, tx => tx.insert(customer).values({ orgId: a.orgId, name: 'Klient A' }).returning()))[0]!.id
  customerB = (await withTenant(db, b, tx => tx.insert(customer).values({ orgId: b.orgId, name: 'Klient B' }).returning()))[0]!.id
})

afterAll(async () => {
  await pool.end()
})

describe('withCustomerLink: klient z linku', () => {
  it('widzi i zmienia wyłącznie warsztat, do którego należy link', async () => {
    const seen = await withCustomerLink(db, a.orgId, tx => tx.select({ id: customer.id }).from(customer))
    expect(seen.map(c => c.id)).toEqual([customerA])
    const changed = await withCustomerLink(db, a.orgId, tx => tx.update(customer).set({ notifyEmail: false })
      .where(eq(customer.id, customerB)).returning())
    expect(changed).toHaveLength(0)
    expect(await pgErrorMessage(withCustomerLink(db, a.orgId, tx => tx.insert(customer).values({ orgId: b.orgId, name: 'Podrzucony' }))))
      .toMatch(/row-level security/)
  })

  it('link do innego warsztatu niż app.org_id nie daje dostępu', async () => {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.org_id', ${b.orgId}, true), set_config('app.customer_link', ${a.orgId}, true)`)
      return tx.select().from(customer)
    })
    expect(rows).toHaveLength(0)
  })

  it('nie daje dostępu do danych osób z zespołu (powiadomienia, urządzenia push)', async () => {
    await withTenant(db, a, tx => tx.insert(notification).values({ orgId: a.orgId, userId: a.userId, type: 'task.assigned' }))
    await withUser(db, a.userId, tx => tx.execute(sql`select app.claim_push_subscription('https://push.example/link-test', ${'k'.repeat(87)}, ${'a'.repeat(22)}, null, 10)`))
    expect(await withCustomerLink(db, a.orgId, tx => tx.select().from(notification))).toHaveLength(0)
    expect(await withCustomerLink(db, a.orgId, tx => tx.select().from(pushSubscription))).toHaveLength(0)
  })

  it('zalogowany użytkownik spoza warsztatu nie „dziedziczy” dostępu z linku', async () => {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.user_id', ${b.userId}, true), set_config('app.org_id', ${a.orgId}, true),
        set_config('app.customer_link', ${a.orgId}, true)`)
      return tx.select().from(customer)
    })
    expect(rows).toHaveLength(0)
  })
})

describe('withUser: rzeczy należące do osoby', () => {
  it('powiadomienia ze wszystkich warsztatów osoby – tylko dopóki do nich należy', async () => {
    const mechanic = await addMember(db, a.orgId)
    await db.insert(member).values({ organizationId: b.orgId, userId: mechanic.userId, role: 'mechanic', createdAt: new Date() })
    await withTenant(db, a, tx => tx.insert(notification).values({ orgId: a.orgId, userId: mechanic.userId, type: 'task.assigned' }))
    await withTenant(db, b, tx => tx.insert(notification).values({ orgId: b.orgId, userId: mechanic.userId, type: 'task.assigned' }))

    const all = await withUser(db, mechanic.userId, tx => tx.select({ orgId: notification.orgId }).from(notification))
    expect(all.map(n => n.orgId).sort()).toEqual([a.orgId, b.orgId].sort())
    // W panelu (aktywny warsztat) nadal tylko bieżący warsztat
    const inA = await withTenant(db, { userId: mechanic.userId, orgId: a.orgId }, tx => tx.select({ orgId: notification.orgId }).from(notification))
    expect(inA.map(n => n.orgId)).toEqual([a.orgId])
    // Cudze powiadomienia są niewidoczne
    expect(await withUser(db, b.userId, tx => tx.select().from(notification).where(eq(notification.userId, mechanic.userId)))).toHaveLength(0)

    await db.delete(member).where(sql`${member.organizationId} = ${b.orgId} and ${member.userId} = ${mechanic.userId}`)
    const after = await withUser(db, mechanic.userId, tx => tx.select({ orgId: notification.orgId }).from(notification))
    expect(after.map(n => n.orgId)).toEqual([a.orgId])
  })

  it('przejęcie urządzenia push przez zalogowaną osobę i limit urządzeń', async () => {
    const endpoint = 'https://push.example/shared-phone'
    const claim = (userId: string, ep = endpoint, max = 10) => withUser(db, userId, tx =>
      tx.execute(sql`select app.claim_push_subscription(${ep}, ${'k'.repeat(87)}, ${'a'.repeat(22)}, 'test', ${max})`))
    await claim(a.userId)
    await claim(b.userId)
    const owner = await withSystem(db, tx => tx.select({ userId: pushSubscription.userId }).from(pushSubscription)
      .where(eq(pushSubscription.endpoint, endpoint)))
    expect(owner).toEqual([{ userId: b.userId }])
    expect(await withUser(db, a.userId, tx => tx.select().from(pushSubscription).where(eq(pushSubscription.endpoint, endpoint)))).toHaveLength(0)

    for (let i = 0; i < 3; i++) await claim(b.userId, `https://push.example/b-${i}`, 2)
    expect(await withUser(db, b.userId, tx => tx.select().from(pushSubscription))).toHaveLength(2)

    expect(await pgErrorMessage(db.execute(sql`select app.claim_push_subscription('https://push.example/x', 'k', 'a', null, 10)`)))
      .toMatch(/brak app.user_id/)
    // Po wywołaniu funkcji kontekst systemowy nie „przecieka” do reszty transakcji
    const leaked = await withUser(db, a.userId, async (tx) => {
      await tx.execute(sql`select app.claim_push_subscription('https://push.example/a-2', ${'k'.repeat(87)}, ${'a'.repeat(22)}, null, 10)`)
      return tx.select().from(customer)
    })
    expect(leaked).toHaveLength(0)
  })
})
