/**
 * Codzienne sprzątanie na żądanie funkcji cyklicznej Netlify (netlify/functions/housekeeping-cron.mts):
 * stare powiadomienia zespołu, wykonane zadania kolejki, wyłączone telefony klientów, a także alarm
 * o zadaniach, które ostatecznie się nie udały (np. SMS-y, których nie dało się wysłać).
 * Chronione kluczem INTERNAL_API_KEY (jak przetwarzanie kolejki).
 */
import { timingSafeEqual } from 'node:crypto'
import { getEnv } from '../../lib/env'
import { cleanupNotifications } from '../../db/notifications'
import { recentFailedJobs } from '../../db/jobs'
import { anchorKey, collectChainHeads, verifyAnchor, type AuditAnchor } from '../../db/audit-anchor'

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

export default defineEventHandler(async (event) => {
  const expected = getEnv().INTERNAL_API_KEY
  const provided = getRequestHeader(event, 'x-internal-key') ?? ''
  if (!expected || !safeEqual(provided, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const db = useDb()
  const failed = await recentFailedJobs(db, 24)
  if (failed.total) {
    // Widoczne w logach funkcji Netlify (i w monitoringu, gdy zostanie podłączony)
    console.error(`[jobs] nieudane zadania z ostatnich 24 h: ${failed.total}`, failed.byType)
  }
  return { ...await cleanupNotifications(db), failedJobs24h: failed, auditAnchor: await anchorAuditLog(db).catch((error: unknown) => {
    console.error('[audit-anchor]', error)
    return { error: (error as Error).message }
  }) }
})

/** Kotwica dziennika zdarzeń: sprawdzenie wczorajszej i zapis dzisiejszej (ADR-010). */
async function anchorAuditLog(db: ReturnType<typeof useDb>) {
  const env = getEnv()
  const bucket = env.AUDIT_ANCHOR_BUCKET
  if (!bucket) return { skipped: 'AUDIT_ANCHOR_BUCKET nie jest ustawiony' }
  const storage = useFileStorage()
  const now = new Date()
  const previous = await storage.getJson<AuditAnchor>(anchorKey(new Date(now.getTime() - 24 * 3600 * 1000)), { bucket })
  const mismatches = previous ? await verifyAnchor(db, previous) : []
  if (mismatches.length) {
    console.error('[audit-anchor] DZIENNIK ZDARZEŃ NIE ZGADZA SIĘ Z KOTWICĄ – możliwa ingerencja w bazę', mismatches)
  }
  const anchor: AuditAnchor = { version: 1, createdAt: now.toISOString(), heads: await collectChainHeads(db) }
  const retainUntil = new Date(now.getTime() + env.AUDIT_ANCHOR_RETENTION_DAYS * 24 * 3600 * 1000)
  await storage.putJson(anchorKey(now), anchor, { bucket, retainUntil })
  return { organizations: anchor.heads.length, verifiedPrevious: !!previous, mismatches: mismatches.length }
}
