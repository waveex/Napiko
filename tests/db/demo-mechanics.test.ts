import { readFile } from 'node:fs/promises'
import { afterAll, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createMemberWithOrg, createTestDb } from '../helpers'
import { createAuth } from '../../server/lib/auth'
import { getEnv } from '../../server/lib/env'

const { db, pool } = createTestDb()
const migration = await readFile('netlify/database/migrations/20260928130000_demo-mechanics/migration.sql', 'utf8')
const repair = await readFile('netlify/database/migrations/20260928140000_repair-demo-uuids/migration.sql', 'utf8')
let orgId: string | undefined
let ownerId: string | undefined
const mechanicIds: string[] = []

afterAll(async () => {
  if (orgId) await pool.query('DELETE FROM public.organization WHERE id = $1', [orgId])
  await pool.query('DELETE FROM public."user" WHERE id = ANY($1::uuid[])', [[...mechanicIds, ...ownerId ? [ownerId] : []]])
  await pool.end()
})

it('tworzy trzech mechaników z działającym logowaniem i zachowuje konta po ponownym uruchomieniu', async () => {
  const fixture = await createMemberWithOrg(db)
  orgId = fixture.orgId
  ownerId = fixture.userId
  await pool.query('UPDATE public."user" SET email = $1 WHERE id = $2', ['jablonsky97@gmail.com', ownerId])
  await pool.query(migration)
  await pool.query(repair)
  const { rows } = await pool.query(`SELECT u.id, u.email, m.role, a.password
    FROM public."user" u JOIN public.member m ON m.user_id = u.id
    JOIN public.account a ON a.user_id = u.id AND a.provider_id = 'credential'
    WHERE m.organization_id = $1 ORDER BY u.email`, [orgId])
  mechanicIds.push(...rows.map(row => row.id))
  expect(rows).toHaveLength(3)
  const sendEmail = vi.fn(async () => {})
  const auth = createAuth({
    db,
    env: getEnv({ ...process.env, NODE_ENV: 'test', AUTH_REQUIRE_EMAIL_VERIFICATION: 'true' }),
    sendEmail,
  })
  for (const row of rows) {
    expect(z.uuid().safeParse(row.id).success).toBe(true)
    expect(row.role).toBe('mechanic')
    const login = await auth.api.signInEmail({ body: { email: row.email, password: 'XYZ@2xyz' } })
    expect(login.user.id).toBe(row.id)
    expect(login.token).toBeTruthy()
  }
  expect(sendEmail).not.toHaveBeenCalled()
  await pool.query(repair)
  expect((await pool.query(`SELECT u.id, u.email, m.role, a.password
    FROM public."user" u JOIN public.member m ON m.user_id = u.id
    JOIN public.account a ON a.user_id = u.id AND a.provider_id = 'credential'
    WHERE m.organization_id = $1 ORDER BY u.email`, [orgId])).rows).toEqual(rows)
})
