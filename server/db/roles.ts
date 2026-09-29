/**
 * Rola bazy dla aplikacji w czasie działania (ADR-010).
 *
 * Migracje wykonuje właściciel tabel (DATABASE_MIGRATION_URL). Aplikacja łączy się osobną rolą (DATABASE_URL):
 *  - bez własności tabel, bez BYPASSRLS – nie wyłączy RLS, nie usunie wyzwalaczy, nie zmieni schematu;
 *  - tylko SELECT/INSERT/UPDATE/DELETE na danych, bez TRUNCATE;
 *  - dziennik zdarzeń wyłącznie do odczytu i dopisywania – nawet z app.audit_purge nie usunie wpisów
 *    (retencję wykonuje właściciel);
 *  - bez dostępu do tabeli migracji.
 *
 * Funkcja jest idempotentna: migrate-on-build uruchamia ją po każdej migracji (nowe tabele dostają uprawnienia).
 */
import type pg from 'pg'

const ROLE_RE = /^[a-z_][a-z0-9_]{0,62}$/

export async function grantAppRole(client: pg.ClientBase, role: string) {
  if (!ROLE_RE.test(role)) throw new Error(`Nieprawidłowa nazwa roli: ${role}`)
  const r = `"${role}"`
  const statements = [
    `GRANT USAGE ON SCHEMA public, app TO ${r}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${r}`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${r}`,
    `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO ${r}`,
    `REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_event FROM ${r}`,
    `REVOKE ALL ON public._oxy_migrations FROM ${r}`,
    // Tabele i sekwencje tworzone przez kolejne migracje (właściciel = bieżąca rola)
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${r}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${r}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT EXECUTE ON FUNCTIONS TO ${r}`,
  ]
  const { rows: [info] } = await client.query<{ bypass: boolean, superuser: boolean }>(
    'SELECT rolbypassrls AS bypass, rolsuper AS superuser FROM pg_roles WHERE rolname = $1', [role])
  if (!info) throw new Error(`Rola ${role} nie istnieje – utwórz ją w panelu bazy (Neon: Roles).`)
  if (info.bypass || info.superuser) throw new Error(`Rola ${role} omija RLS (SUPERUSER/BYPASSRLS) – nie nadaje się dla aplikacji.`)
  const { rows: owned } = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tableowner = $1`, [role])
  if (owned[0]!.n > 0) throw new Error(`Rola ${role} jest właścicielem tabel – aplikacja musi łączyć się inną rolą niż migracje.`)
  for (const statement of statements) await client.query(statement)
}
