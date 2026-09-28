/**
 * Zgodność schematu Drizzle (typy w kodzie) z bazą po migracjach.
 * Chroni przed sytuacją, w której ktoś zmieni schema.ts, a zapomni o migracji SQL (albo odwrotnie).
 */
import { afterAll, describe, expect, it } from 'vitest'
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core'
import { is, sql } from 'drizzle-orm'
import { PgTable as PgTableClass } from 'drizzle-orm/pg-core'
import * as schema from '../../server/db/schema'
import { createTestDb } from '../helpers'

const { db, pool } = createTestDb()

afterAll(async () => {
  await pool.end()
})

describe('schemat Drizzle a baza', () => {
  const tables = Object.values(schema).filter((value): value is PgTable => is(value, PgTableClass))

  it('obejmuje wszystkie tabele', () => {
    expect(tables.length).toBeGreaterThanOrEqual(12)
  })

  for (const table of tables) {
    const config = getTableConfig(table)
    it(`tabela ${config.name} ma w bazie te same kolumny`, async () => {
      const { rows } = await db.execute<{ column_name: string, is_nullable: 'YES' | 'NO' }>(sql`
        select column_name, is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = ${config.name}
      `)
      const inDb = new Map(rows.map(r => [r.column_name, r.is_nullable === 'NO']))
      const inCode = new Map(config.columns.map(c => [c.name, c.notNull]))
      expect([...inDb.keys()].sort()).toEqual([...inCode.keys()].sort())
      for (const [name, notNull] of inCode) {
        expect(inDb.get(name), `${config.name}.${name} NOT NULL`).toBe(notNull)
      }
    })
  }
})
