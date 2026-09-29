/**
 * Włączenie push na tym urządzeniu (członek zespołu). Jedno urządzenie należy do jednej osoby:
 * po zalogowaniu kogoś innego na tym samym telefonie subskrypcja przechodzi na niego. Przejęcie cudzego wiersza
 * (niewidocznego w RLS) robi funkcja bazy app.claim_push_subscription – tożsamość wyłącznie z app.user_id.
 */
import { sql } from 'drizzle-orm'
import { withUser } from '../../db/tenant'
import { pushSubscriptionSchema } from '../../../shared/notifications'

/** Najwyżej tyle urządzeń jednej osoby – najstarsze usuwamy. */
const MAX_DEVICES = 10

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  if (!usePush().enabled) throw createError({ statusCode: 409, message: 'Powiadomienia push nie są skonfigurowane na serwerze.' })
  const input = await readValidatedBody(event, body => pushSubscriptionSchema.parse(body))
  const userAgent = getRequestHeader(event, 'user-agent')?.slice(0, 300) ?? null

  await withUser(useDb(), session.user.id, tx => tx.execute(sql`
    select app.claim_push_subscription(${input.endpoint}, ${input.keys.p256dh}, ${input.keys.auth}, ${userAgent}, ${MAX_DEVICES})
  `))
  return { ok: true }
})
