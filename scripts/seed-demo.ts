/**
 * Dane demonstracyjne: 9 zleceń z zadaniami i trzech mechaników (mechanik1..3@demo.oxy.invalid).
 *
 *   DEMO_OWNER_EMAIL=ja@example.com pnpm db:seed:demo
 *
 * Konto właściciela musi istnieć i mieć dokładnie jedną organizację. Hasło mechaników: DEMO_PASSWORD
 * (domyślnie losowe – skrypt je wypisze). Skrypt działa tylko na lokalnej bazie; na podglądzie wdrożenia
 * albo innej bazie testowej dodaj --force. Nigdy nie uruchamiaj go na produkcji z prawdziwymi klientami.
 */
import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { hashPassword } from 'better-auth/crypto'
import { isLocalDatabase } from '../server/db/migrator'
import { seedDemo } from './demo/seed'

try {
  process.loadEnvFile('.env')
}
catch {
  // brak .env – korzystamy ze zmiennych środowiskowych
}

const url = process.env.DATABASE_URL
const ownerEmail = process.env.DEMO_OWNER_EMAIL?.trim()
if (!url || !ownerEmail) {
  console.error('Ustaw DATABASE_URL i DEMO_OWNER_EMAIL (e-mail właściciela warsztatu, do którego trafią dane demo).')
  process.exit(1)
}
if (!isLocalDatabase(url) && !process.argv.includes('--force')) {
  console.error('Odmowa: seed demo działa tylko na lokalnej bazie (dodaj --force dla bazy podglądu/testowej).')
  process.exit(1)
}

const password = process.env.DEMO_PASSWORD || randomBytes(9).toString('base64url')
if (password.length < 10) {
  console.error('DEMO_PASSWORD musi mieć co najmniej 10 znaków (jak każde hasło w Napiko).')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  client.on('notice', notice => console.log(notice.message))
  await seedDemo(client, { ownerEmail, passwordHash: await hashPassword(password) })
  console.log(`Dane demo gotowe. Mechanicy: mechanik1..3@demo.oxy.invalid, hasło: ${password}`)
}
finally {
  await client.end()
}
