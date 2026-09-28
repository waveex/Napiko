import { readFile } from 'node:fs/promises'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PoolClient } from 'pg'
import { z } from 'zod'
import { createTestDb } from '../helpers'

const migration = await readFile('netlify/database/migrations/20260928120000_demo-workshop/migration.sql', 'utf8')
const repair = await readFile('netlify/database/migrations/20260928140000_repair-demo-uuids/migration.sql', 'utf8')
const { pool } = createTestDb()
let client: PoolClient

beforeEach(async () => {
  client = await pool.connect()
  await client.query('BEGIN')
})
afterEach(async () => {
  await client.query('ROLLBACK')
  client.release()
})
afterAll(async () => {
  await pool.end()
})

async function fixture(role = 'owner') {
  const { rows: [user] } = await client.query(`INSERT INTO public."user" (name, email)
    VALUES ('Demo owner', 'jablonsky97@gmail.com') RETURNING id`)
  const { rows: [org] } = await client.query(`INSERT INTO public.organization (name, slug, created_at)
    VALUES ('Demo workshop', 'demo-migration-test', now()) RETURNING id`)
  await client.query(`INSERT INTO public.member (organization_id, user_id, role, created_at)
    VALUES ($1, $2, $3, now())`, [org.id, user.id, role])
  return { userId: user.id, orgId: org.id }
}

describe('migracja danych demo', () => {
  it('naprawia UUID i zachowuje powiązania, zawartość, wyzwalacze oraz klucze obce', async () => {
    const { orgId } = await fixture()
    await client.query(migration)
    await client.query('SELECT set_config(\'app.system\', \'on\', true)')
    const { rows: [parent] } = await client.query('SELECT * FROM public.task WHERE org_id = $1 LIMIT 1', [orgId])
    const { rows: [child] } = await client.query(`INSERT INTO public.task (org_id, work_order_id, parent_id, title)
      VALUES ($1, $2, $3, 'Podzadanie dodane po seedzie') RETURNING id`, [orgId, parent.work_order_id, parent.id])
    await client.query(`INSERT INTO public.time_entry (org_id, task_id, work_order_id, ended_at)
      VALUES ($1, $2, $3, now())`, [orgId, parent.id, parent.work_order_id])
    const constraints = async () => (await client.query(`SELECT conrelid, conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY conrelid, conname`)).rows
    const triggers = async () => (await client.query(`SELECT tgrelid, tgname, tgenabled FROM pg_trigger
      WHERE NOT tgisinternal ORDER BY tgrelid, tgname`)).rows
    const beforeConstraints = await constraints()
    const beforeTriggers = await triggers()
    const snapshot = async () => {
      const data: Record<string, unknown> = {}
      for (const table of ['customer', 'vehicle', 'work_order', 'task', 'task_assignment', 'time_entry']) {
        data[table] = (await client.query(`SELECT * FROM public.${table} WHERE org_id = $1 ORDER BY 1, 2`, [orgId])).rows
      }
      return data
    }
    const before = await snapshot()
    await client.query(repair)
    const after = await snapshot()
    const convert = (value: unknown): unknown => {
      if (typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value) && !z.uuid().safeParse(value).success) {
        return `${value.slice(0, 14)}8${value.slice(15, 19)}8${value.slice(20)}`
      }
      if (Array.isArray(value)) return value.map(convert)
      if (value instanceof Date) return value
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convert(v)]))
      return value
    }
    expect(after).toEqual(convert(before))
    for (const table of ['customer', 'vehicle', 'work_order', 'task']) {
      const { rows } = await client.query(`SELECT id FROM public.${table} WHERE org_id = $1`, [orgId])
      for (const row of rows) expect(z.uuid().safeParse(row.id).success).toBe(true)
    }
    expect((await client.query('SELECT id FROM public.task WHERE id = $1', [child.id])).rows).toHaveLength(1)
    expect(await constraints()).toEqual(beforeConstraints)
    expect(await triggers()).toEqual(beforeTriggers)
    await client.query(repair)
    expect(await snapshot()).toEqual(after)
  })

  it('pomija bazę bez właściciela oraz konto bez roli owner', async () => {
    await client.query(migration)
    const { orgId } = await fixture('mechanic')
    await client.query(migration)
    await client.query('SELECT set_config(\'app.system\', \'on\', true)')
    const { rows } = await client.query('SELECT id FROM public.customer WHERE org_id = $1', [orgId])
    expect(rows).toHaveLength(0)
  })

  it('tworzy spójne dane tylko wskazanej organizacji i nie powiela ani nie nadpisuje ich', async () => {
    const { orgId } = await fixture('owner,mechanic')
    await client.query('SELECT set_config(\'app.system\', \'on\', true)')
    const before = (await client.query('SELECT count(*)::int AS n FROM public.customer')).rows[0].n
    await client.query('SELECT set_config(\'app.system\', \'\', true)')
    await client.query(migration)
    expect((await client.query('SELECT app.current_org_id() AS id')).rows[0].id).toBeNull()
    await client.query('SELECT set_config(\'app.system\', \'on\', true)')
    for (const [table, count] of [['customer', 9], ['vehicle', 9], ['work_order', 9], ['task', 27], ['task_assignment', 27]] as const) {
      expect((await client.query(`SELECT count(*)::int AS n FROM public.${table} WHERE org_id = $1`, [orgId])).rows[0].n).toBe(count)
    }
    expect((await client.query('SELECT count(*)::int AS n FROM public.customer')).rows[0].n).toBe(before + 9)
    expect((await client.query('SELECT status, count(*)::int AS n FROM public.task WHERE org_id = $1 GROUP BY status ORDER BY status', [orgId])).rows)
      .toEqual([{ status: 'done', n: 12 }, { status: 'in_progress', n: 3 }, { status: 'todo', n: 12 }])
    expect((await client.query(`SELECT id FROM public.task WHERE org_id = $1 AND (
      (status = 'todo' AND (started_at IS NOT NULL OR completed_at IS NOT NULL)) OR
      (status = 'done' AND (completed_at IS NULL OR completed_at < started_at)) OR
      (status = 'in_progress' AND (started_at IS NULL OR completed_at IS NOT NULL)))`, [orgId])).rows).toHaveLength(0)
    await client.query('UPDATE public.task SET title = \'Zmienione przez użytkownika\' WHERE org_id = $1', [orgId])
    await client.query(migration)
    expect((await client.query('SELECT count(*)::int AS n FROM public.task WHERE org_id = $1', [orgId])).rows[0].n).toBe(27)
    expect((await client.query('SELECT DISTINCT title FROM public.task WHERE org_id = $1', [orgId])).rows).toEqual([{ title: 'Zmienione przez użytkownika' }])
    expect((await client.query('SELECT value FROM public.org_sequence WHERE org_id = $1', [orgId])).rows).toEqual([{ value: 9 }])
  })

  it('odmawia wyboru przypadkowej organizacji, gdy właściciel ma kilka', async () => {
    const { userId } = await fixture()
    const { rows: [org] } = await client.query(`INSERT INTO public.organization (name, slug, created_at)
      VALUES ('Second workshop', 'demo-second-test', now()) RETURNING id`)
    await client.query(`INSERT INTO public.member (organization_id, user_id, role, created_at)
      VALUES ($1, $2, 'owner', now())`, [org.id, userId])
    await expect(client.query(migration)).rejects.toThrow('właściciel ma wiele organizacji')
  })
})
