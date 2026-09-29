/**
 * Kolejka zadań: dodawanie w kontekście warsztatu, przetwarzanie, ponowienia, minimalizacja danych.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { job } from '../../server/db/schema'
import { enqueueJob, processJobs, recentFailedJobs } from '../../server/db/jobs'
import { withSystem, withTenant } from '../../server/db/tenant'
import { createMemberWithOrg, createTestDb } from '../helpers'

const { db, pool } = createTestDb()
let a: { userId: string, orgId: string }

beforeAll(async () => {
  a = await createMemberWithOrg(db)
})

beforeEach(async () => {
  await withSystem(db, tx => tx.execute(sql`delete from job`))
})

afterAll(async () => {
  await pool.end()
})

describe('kolejka zadań', () => {
  it('członek może dodać zadanie swojej organizacji, ale nie może czytać kolejki', async () => {
    await withTenant(db, a, tx => enqueueJob(tx, { type: 'test.ok', orgId: a.orgId, payload: { email: 'jan@example.com' } }))
    expect(await withTenant(db, a, tx => tx.select().from(job))).toHaveLength(0)
    expect(await withSystem(db, tx => tx.select().from(job))).toHaveLength(1)
  })

  it('po sukcesie oznacza zadanie jako wykonane i czyści jego treść', async () => {
    await withSystem(db, tx => enqueueJob(tx, { type: 'test.ok', payload: { email: 'jan@example.com' } }))
    const handled: unknown[] = []
    const result = await processJobs(db, {
      'test.ok': async (j) => {
        handled.push(j.payload)
      },
    })
    expect(result).toEqual({ processed: 1, failed: 0 })
    expect(handled).toEqual([{ email: 'jan@example.com' }])
    const [row] = await withSystem(db, tx => tx.select().from(job))
    expect(row).toMatchObject({ status: 'done', payload: {}, attempts: 1 })
  })

  it('po błędzie ponawia z opóźnieniem, a po wyczerpaniu prób oznacza jako nieudane', async () => {
    await withSystem(db, tx => enqueueJob(tx, { type: 'test.fail', payload: {}, maxAttempts: 2 }))
    const failing = {
      'test.fail': async () => {
        throw new Error('SMTP niedostępny')
      },
    }

    expect(await processJobs(db, failing)).toEqual({ processed: 0, failed: 1 })
    let [row] = await withSystem(db, tx => tx.select().from(job))
    expect(row).toMatchObject({ status: 'pending', attempts: 1, lastError: 'SMTP niedostępny' })
    expect(row!.runAt.getTime()).toBeGreaterThan(Date.now())

    // przyspieszamy czas ponowienia
    await withSystem(db, tx => tx.update(job).set({ runAt: new Date(Date.now() - 1000) }).where(eq(job.id, row!.id)))
    await processJobs(db, failing)
    ;[row] = await withSystem(db, tx => tx.select().from(job))
    expect(row).toMatchObject({ status: 'failed', attempts: 2 })
  })

  it('zadanie nieznanego typu nie blokuje kolejki', async () => {
    await withSystem(db, async (tx) => {
      await enqueueJob(tx, { type: 'nieznany', payload: {}, maxAttempts: 1 })
      await enqueueJob(tx, { type: 'test.ok', payload: {} })
    })
    const result = await processJobs(db, { 'test.ok': async () => {} })
    expect(result).toEqual({ processed: 1, failed: 1 })
  })
})

describe('kolejka zadań: limity czasu i nieudane zadania', () => {
  it('nieznany typ kończy się od razu jako nieudany, bez kolejnych prób', async () => {
    await withSystem(db, tx => enqueueJob(tx, { type: 'nieznany', payload: {}, maxAttempts: 8 }))
    await processJobs(db, {})
    const [row] = await withSystem(db, tx => tx.select().from(job))
    expect(row).toMatchObject({ status: 'failed', attempts: 1 })
    expect(row!.lastError).toMatch(/Brak obsługi/)
    expect((await recentFailedJobs(db, 24)).byType).toEqual({ nieznany: 1 })
  })

  it('budżet czasu sprawdzany przed każdym zadaniem; niezaczęte wracają do kolejki bez liczenia próby', async () => {
    await withSystem(db, async (tx) => {
      for (let i = 0; i < 4; i++) await enqueueJob(tx, { type: 'test.slow', payload: { i } })
    })
    const done: number[] = []
    const result = await processJobs(db, {
      'test.slow': async (j) => {
        done.push(j.payload.i as number)
        await new Promise(resolve => setTimeout(resolve, 60))
      },
    }, { batchSize: 10, budgetMs: 100 })
    expect(result.processed).toBe(done.length)
    expect(done.length).toBeLessThan(4)
    const rows = await withSystem(db, tx => tx.select().from(job))
    const waiting = rows.filter(r => r.status === 'pending')
    expect(waiting).toHaveLength(4 - done.length)
    expect(waiting.every(r => r.attempts === 0 && r.lockedAt === null)).toBe(true)
  })
})
