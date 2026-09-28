/**
 * Kontekst najemcy (warsztatu) dla zapytań do bazy.
 *
 * Każda operacja na danych warsztatu musi przejść przez withTenant(): transakcja ustawia
 * app.user_id i app.org_id tylko na swój czas trwania, a polityki RLS w bazie odcinają
 * wiersze innych organizacji. Bez kontekstu zapytania nie zwracają niczego.
 *
 * withSystem() służy wyłącznie procesom systemowym (kolejka zadań, zakładanie organizacji)
 * i jest jedynym miejscem, które omija izolację – łatwo je wyszukać w kodzie.
 */
import { sql } from 'drizzle-orm'
import type { Db, Tx } from './client'

export interface TenantContext {
  userId: string
  orgId: string
}

export async function withTenant<T>(db: Db, ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${ctx.userId}, true), set_config('app.org_id', ${ctx.orgId}, true)`)
    return fn(tx)
  })
}

export async function withSystem<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.system', 'on', true)`)
    return fn(tx)
  })
}
