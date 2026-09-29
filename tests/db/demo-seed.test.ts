import { readFile } from 'node:fs/promises'
import { afterAll, expect, it, vi } from 'vitest'
import { hashPassword } from 'better-auth/crypto'
import { createMemberWithOrg, createTestDb } from '../helpers'
import { createAuth } from '../../server/lib/auth'
import { getEnv } from '../../server/lib/env'
import { seedDemo } from '../../scripts/demo/seed'

const { db, pool } = createTestDb()
const disableLogins = await readFile('netlify/database/migrations/20260929200000_disable-demo-logins/migration.sql', 'utf8')
const legacyMechanics = await readFile('netlify/database/migrations/20260928130000_demo-mechanics/migration.sql', 'utf8')
const legacyRepair = await readFile('netlify/database/migrations/20260928140000_repair-demo-uuids/migration.sql', 'utf8')
const cleanup: { orgs: string[], users: string[] } = { orgs: [], users: [] }

afterAll(async () => {
  await pool.query('DELETE FROM public.organization WHERE id = ANY($1::uuid[])', [cleanup.orgs])
  await pool.query('DELETE FROM public."user" WHERE id = ANY($1::uuid[])', [cleanup.users])
  await pool.end()
})

const auth = createAuth({
  db,
  env: getEnv({ ...process.env, NODE_ENV: 'test', AUTH_REQUIRE_EMAIL_VERIFICATION: 'true' }),
  sendEmail: vi.fn(async () => {}),
})

async function demoMechanics(orgId: string) {
  return (await pool.query<{ id: string, email: string, has_password: boolean }>(`
    SELECT u.id, u.email, EXISTS (SELECT 1 FROM public.account a WHERE a.user_id = u.id AND a.provider_id = 'credential') AS has_password
    FROM public."user" u JOIN public.member m ON m.user_id = u.id
    WHERE m.organization_id = $1 AND u.email LIKE '%@demo.oxy.invalid' ORDER BY u.email`, [orgId])).rows
}

it('seed demo: dane warsztatu i mechanicy z hasłem z DEMO_PASSWORD, ponowne uruchomienie nie powiela danych', async () => {
  const owner = await createMemberWithOrg(db)
  cleanup.orgs.push(owner.orgId)
  cleanup.users.push(owner.userId)
  const ownerEmail = (await pool.query('SELECT email FROM public."user" WHERE id = $1', [owner.userId])).rows[0].email
  const password = 'demo-haslo-testowe'

  const client = await pool.connect()
  try {
    await seedDemo(client, { ownerEmail, passwordHash: await hashPassword(password) })
    await seedDemo(client, { ownerEmail, passwordHash: await hashPassword(password) })
  }
  finally {
    client.release()
  }

  const mechanics = await demoMechanics(owner.orgId)
  cleanup.users.push(...mechanics.map(m => m.id))
  expect(mechanics).toHaveLength(3)
  for (const m of mechanics) {
    const login = await auth.api.signInEmail({ body: { email: m.email, password } })
    expect(login.user.id).toBe(m.id)
  }
  const counter = await pool.connect()
  try {
    await counter.query('BEGIN')
    await counter.query('SELECT set_config(\'app.system\', \'on\', true)')
    const { rows: [orders] } = await counter.query('SELECT count(*)::int AS n FROM public.work_order WHERE org_id = $1', [owner.orgId])
    expect(orders.n).toBe(9)
    await counter.query('ROLLBACK')
  }
  finally {
    counter.release()
  }
  // Adresy mechaników demo są globalnie unikalne – sprzątamy przed kolejnym testem
  await pool.query('DELETE FROM public.organization WHERE id = $1', [owner.orgId])
  await pool.query('DELETE FROM public."user" WHERE id = ANY($1::uuid[])', [mechanics.map(m => m.id)])
})

it('migracja wyłącza logowanie kont demo, a seed je przywraca – z tymi samymi ID co dawne migracje', async () => {
  const owner = await createMemberWithOrg(db)
  cleanup.orgs.push(owner.orgId)
  cleanup.users.push(owner.userId)
  const ownerEmail = (await pool.query('SELECT email FROM public."user" WHERE id = $1', [owner.userId])).rows[0].email

  // Stan jak na bazach, na których działały dawne migracje demo (z zaszytym adresem właściciela)
  const legacyOwnerEmail = 'jablonsky97@gmail.com'
  await pool.query('UPDATE public."user" SET email = $1 WHERE id = $2', [legacyOwnerEmail, owner.userId])
  await pool.query(legacyMechanics)
  await pool.query(legacyRepair)
  const legacy = await demoMechanics(owner.orgId)
  cleanup.users.push(...legacy.map(m => m.id))
  expect(legacy.map(m => m.has_password)).toEqual([true, true, true])

  await pool.query(disableLogins)
  expect((await demoMechanics(owner.orgId)).map(m => m.has_password)).toEqual([false, false, false])
  await expect(auth.api.signInEmail({ body: { email: legacy[0]!.email, password: 'XYZ@2xyz' } })).rejects.toThrow()

  await pool.query('UPDATE public."user" SET email = $1 WHERE id = $2', [ownerEmail, owner.userId])
  const client = await pool.connect()
  try {
    await seedDemo(client, { ownerEmail, passwordHash: await hashPassword('nowe-haslo-demo') })
  }
  finally {
    client.release()
  }
  const restored = await demoMechanics(owner.orgId)
  expect(restored.map(m => m.id)).toEqual(legacy.map(m => m.id))
  expect(restored.map(m => m.has_password)).toEqual([true, true, true])
  const login = await auth.api.signInEmail({ body: { email: restored[0]!.email, password: 'nowe-haslo-demo' } })
  expect(login.user.id).toBe(restored[0]!.id)
})
