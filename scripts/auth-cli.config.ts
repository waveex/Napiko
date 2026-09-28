/**
 * Konfiguracja tylko dla CLI Better Auth (generowanie schematu tabel logowania):
 *   pnpm dlx auth@latest generate --config scripts/auth-cli.config.ts --output server/db/schema/auth.ts
 * Aplikacja z niej nie korzysta.
 */
import { createAuth } from '../server/lib/auth'
import { createDb, createPool } from '../server/db/client'
import { getEnv } from '../server/lib/env'

const env = getEnv({ ...process.env, BETTER_AUTH_SECRET: 'cli-only-secret-cli-only-secret-000' })

export const auth = createAuth({
  db: createDb(createPool('postgres://unused@localhost/unused')),
  env,
  sendEmail: async () => {},
})
