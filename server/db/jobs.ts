/**
 * Kolejka zadań w bazie (wzorzec outbox).
 *
 * Zadanie dodaje się w tej samej transakcji co zmianę danych, więc nie ma sytuacji
 * „zapisano zmianę, ale e-mail zginął”. Przetwarzanie: zaraz po żądaniu (krótki budżet czasu)
 * oraz cyklicznie przez funkcję Netlify (ponowienia, zaległości).
 */
import { inArray, sql } from 'drizzle-orm'
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

/**
 * Zadania „running” dłużej niż ten czas uznajemy za porzucone (np. funkcja przekroczyła limit czasu).
 * Musi być wyraźnie dłuższy niż najdłuższe przetwarzanie (budżet + limity czasu SMTP/SMS ≈ 1 min),
 * inaczej zadanie wciąż wykonywane trafiłoby drugi raz do kolejki.
 */
const STALE_AFTER = '5 minutes'

/**
 * Semantyka kolejki: „co najmniej raz”. Zadanie może wykonać się ponownie (np. wysyłka się udała, a zapis
 * „done” już nie). Obsługa zadań, które wychodzą na zewnątrz, przekazuje dostawcy klucz idempotencji
 * (id zadania) – zob. OutgoingSms.idempotencyKey i OutgoingEmail.idempotencyKey.
 */

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

/** Błąd, którego ponowienie nic nie da (np. nieznany typ zadania) – zadanie od razu kończy się jako nieudane. */
export class PermanentJobError extends Error {}

export async function failJob(db: Db, claimed: ClaimedJob, error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 2000)
  const final = claimed.attempts >= claimed.maxAttempts || error instanceof PermanentJobError
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

/**
 * Oddaje do kolejki zadania pobrane, ale nierozpoczęte (skończył się budżet czasu) – bez liczenia próby,
 * żeby nie czekały 5 minut jako „porzucone”.
 */
export async function releaseJobs(db: Db, ids: string[]) {
  if (!ids.length) return
  await withSystem(db, tx => tx.update(job)
    .set({ status: 'pending', lockedAt: null, attempts: sql`greatest(${job.attempts} - 1, 0)` })
    .where(inArray(job.id, ids)))
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
    for (const [index, claimed] of batch.entries()) {
      // Budżet sprawdzamy przed każdym zadaniem, nie przed partią: wolny SMTP nie wydłuży przebiegu ponad limit funkcji
      if (index > 0 && Date.now() - started >= budgetMs) {
        await releaseJobs(db, batch.slice(index).map(j => j.id))
        return result
      }
      try {
        const handler = handlers[claimed.type]
        if (!handler) throw new PermanentJobError(`Brak obsługi zadania typu "${claimed.type}"`)
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

/** Zadania zakończone jako nieudane w ostatnich godzinach (alarm w codziennym sprzątaniu). */
export async function recentFailedJobs(db: Db, hours: number) {
  const result = await withSystem(db, tx => tx.execute<{ type: string, n: number }>(sql`
    select type, count(*)::int as n from job
    where status = 'failed' and updated_at > now() - make_interval(hours => ${hours})
    group by type order by type
  `))
  const byType = Object.fromEntries(result.rows.map(r => [r.type, r.n]))
  return { total: result.rows.reduce((sum, r) => sum + r.n, 0), byType }
}
