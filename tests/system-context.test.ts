/**
 * Kontekst systemowy (withSystem) omija izolację warsztatów. Może go używać tylko krótka lista plików –
 * nowe użycie wymaga świadomego dopisania tutaj (i uzasadnienia w komentarzu w kodzie).
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const ALLOWED = new Set([
  'server/db/tenant.ts', // definicja
  'server/db/jobs.ts', // kolejka zadań: pobieranie i zamykanie zadań wszystkich warsztatów
  'server/db/notification-jobs.ts', // obsługa zadań powiadomień (wysyłka poza żądaniem użytkownika)
  'server/db/notifications.ts', // sprzątanie (housekeeping)
  'server/utils/services.ts', // Better Auth: e-maile, zakładanie organizacji, zaproszenia
  'server/utils/customer-link.ts', // odczyt tokenu z linku klienta – dalej tylko withCustomerLink
  'server/db/audit-anchor.ts', // kotwice dziennika: głowy łańcuchów wszystkich warsztatów
])

async function sourceFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await sourceFiles(path))
    else if (/\.(ts|mts|vue)$/.test(entry.name)) out.push(path.replaceAll('\\', '/'))
  }
  return out
}

it('withSystem() tylko w dozwolonych plikach', async () => {
  const files = [...await sourceFiles('server'), ...await sourceFiles('netlify/functions')]
  const offenders: string[] = []
  for (const file of files) {
    if (ALLOWED.has(file)) continue
    if (/\bwithSystem\s*\(/.test(await readFile(file, 'utf8'))) offenders.push(file)
  }
  expect(offenders, 'Użyj withTenant / withUser / withCustomerLink albo dopisz plik do listy z uzasadnieniem').toEqual([])
})
