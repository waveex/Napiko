/**
 * Dziennik zdarzeń: tylko dopisywanie, łańcuch hashy, izolacja między organizacjami.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { auditEvent } from '../../server/db/schema'
import { recordAudit } from '../../server/db/audit'
import { withSystem, withTenant } from '../../server/db/tenant'
import { createMemberWithOrg, createTestDb, pgErrorMessage } from '../helpers'

const { db, pool } = createTestDb()
let a: { userId: string, orgId: string }
let b: { userId: string, orgId: string }

async function firstBroken(orgId: string) {
  const { rows } = await withSystem(db, tx =>
    tx.execute<{ broken: string | null }>(sql`select app.audit_chain_first_broken(${orgId}::uuid) as broken`),
  )
  return rows[0]!.broken
}

beforeAll(async () => {
  a = await createMemberWithOrg(db)
  b = await createMemberWithOrg(db)
  for (const action of ['settings.updated', 'file.uploaded', 'member.invited']) {
    await withTenant(db, a, tx => recordAudit(tx, {
      orgId: a.orgId,
      actorUserId: a.userId,
      action,
      entityType: 'test',
      data: { note: action },
    }))
  }
})

afterAll(async () => {
  await pool.end()
})

describe('dziennik zdarzeń', () => {
  it('nadaje kolejne numery i buduje nieprzerwany łańcuch', async () => {
    const events = await withTenant(db, a, tx => tx.select().from(auditEvent).orderBy(auditEvent.seq))
    expect(events.map(e => e.seq)).toEqual([1, 2, 3])
    expect(events[0]!.prevHash).toBeNull()
    expect(events[1]!.prevHash).toBe(events[0]!.hash)
    expect(events[2]!.prevHash).toBe(events[1]!.hash)
    expect(await firstBroken(a.orgId)).toBeNull()
  })

  it('blokuje zmianę i usunięcie wpisów – także w kontekście systemowym', async () => {
    expect(await pgErrorMessage(withSystem(db, tx => tx.update(auditEvent).set({ action: 'x' }).where(eq(auditEvent.orgId, a.orgId)))))
      .toMatch(/tylko do dopisywania/)
    expect(await pgErrorMessage(withSystem(db, tx => tx.delete(auditEvent).where(eq(auditEvent.orgId, a.orgId)))))
      .toMatch(/tylko do dopisywania/)
  })

  it('wykrywa podmianę wpisu (symulacja obejścia wyzwalacza)', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`select set_config('app.system', 'on', true)`)
      await client.query('ALTER TABLE audit_event DISABLE TRIGGER audit_event_no_update_delete')
      await client.query(`UPDATE audit_event SET data = '{"note":"podmienione"}' WHERE org_id = $1 AND seq = 2`, [a.orgId])
      const { rows } = await client.query('select app.audit_chain_first_broken($1::uuid) as broken', [a.orgId])
      expect(Number(rows[0].broken)).toBe(2)
    }
    finally {
      await client.query('ROLLBACK')
      client.release()
    }
    expect(await firstBroken(a.orgId)).toBeNull()
  })

  it('inna organizacja nie widzi cudzych wpisów ani nie może ich dopisać', async () => {
    const seen = await withTenant(db, b, tx => tx.select().from(auditEvent))
    expect(seen).toHaveLength(0)
    expect(await pgErrorMessage(withTenant(db, b, tx => recordAudit(tx, { orgId: a.orgId, action: 'x', entityType: 'test' }))))
      .toMatch(/row-level security/)
  })

  it('numeracja jest niezależna dla każdej organizacji', async () => {
    await withTenant(db, b, tx => recordAudit(tx, { orgId: b.orgId, action: 'organization.created', entityType: 'organization' }))
    const [first] = await withTenant(db, b, tx => tx.select().from(auditEvent))
    expect(first!.seq).toBe(1)
  })
})
