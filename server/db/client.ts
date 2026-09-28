/**
 * Połączenie z PostgreSQL (Drizzle + node-postgres).
 * Bez zależności od Nuxta – używają go też skrypty i testy.
 */
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

export function createPool(connectionString: string, options: Partial<pg.PoolConfig> = {}) {
  return new pg.Pool({
    connectionString,
    // Funkcje serverless: mała pula na instancję; resztą zarządza pooler bazy.
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ...options,
  })
}

export function createDb(pool: pg.Pool) {
  return drizzle(pool, { schema })
}

export type Db = ReturnType<typeof createDb>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type DbOrTx = Db | Tx
