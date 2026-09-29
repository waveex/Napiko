/**
 * Migracje podczas budowania na Netlify – wariant z zewnętrzną bazą (Neon w UE, ADR-010).
 *
 * Build na Netlify kończy się błędem, jeśli migracja się nie uda – nowa wersja kodu nie zostanie wtedy
 * opublikowana przed zmianą schematu. Migracje wykonuje rola właściciela (DATABASE_MIGRATION_URL),
 * a aplikacja w czasie działania łączy się rolą bez prawa zmiany schematu (DATABASE_URL).
 *
 * DATABASE_APP_ROLE – nazwa roli aplikacji (np. oxy_app): po migracjach dostaje uprawnienia do nowych tabel.
 *
 * Z Netlify Database (bez DATABASE_MIGRATION_URL) skrypt nic nie robi – migracje stosuje platforma.
 * Na podglądach wdrożeń (CONTEXT ≠ production) migracji nie uruchamiamy, chyba że MIGRATE_ON_PREVIEW=true
 * (podgląd musi mieć wtedy własną bazę albo gałąź Neon).
 */
import pg from 'pg'
import { migrate } from '../server/db/migrator'
import { grantAppRole } from '../server/db/roles'

const url = process.env.DATABASE_MIGRATION_URL
const context = process.env.CONTEXT ?? 'local'
const allowed = context === 'production' || process.env.MIGRATE_ON_PREVIEW === 'true'

if (!url) {
  console.log('[migrate-on-build] brak DATABASE_MIGRATION_URL – pomijam (Netlify Database stosuje migracje sama).')
}
else if (!allowed) {
  console.log(`[migrate-on-build] kontekst "${context}" – pomijam (ustaw MIGRATE_ON_PREVIEW=true, jeśli podgląd ma własną bazę).`)
}
else {
  const applied = await migrate(url, { log: message => console.log(`[migrate-on-build] ${message}`) })
  console.log(`[migrate-on-build] ${applied.length ? `zastosowano migracje: ${applied.length}` : 'baza jest aktualna'}`)
  const role = process.env.DATABASE_APP_ROLE
  if (role) {
    const client = new pg.Client({ connectionString: url })
    await client.connect()
    try {
      await grantAppRole(client, role)
      console.log(`[migrate-on-build] uprawnienia roli ${role} aktualne`)
    }
    finally {
      await client.end()
    }
  }
  else {
    console.warn('[migrate-on-build] brak DATABASE_APP_ROLE – aplikacja powinna łączyć się rolą bez własności tabel (ADR-010)')
  }
}
