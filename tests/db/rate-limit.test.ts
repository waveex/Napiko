import { afterAll, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { hitRateLimit } from '../../server/utils/rate-limit'
import { createTestDb } from '../helpers'

const { db, pool } = createTestDb()
afterAll(async () => {
  await pool.end()
})

it('limit w oknie czasu, po oknie licznik od nowa', async () => {
  const key = `test:${randomUUID()}`
  for (let i = 1; i <= 3; i++) expect((await hitRateLimit(db, key, 3, 60)).allowed).toBe(true)
  const blocked = await hitRateLimit(db, key, 3, 60)
  expect(blocked).toMatchObject({ allowed: false, count: 4 })
  expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  // okno minęło
  await db.execute(sql`update rate_limit set last_request = last_request - 61000 where key = ${key}`)
  expect(await hitRateLimit(db, key, 3, 60)).toMatchObject({ allowed: true, count: 1 })
  await db.execute(sql`delete from rate_limit where key = ${key}`)
})
