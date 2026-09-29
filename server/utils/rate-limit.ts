/**
 * Prosty limit żądań w bazie (tabela rate_limit – ta sama, której używa Better Auth dla logowania).
 * Funkcje serverless nie dzielą pamięci, więc licznik musi być w bazie. Okno stałe, jedno zapytanie na żądanie.
 */
import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'

export interface RateLimitResult {
  allowed: boolean
  count: number
  retryAfterSeconds: number
}

export async function hitRateLimit(db: Db, key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = now - windowSeconds * 1000
  const result = await db.execute<{ count: number, last_request: string }>(sql`
    insert into rate_limit (key, count, last_request) values (${key}, 1, ${now})
    on conflict (key) do update set
      count = case when rate_limit.last_request < ${windowStart} then 1 else rate_limit.count + 1 end,
      last_request = case when rate_limit.last_request < ${windowStart} then ${now} else rate_limit.last_request end
    returning count, last_request
  `)
  const row = result.rows[0]!
  const count = Number(row.count)
  const retryAfterSeconds = Math.max(1, Math.ceil((Number(row.last_request) + windowSeconds * 1000 - now) / 1000))
  return { allowed: count <= limit, count, retryAfterSeconds }
}
