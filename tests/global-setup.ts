/**
 * Przed testami: czysta baza testowa z aktualnymi migracjami.
 */
import { isLocalDatabase, migrate, resetDatabase } from '../server/db/migrator'

export default async function setup() {
  try {
    process.loadEnvFile('.env')
  }
  catch {
    // CI
  }
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error('Brak TEST_DATABASE_URL (zob. .env.example).')
  if (!isLocalDatabase(url) && process.env.CI !== 'true') {
    throw new Error('Testy czyszczą bazę – TEST_DATABASE_URL musi wskazywać na lokalną bazę.')
  }
  await resetDatabase(url)
  await migrate(url)
}
