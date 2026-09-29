/**
 * Codzienne sprzątanie na żądanie funkcji cyklicznej Netlify (netlify/functions/housekeeping-cron.mts):
 * stare powiadomienia zespołu, wykonane zadania kolejki, wyłączone telefony klientów.
 * Chronione kluczem INTERNAL_API_KEY (jak przetwarzanie kolejki).
 */
import { timingSafeEqual } from 'node:crypto'
import { getEnv } from '../../lib/env'
import { cleanupNotifications } from '../../db/notifications'

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
  return cleanupNotifications(useDb())
})
