/**
 * Kolejka zadań w bazie (wzorzec outbox).
 *
 * Zadanie dodaje się w tej samej transakcji co zmianę danych, więc nie ma sytuacji
 * „zapisano zmianę, ale e-mail zginął”. Przetwarzanie: zaraz po żądaniu (krótki budżet czasu)
 * oraz cyklicznie przez funkcję Netlify (ponowienia, zaległości).
 */
import { sql } from 'drizzle-orm'
import type { Db, DbOrTx } from './client'
import { job } from './schema'
import { withSystem } from './tenant'

export interface EnqueueJobInput {
  type: string
  payload: Record<string, unknown>
  orgId?: string | null
  runAt?: Date
  maxAttempts?: number
}

export async function enqueueJob(tx: DbOrTx, input: EnqueueJobInput) {
  await tx.insert(job).values({
    type: input.type,
    payload: input.payload,
    orgId: input.orgId ?? null,
    runAt: input.runAt ?? new Date(),
    maxAttempts: input.maxAttempts ?? 8,
  })
}

export interface ClaimedJob {
  id: string
  orgId: string | null
  type: string
  payload: Record<string, unknown>
  attempts: number
  maxAttempts: number
}

/** Zadania „running” dłużej niż ten czas uznajemy za porzucone (np. funkcja przekroczyła limit). */
const STALE_AFTER = '5 minutes'

export async function claimJobs(db: Db, limit: number): Promise<ClaimedJob[]> {
  return withSystem(db, async (tx) => {
    const result = await tx.execute<{
      id: string
      org_id: string | null
      type: string
      payload: Record<string, unknown>
      attempts: number
      max_attempts: number
    }>(sql`
      update job
      set status = 'running', locked_at = now(), attempts = attempts + 1
      where id in (
        select id from job
        where (status = 'pending' and run_at <= now())
           or (status = 'running' and locked_at < now() - ${STALE_AFTER}::interval)
        order by run_at
        limit ${limit}
        for update skip locked
      )
      returning id, org_id, type, payload, attempts, max_attempts
    `)
    return result.rows.map(r => ({
      id: r.id,
      orgId: r.org_id,
      type: r.type,
      payload: r.payload,
      attempts: r.attempts,
      maxAttempts: r.max_attempts,
    }))
  })
}

/** Po sukcesie usuwamy treść zadania (np. adres e-mail i link z tokenem) – minimalizacja danych. */
export async function completeJob(db: Db, id: string) {
  await withSystem(db, tx => tx.execute(sql`
    update job set status = 'done', payload = '{}'::jsonb, locked_at = null, last_error = null
    where id = ${id}
  `))
}

export async function failJob(db: Db, claimed: ClaimedJob, error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 2000)
  const final = claimed.attempts >= claimed.maxAttempts
  // Wykładnicze opóźnienie: 30 s, 1 min, 2 min, ... maks. 1 h.
  const delaySeconds = Math.min(30 * 2 ** (claimed.attempts - 1), 3600)
  await withSystem(db, tx => tx.execute(sql`
    update job
    set status = ${final ? 'failed' : 'pending'},
        run_at = now() + make_interval(secs => ${delaySeconds}),
        locked_at = null,
        last_error = ${message}
    where id = ${claimed.id}
  `))
}

export type JobHandler = (job: ClaimedJob) => Promise<void>

export interface ProcessResult {
  processed: number
  failed: number
}

export async function processJobs(
  db: Db,
  handlers: Record<string, JobHandler>,
  options: { batchSize?: number, budgetMs?: number } = {},
): Promise<ProcessResult> {
  const batchSize = options.batchSize ?? 10
  const budgetMs = options.budgetMs ?? 5000
  const started = Date.now()
  const result: ProcessResult = { processed: 0, failed: 0 }

  while (Date.now() - started < budgetMs) {
    const batch = await claimJobs(db, batchSize)
    if (batch.length === 0) break
    for (const claimed of batch) {
      try {
        const handler = handlers[claimed.type]
        if (!handler) throw new Error(`Brak obsługi zadania typu "${claimed.type}"`)
        await handler(claimed)
        await completeJob(db, claimed.id)
        result.processed++
      }
      catch (error) {
        await failJob(db, claimed, error)
        result.failed++
      }
    }
  }
  return result
}
