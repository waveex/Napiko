import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { createAuth } from '../server/lib/auth'
import { getEnv } from '../server/lib/env'
import { createTestDb } from './helpers'

const { db, pool } = createTestDb()
afterAll(async () => {
  await pool.end()
})

describe('potwierdzanie rejestracji', () => {
  it.each([false, true])('rejestracja i logowanie przy wymaganej weryfikacji: %s', async (required) => {
    const sendEmail = vi.fn(async () => {})
    const env = getEnv({
      ...process.env,
      NODE_ENV: 'test',
      AUTH_REQUIRE_EMAIL_VERIFICATION: String(required),
    })
    const auth = createAuth({ db, env, sendEmail })
    const email = `auth-${randomUUID()}@example.com`
    const password = 'Test-password-123!'
    const result = await auth.api.signUpEmail({ body: { name: 'Test', email, password } })

    expect(result.user.emailVerified).toBe(false)
    expect(Boolean(result.token)).toBe(!required)
    if (required) {
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: email, template: 'verify-email' }))
      await expect(auth.api.signInEmail({ body: { email, password } })).rejects.toMatchObject({
        statusCode: 403,
        body: expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' }),
      })
    }
    else {
      expect(sendEmail).not.toHaveBeenCalled()
      const login = await auth.api.signInEmail({ body: { email, password } })
      expect(login.token).toBeTruthy()
      // Ponowne włączenie wymogu obejmuje również konta utworzone bez potwierdzenia.
      const strictAuth = createAuth({ db, env: { ...env, AUTH_REQUIRE_EMAIL_VERIFICATION: true }, sendEmail })
      await expect(strictAuth.api.signInEmail({ body: { email, password } })).rejects.toMatchObject({
        statusCode: 403,
        body: expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' }),
      })
    }
  })
})
