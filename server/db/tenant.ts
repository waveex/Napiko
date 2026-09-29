/**
 * Kontekst najemcy (warsztatu) dla zapytań do bazy.
 *
 * Każda operacja na danych warsztatu musi przejść przez withTenant(): transakcja ustawia
 * app.user_id i app.org_id tylko na swój czas trwania, a polityki RLS w bazie odcinają
 * wiersze innych organizacji. Bez kontekstu zapytania nie zwracają niczego.
 *
 * Węższe konteksty (migracja 20260929210000_scoped-contexts):
 *  - withUser() – rzeczy należące do osoby niezależnie od warsztatu (urządzenia push, powiadomienia
 *    ze wszystkich jej warsztatów); ustawia tylko app.user_id,
 *  - withCustomerLink() – klient z linku bez konta (strona akceptacji, strona statusu); baza przepuszcza
 *    wyłącznie warsztat, do którego należy link.
 *
 * withSystem() omija izolację i służy wyłącznie procesom systemowym (kolejka zadań, sprzątanie, zakładanie
 * organizacji, odczyt tokenu z linku). Lista plików, które mogą go używać, jest w tests/system-context.test.ts.
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

export async function withUser<T>(db: Db, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`)
    return fn(tx)
  })
}

/** Klient z linku (bez konta): dostęp tylko do jednego warsztatu – tego, do którego należy link. */
export async function withCustomerLink<T>(db: Db, orgId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${orgId}, true), set_config('app.customer_link', ${orgId}, true)`)
    return fn(tx)
  })
}

export async function withSystem<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.system', 'on', true)`)
    return fn(tx)
  })
}
