/**
 * drizzle-kit służy tu tylko jako pomocnik do szkicowania SQL (`pnpm db:draft`).
 * Źródłem prawdy są ręcznie przeglądane migracje w netlify/database/migrations
 * (Netlify stosuje je automatycznie przy wdrożeniu, lokalnie robi to `pnpm db:migrate`).
 */
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema/index.ts',
  out: './.drizzle-draft',
})
