/**
 * Kotwice dziennika zdarzeń: przepisanie dziennika w bazie (usunięcie i ponowne wstawienie – łańcuch przelicza się
 * poprawnie) jest wykrywane przez porównanie z kotwicą zapisaną wcześniej poza bazą.
 */
import { afterAll, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { recordAudit } from '../../server/db/audit'
import { collectChainHeads, verifyAnchor, type AuditAnchor } from '../../server/db/audit-anchor'
import { withTenant } from '../../server/db/tenant'
import { createMemberWithOrg, createTestDb } from '../helpers'

const { db, pool } = createTestDb()
afterAll(async () => {
  await pool.end()
})

it('kotwica zgadza się z nienaruszonym dziennikiem i wykrywa jego przepisanie', async () => {
  const a = await createMemberWithOrg(db)
  for (const action of ['order.created', 'order.status_changed']) {
    await withTenant(db, a, tx => recordAudit(tx, { orgId: a.orgId, actorUserId: a.userId, action, entityType: 'work_order' }))
  }
  const anchor: AuditAnchor = { version: 1, createdAt: new Date().toISOString(), heads: await collectChainHeads(db) }
  const head = anchor.heads.find(h => h.orgId === a.orgId)
  expect(head).toMatchObject({ seq: 2 })
  // kolejne wpisy po kotwicy są w porządku
  await withTenant(db, a, tx => recordAudit(tx, { orgId: a.orgId, action: 'order.closed', entityType: 'work_order' }))
  expect(await verifyAnchor(db, anchor)).toEqual([])

  // Ktoś z dostępem właściciela bazy czyści dziennik i wstawia go od nowa – łańcuch jest spójny...
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.audit_purge', 'on', true), set_config('app.system', 'on', true)`)
    await tx.execute(sql`delete from audit_event where org_id = ${a.orgId}`)
    for (const action of ['order.created', 'order.status_changed']) {
      await recordAudit(tx, { orgId: a.orgId, actorUserId: a.userId, action, entityType: 'work_order' })
    }
  })
  const [{ broken }] = (await db.execute<{ broken: number | null }>(sql`select app.audit_chain_first_broken(${a.orgId}::uuid) as broken`)).rows as [{ broken: number | null }]
  expect(broken).toBeNull()
  // ...ale nie zgadza się z kotwicą
  const mismatches = await verifyAnchor(db, { ...anchor, heads: [head!] })
  expect(mismatches).toHaveLength(1)
  expect(mismatches[0]!.actual).not.toBe(head!.hash)
})
