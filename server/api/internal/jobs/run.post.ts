/**
 * Przetwarzanie kolejki zadań na żądanie funkcji cyklicznej Netlify (netlify/functions/jobs-cron.mts).
 * Chronione kluczem INTERNAL_API_KEY.
 *
 * Budżet 8 s: funkcja serwera na Netlify ma twardy limit czasu (dla funkcji synchronicznych domyślnie ok. 10 s –
 * sprawdź limit swojego planu), a funkcja cykliczna czeka na odpowiedź. Przerwanie w trakcie wysyłki oznaczałoby
 * zadanie „porzucone” i ponowienie po 5 min. Czego nie zdążymy teraz, zrobi następny przebieg.
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
  return runPendingJobs({ budgetMs: 8_000, batchSize: 5 })
})
