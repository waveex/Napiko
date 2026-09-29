/**
 * Kotwice dziennika zdarzeń (ADR-010).
 *
 * Łańcuch hashy w audit_event wykrywa zmianę pojedynczego wpisu, ale ktoś z pełnym dostępem do bazy mógłby
 * usunąć dziennik i wstawić go od nowa – łańcuch przeliczyłby się poprawnie. Dlatego raz na dobę zapisujemy
 * „głowę” łańcucha każdego warsztatu (numer i hash ostatniego wpisu) poza bazą, w magazynie z blokadą obiektów.
 * Przy kolejnym zapisie porównujemy poprzednią kotwicę z bazą: wpis o tym numerze musi mieć ten sam hash.
 */
import { sql } from 'drizzle-orm'
import type { Db } from './client'
import { withSystem } from './tenant'

export interface ChainHead {
  orgId: string
  seq: number
  hash: string
}

export interface AuditAnchor {
  version: 1
  createdAt: string
  heads: ChainHead[]
}

export async function collectChainHeads(db: Db): Promise<ChainHead[]> {
  const result = await withSystem(db, tx => tx.execute<{ org_id: string, seq: string, hash: string }>(sql`
    select distinct on (org_id) org_id, seq, hash from audit_event order by org_id, seq desc
  `))
  return result.rows.map(r => ({ orgId: r.org_id, seq: Number(r.seq), hash: r.hash }))
}

export interface AnchorMismatch extends ChainHead {
  /** Hash tego wpisu w bazie teraz (null – wpisu już nie ma). */
  actual: string | null
  /** Pierwszy uszkodzony wpis łańcucha (null – łańcuch spójny). */
  firstBroken: number | null
}

/** Porównuje zapisaną kotwicę z bazą. Pusta lista = dziennik nie był przepisywany od chwili kotwicy. */
export async function verifyAnchor(db: Db, anchor: AuditAnchor): Promise<AnchorMismatch[]> {
  if (!anchor.heads.length) return []
  return withSystem(db, async (tx) => {
    const mismatches: AnchorMismatch[] = []
    for (const head of anchor.heads) {
      const result = await tx.execute<{ hash: string | null, first_broken: string | null }>(sql`
        select (select hash from audit_event where org_id = ${head.orgId} and seq = ${head.seq}) as hash,
               app.audit_chain_first_broken(${head.orgId}::uuid) as first_broken
      `)
      const row = result.rows[0]
      const actual = row?.hash ?? null
      const firstBroken = row?.first_broken == null ? null : Number(row.first_broken)
      if (actual !== head.hash || firstBroken !== null) mismatches.push({ ...head, actual, firstBroken })
    }
    return mismatches
  })
}

export function anchorKey(date: Date) {
  return `audit-anchors/${date.toISOString().slice(0, 10)}.json`
}
