/**
 * Zasady dla nowych migracji (stosowanych automatycznie także na produkcji).
 */
import { expect, it } from 'vitest'
import { loadMigrations } from '../server/db/migrator'

/** Migracje sprzed wprowadzenia zasad – nie wolno ich edytować (sumy kontrolne), więc je pomijamy. */
const LEGACY = new Set([
  '20260928120000_demo-workshop',
  '20260928130000_demo-mechanics',
  '20260928140000_repair-demo-uuids',
])

it('migracje nie zakładają kont z hasłami ani nie zawierają prawdziwych adresów e-mail', async () => {
  const offenders: string[] = []
  for (const m of await loadMigrations()) {
    if (LEGACY.has(m.name)) continue
    const sql = m.sql.replace(/--[^\n]*/g, '')
    if (/insert\s+into\s+public\.account\b/i.test(sql)) offenders.push(`${m.name}: INSERT do public.account`)
    if (/\$[0-9a-z]*\$?[0-9a-f]{32}:[0-9a-f]{64,}/i.test(sql) || /'[0-9a-f]{32}:[0-9a-f]{128}'/i.test(sql)) offenders.push(`${m.name}: hash hasła`)
    const emails = sql.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g)?.filter(e => !/\.invalid$|@example\.(com|invalid)$/.test(e)) ?? []
    if (emails.length) offenders.push(`${m.name}: adresy e-mail ${emails.join(', ')}`)
  }
  expect(offenders, 'Dane demo i konta testowe należą do `pnpm db:seed:demo`, nie do migracji').toEqual([])
})
