import { sql } from 'drizzle-orm'

/** Stan aplikacji i połączenia z bazą (do monitoringu). */
export default defineEventHandler(async () => {
  const started = Date.now()
  await useDb().execute(sql`select 1`)
  return { status: 'ok', db: { latencyMs: Date.now() - started } }
})
