import { defineConfig } from 'vitest/config'

// Bez bazy danych, ładowania lokalnych sekretów i prawdziwych wysyłek.
export default defineConfig({
  test: {
    include: ['tests/sms-mail.test.ts'],
    env: {
      BETTER_AUTH_SECRET: 'sms-tests-only-secret-at-least-32-characters',
      SMS_PROVIDER: 'log',
    },
  },
})
