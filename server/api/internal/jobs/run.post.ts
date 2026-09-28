/**
 * Przetwarzanie kolejki zadań na żądanie funkcji cyklicznej Netlify (netlify/functions/jobs-cron.mts).
 * Chronione kluczem INTERNAL_API_KEY.
 */
import { timingSafeEqual } from 'node:crypto'
import { getEnv } from '../../../lib/env'

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
  return runPendingJobs({ budgetMs: 20_000 })
})
