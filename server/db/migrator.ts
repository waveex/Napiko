/**
 * Lokalny migrator dla migracji w formacie Netlify Database:
 *   netlify/database/migrations/<numer>_<slug>/migration.sql  (albo <numer>_<slug>.sql)
 *
 * Na Netlify (Netlify Database) te same pliki stosuje automatycznie platforma przy wdrożeniu.
 * Lokalnie, w CI i dla zewnętrznej bazy (np. Neon w UE) robi to ten moduł.
 */
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import pg from 'pg'

export const MIGRATIONS_DIR = 'netlify/database/migrations'
const NAME_RE = /^\d+_[a-z0-9_-]+$/
const LOCK_KEY = 'hashtextextended(\'oxy.migrations\', 0)'

export interface Migration {
  name: string
  sql: string
  checksum: string
}

function checksum(sql: string) {
  // Normalizacja końców linii: ta sama migracja z Windowsa (CRLF) i Linuksa (LF) ma tę samą sumę.
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex')
}

export async function loadMigrations(dir = MIGRATIONS_DIR): Promise<Migration[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const migrations: Migration[] = []
  for (const entry of entries) {
    let name: string | undefined
    let file: string | undefined
    if (entry.isDirectory() && NAME_RE.test(entry.name)) {
      name = entry.name
      file = join(dir, entry.name, 'migration.sql')
    }
    else if (entry.isFile() && entry.name.endsWith('.sql') && NAME_RE.test(entry.name.slice(0, -4))) {
      name = entry.name.slice(0, -4)
      file = join(dir, entry.name)
    }
    if (!name || !file) continue
    const sql = await readFile(file, 'utf8')
    migrations.push({ name, sql, checksum: checksum(sql) })
  }
  // Netlify sortuje migracje leksykograficznie – robimy tak samo.
  return migrations.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

export interface MigrateOptions {
  dir?: string
  log?: (message: string) => void
}

export async function migrate(connectionString: string, options: MigrateOptions = {}): Promise<string[]> {
  const log = options.log ?? (() => {})
  const client = new pg.Client({ connectionString })
  await client.connect()
  const appliedNow: string[] = []
  try {
    await client.query(`SELECT pg_advisory_lock(${LOCK_KEY})`)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._oxy_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`)
    const { rows } = await client.query<{ name: string, checksum: string }>('SELECT name, checksum FROM public._oxy_migrations')
    const applied = new Map(rows.map(r => [r.name, r.checksum]))

    for (const migration of await loadMigrations(options.dir)) {
      const previous = applied.get(migration.name)
      if (previous) {
        if (previous !== migration.checksum) {
          throw new Error(
            `Migracja ${migration.name} została zmieniona po zastosowaniu. `
            + 'Nie edytuj zastosowanych migracji – dodaj nową (pnpm db:new <nazwa>).',
          )
        }
        continue
      }
      log(`→ ${migration.name}`)
      await client.query('BEGIN')
      try {
        await client.query(migration.sql)
        await client.query('INSERT INTO public._oxy_migrations (name, checksum) VALUES ($1, $2)', [migration.name, migration.checksum])
        await client.query('COMMIT')
      }
      catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`Migracja ${migration.name} nie powiodła się: ${(error as Error).message}`, { cause: error })
      }
      appliedNow.push(migration.name)
    }
    return appliedNow
  }
  finally {
    await client.query(`SELECT pg_advisory_unlock(${LOCK_KEY})`).catch(() => {})
    await client.end()
  }
}

/** Czyści bazę (tylko lokalnie!): usuwa schematy public i app razem z danymi. */
export async function resetDatabase(connectionString: string) {
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    await client.query('DROP SCHEMA IF EXISTS app CASCADE')
    await client.query('DROP SCHEMA IF EXISTS public CASCADE')
    await client.query('CREATE SCHEMA public')
  }
  finally {
    await client.end()
  }
}

export function isLocalDatabase(connectionString: string) {
  const host = new URL(connectionString).hostname
  return ['localhost', '127.0.0.1', '::1', 'postgres', 'db'].includes(host)
}
