/**
 * Dane demonstracyjne (warsztat + trzech mechaników) – poza migracjami, więc nie trafiają na produkcję.
 * Używa ich skrypt `pnpm db:seed:demo` i testy.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type pg from 'pg'

const DIR = join(import.meta.dirname, '.')

export interface DemoSeedOptions {
  /** E-mail właściciela organizacji, do której trafią dane demo (konto musi już istnieć). */
  ownerEmail: string
  /** Hash hasła kont mechaników (better-auth/crypto `hashPassword`). */
  passwordHash: string
}

/**
 * Identyfikatory demo: jak w dawnych migracjach (md5 → uuid) z poprawionymi bitami wersji i wariantu,
 * dokładnie tak, jak naprawiła je migracja 20260928140000_repair-demo-uuids – ponowny seed trafia w te same wiersze.
 */
const DEMO_UUID_FN = `
CREATE OR REPLACE FUNCTION pg_temp.demo_uuid(seed text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN md5(seed)::uuid::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN md5(seed)::uuid
    ELSE overlay(overlay(md5(seed)::uuid::text placing '8' from 15 for 1) placing '8' from 20 for 1)::uuid
  END
$$`

export async function seedDemo(client: pg.ClientBase, options: DemoSeedOptions) {
  const workshop = await readFile(join(DIR, 'workshop.sql'), 'utf8')
  const mechanics = await readFile(join(DIR, 'mechanics.sql'), 'utf8')
  await client.query('BEGIN')
  try {
    await client.query(DEMO_UUID_FN)
    await client.query(`SELECT set_config('oxy.demo_owner_email', $1, true), set_config('oxy.demo_password_hash', $2, true)`,
      [options.ownerEmail, options.passwordHash])
    await client.query(workshop)
    await client.query(mechanics)
    await client.query('COMMIT')
  }
  catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}
