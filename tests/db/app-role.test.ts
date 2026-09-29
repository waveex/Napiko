/**
 * Rola aplikacji bez własności tabel (ADR-010): RLS działa, a schematu, wyzwalaczy i dziennika nie da się ruszyć.
 * Test wymaga uprawnienia CREATEROLE dla roli testów (CI: tak; lokalnie – gdy go brak, test jest pomijany).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { createDb, createPool } from '../../server/db/client'
import { grantAppRole } from '../../server/db/roles'
import { recordAudit } from '../../server/db/audit'
import { withTenant } from '../../server/db/tenant'
import { customer } from '../../server/db/schema'
import { createMemberWithOrg, createTestDb, pgErrorMessage } from '../helpers'

const { db, pool } = createTestDb()
const role = `oxy_rt_${randomBytes(4).toString('hex')}`
const password = randomBytes(12).toString('hex')
let canCreateRoles = false
let appPool: ReturnType<typeof createPool> | undefined

beforeAll(async () => {
  try {
    await pool.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS`)
    canCreateRoles = true
  }
  catch {
    return
  }
  const client = await pool.connect()
  try {
    await grantAppRole(client, role)
  }
  finally {
    client.release()
  }
  const url = new URL(process.env.TEST_DATABASE_URL!)
  url.username = role
  url.password = password
  appPool = createPool(url.toString(), { max: 2 })
})

afterAll(async () => {
  await appPool?.end()
  if (canCreateRoles) {
    // Twórca roli (CREATEROLE) może się do niej dołączyć, żeby usunąć jej uprawnienia i domyślne przywileje
    await pool.query(`GRANT ${role} TO CURRENT_USER`)
    await pool.query(`DROP OWNED BY ${role}`)
    await pool.query(`DROP ROLE ${role}`)
  }
  await pool.end()
})

describe('rola aplikacji (ADR-010)', () => {
  it('odmawia roli, która jest właścicielem tabel', async () => {
    const client = await pool.connect()
    try {
      const { rows: [me] } = await client.query('SELECT current_user AS name')
      await expect(grantAppRole(client, me.name)).rejects.toThrow(/właścicielem tabel|omija RLS/)
    }
    finally {
      client.release()
    }
  })

  it('izolacja warsztatów działa, a zmiana schematu, wyzwalaczy i dziennika jest zablokowana', async (ctx) => {
    if (!canCreateRoles || !appPool) return ctx.skip()
    const appDb = createDb(appPool)
    const a = await createMemberWithOrg(db)
    const b = await createMemberWithOrg(db)
    await withTenant(appDb, a, tx => tx.insert(customer).values({ orgId: a.orgId, name: 'Klient A' }))
    expect(await withTenant(appDb, b, tx => tx.select().from(customer))).toHaveLength(0)
    expect(await appDb.select().from(customer)).toHaveLength(0)

    expect(await pgErrorMessage(appDb.execute(sql`alter table customer no force row level security`))).toMatch(/must be owner|właściciel/)
    expect(await pgErrorMessage(appDb.execute(sql`drop trigger audit_event_no_update_delete on audit_event`))).toMatch(/must be owner|właściciel/)
    expect(await pgErrorMessage(appDb.execute(sql`select * from _oxy_migrations`))).toMatch(/permission denied|odmowa/)

    await withTenant(appDb, a, tx => recordAudit(tx, { orgId: a.orgId, action: 'test', entityType: 'test' }))
    expect(await pgErrorMessage(appDb.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.audit_purge', 'on', true), set_config('app.system', 'on', true)`)
      await tx.execute(sql`delete from audit_event where org_id = ${a.orgId}`)
    }))).toMatch(/permission denied|odmowa/)
  })
})
