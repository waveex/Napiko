import { expect, it } from 'vitest'
import { statusLinkToken } from '../server/db/customer-notifications'

const base = { BETTER_AUTH_SECRET: 'a'.repeat(32), STATUS_LINK_SECRET: undefined }

it('token linku statusu: osobny sekret, a bez niego – sekret logowania (zgodność wstecz)', () => {
  const legacy = statusLinkToken(base, 'org', 'order', 1)
  const separate = statusLinkToken({ ...base, STATUS_LINK_SECRET: 'b'.repeat(32) }, 'org', 'order', 1)
  expect(legacy).toHaveLength(24)
  expect(separate).not.toBe(legacy)
  // Rotacja sekretu logowania nie zmienia linków, gdy ustawiony jest osobny sekret
  expect(statusLinkToken({ BETTER_AUTH_SECRET: 'c'.repeat(32), STATUS_LINK_SECRET: 'b'.repeat(32) }, 'org', 'order', 1)).toBe(separate)
})
