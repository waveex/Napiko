import { randomUUID } from 'node:crypto'
import { createDb, createPool, type Db } from '../server/db/client'
import { member, organization, user } from '../server/db/schema'

export function createTestDb() {
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error('Brak TEST_DATABASE_URL')
  const pool = createPool(url, { max: 4 })
  return { db: createDb(pool), pool }
}

/** Tworzy użytkownika, organizację i członkostwo (tabele logowania nie mają RLS). */
export async function createMemberWithOrg(db: Db, opts: { role?: string, kind?: string } = {}) {
  const suffix = randomUUID().slice(0, 8)
  const [u] = await db.insert(user).values({
    name: `Test ${suffix}`,
    email: `test-${suffix}@example.com`,
    emailVerified: true,
  }).returning()
  const [org] = await db.insert(organization).values({
    name: `Warsztat ${suffix}`,
    slug: `warsztat-${suffix}`,
    createdAt: new Date(),
    kind: opts.kind ?? 'workshop',
  }).returning()
  await db.insert(member).values({
    organizationId: org!.id,
    userId: u!.id,
    role: opts.role ?? 'owner',
    createdAt: new Date(),
  })
  return { userId: u!.id, orgId: org!.id }
}

/** Dodaje nowego użytkownika do istniejącej organizacji. */
export async function addMember(db: Db, orgId: string, role = 'mechanic') {
  const suffix = randomUUID().slice(0, 8)
  const [u] = await db.insert(user).values({
    name: `Mechanik ${suffix}`,
    email: `mechanik-${suffix}@example.com`,
    emailVerified: true,
  }).returning()
  await db.insert(member).values({ organizationId: orgId, userId: u!.id, role, createdAt: new Date() })
  return { userId: u!.id, orgId }
}

/** Zwraca komunikat błędu PostgreSQL (Drizzle opakowuje go w „Failed query”). */
export async function pgErrorMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  }
  catch (error) {
    const err = error as Error & { cause?: Error }
    return err.cause?.message ?? err.message
  }
  throw new Error('Oczekiwano błędu bazy danych, a zapytanie się powiodło')
}
