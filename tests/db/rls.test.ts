/**
 * Izolacja danych między warsztatami (Row Level Security).
 * To najważniejsza gwarancja bezpieczeństwa platformy – te testy muszą zawsze przechodzić.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { fileObject, organizationSettings } from '../../server/db/schema'
import { withSystem, withTenant } from '../../server/db/tenant'
import { createMemberWithOrg, createTestDb, pgErrorMessage } from '../helpers'

const { db, pool } = createTestDb()
let a: { userId: string, orgId: string }
let b: { userId: string, orgId: string }

function fileRow(orgId: string, name: string) {
  return {
    orgId,
    storageKey: `org/${orgId}/${name}`,
    fileName: name,
    contentType: 'image/jpeg',
    sizeBytes: 1024,
    purpose: 'attachment' as const,
  }
}

beforeAll(async () => {
  a = await createMemberWithOrg(db)
  b = await createMemberWithOrg(db)
  await withTenant(db, a, async (tx) => {
    await tx.insert(organizationSettings).values({ orgId: a.orgId, smsSenderName: 'WARSZTAT A' })
    await tx.insert(fileObject).values(fileRow(a.orgId, 'a.jpg'))
  })
  await withTenant(db, b, async (tx) => {
    await tx.insert(organizationSettings).values({ orgId: b.orgId })
    await tx.insert(fileObject).values(fileRow(b.orgId, 'b.jpg'))
  })
})

afterAll(async () => {
  await pool.end()
})

describe('RLS: izolacja danych warsztatów', () => {
  it('członek widzi wyłącznie dane swojej organizacji', async () => {
    const files = await withTenant(db, a, tx => tx.select().from(fileObject))
    expect(files.map(f => f.orgId)).toEqual([a.orgId])
    const settings = await withTenant(db, a, tx => tx.select().from(organizationSettings))
    expect(settings).toHaveLength(1)
    expect(settings[0]!.smsSenderName).toBe('WARSZTAT A')
  })

  it('bez kontekstu zapytania nie zwracają żadnych wierszy', async () => {
    expect(await db.select().from(fileObject)).toHaveLength(0)
    expect(await db.select().from(organizationSettings)).toHaveLength(0)
  })

  it('nie da się zmienić danych innej organizacji', async () => {
    const updated = await withTenant(db, b, tx =>
      tx.update(organizationSettings).set({ smsSenderName: 'HACK' }).where(eq(organizationSettings.orgId, a.orgId)).returning(),
    )
    expect(updated).toHaveLength(0)
    const [settingsA] = await withTenant(db, a, tx => tx.select().from(organizationSettings))
    expect(settingsA!.smsSenderName).toBe('WARSZTAT A')
  })

  it('nie da się dodać wiersza z cudzym org_id', async () => {
    expect(await pgErrorMessage(withTenant(db, b, tx => tx.insert(fileObject).values(fileRow(a.orgId, 'podrzucony.jpg')))))
      .toMatch(/row-level security/)
  })

  it('podstawienie cudzej organizacji w kontekście nic nie daje, gdy użytkownik nie jest jej członkiem', async () => {
    const spoofed = { userId: b.userId, orgId: a.orgId }
    expect(await withTenant(db, spoofed, tx => tx.select().from(fileObject))).toHaveLength(0)
    expect(await pgErrorMessage(withTenant(db, spoofed, tx => tx.insert(fileObject).values(fileRow(a.orgId, 'x.jpg')))))
      .toMatch(/row-level security/)
  })

  it('kontekst obowiązuje tylko w swojej transakcji', async () => {
    await withTenant(db, a, tx => tx.select().from(fileObject))
    const [row] = (await db.execute<{ org: string | null }>(sql`select app.current_org_id() as org`)).rows
    expect(row!.org).toBeNull()
  })

  it('kontekst systemowy widzi dane wszystkich organizacji', async () => {
    const files = await withSystem(db, tx => tx.select().from(fileObject))
    // baza testowa jest wspólna dla plików testów – sprawdzamy, że widać obie organizacje z tego pliku
    const orgs = new Set(files.map(f => f.orgId))
    expect(orgs.has(a.orgId) && orgs.has(b.orgId)).toBe(true)
  })

  it('wszystkie tabele z org_id mają włączone i wymuszone RLS', async () => {
    const { rows } = await db.execute<{ table_name: string, rls: boolean, forced: boolean }>(sql`
      select c.relname as table_name, c.relrowsecurity as rls, c.relforcerowsecurity as forced
      from information_schema.columns col
      join pg_class c on c.relname = col.table_name
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = col.table_schema
      where col.table_schema = 'public' and col.column_name = 'org_id' and c.relkind = 'r'
    `)
    expect(rows.length).toBeGreaterThanOrEqual(4)
    for (const row of rows) {
      expect(row, `tabela ${row.table_name}`).toMatchObject({ rls: true, forced: true })
    }
  })
})
