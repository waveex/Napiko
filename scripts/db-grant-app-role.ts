/**
 * Nadaje uprawnienia roli aplikacji (ADR-010) – ręcznie, np. przy pierwszej konfiguracji bazy Neon:
 *
 *   DATABASE_MIGRATION_URL=postgres://oxy_owner:…@…/oxy DATABASE_APP_ROLE=oxy_app pnpm db:grant-app-role
 *
 * Na Netlify robi to automatycznie scripts/migrate-on-build.ts po migracjach.
 */
import pg from 'pg'
import { grantAppRole } from '../server/db/roles'

try {
  process.loadEnvFile('.env')
}
catch {
  // brak .env
}

const url = process.env.DATABASE_MIGRATION_URL
const role = process.env.DATABASE_APP_ROLE
if (!url || !role) {
  console.error('Ustaw DATABASE_MIGRATION_URL (rola właściciela tabel) i DATABASE_APP_ROLE (np. oxy_app).')
  process.exit(1)
}
const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await grantAppRole(client, role)
  console.log(`Uprawnienia roli ${role} nadane.`)
}
finally {
  await client.end()
}
