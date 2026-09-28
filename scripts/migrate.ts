/**
 * Stosuje migracje z netlify/database/migrations do bazy z DATABASE_URL.
 *   pnpm db:migrate          – zastosuj brakujące migracje
 *   pnpm db:reset            – wyczyść lokalną bazę i zastosuj wszystko od nowa
 */
import { isLocalDatabase, migrate, resetDatabase } from '../server/db/migrator'

try {
  process.loadEnvFile('.env')
}
catch {
  // brak .env – korzystamy ze zmiennych środowiskowych
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Brak DATABASE_URL. Skopiuj .env.example do .env albo ustaw zmienną środowiskową.')
  process.exit(1)
}

if (process.argv.includes('--reset')) {
  if (!isLocalDatabase(url) && !process.argv.includes('--force')) {
    console.error('Odmowa: --reset działa tylko na lokalnej bazie (dodaj --force, jeśli na pewno wiesz, co robisz).')
    process.exit(1)
  }
  console.log('Czyszczę bazę…')
  await resetDatabase(url)
}

const applied = await migrate(url, { log: message => console.log(message) })
console.log(applied.length ? `Zastosowano migracje: ${applied.length}.` : 'Baza jest aktualna.')
