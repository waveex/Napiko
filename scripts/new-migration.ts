/**
 * Tworzy pustą migrację w formacie Netlify Database:
 *   pnpm db:new dodaj-klientow   →   netlify/database/migrations/<czas UTC>_dodaj-klientow/migration.sql
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MIGRATIONS_DIR } from '../server/db/migrator'

const slug = process.argv[2]
if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
  console.error('Użycie: pnpm db:new <nazwa>   (małe litery, cyfry, myślniki, podkreślenia)')
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
const dir = join(MIGRATIONS_DIR, `${stamp}_${slug}`)
await mkdir(dir, { recursive: true })
await writeFile(join(dir, 'migration.sql'), `-- Napiko · ${slug}\n-- Pamiętaj: nowe tabele z org_id muszą mieć ENABLE + FORCE ROW LEVEL SECURITY i polityki tenant/system.\n\n`)
console.log(`Utworzono ${join(dir, 'migration.sql')}`)
