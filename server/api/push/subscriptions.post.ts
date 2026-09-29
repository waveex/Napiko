/**
 * Włączenie push na tym urządzeniu (członek zespołu). Jedno urządzenie należy do jednej osoby:
 * po zalogowaniu kogoś innego na tym samym telefonie subskrypcja przechodzi na niego (kontekst systemowy,
 * bo cudzy wiersz jest niewidoczny w RLS; tożsamość bierzemy z sesji).
 */
import { sql } from 'drizzle-orm'
import { withSystem } from '../../db/tenant'
import { pushSubscription } from '../../db/schema'
import { pushSubscriptionSchema } from '../../../shared/notifications'

/** Najwyżej tyle urządzeń jednej osoby – najstarsze usuwamy. */
const MAX_DEVICES = 10

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  if (!usePush().enabled) throw createError({ statusCode: 409, message: 'Powiadomienia push nie są skonfigurowane na serwerze.' })
  const input = await readValidatedBody(event, body => pushSubscriptionSchema.parse(body))
  const userAgent = getRequestHeader(event, 'user-agent')?.slice(0, 300) ?? null

  await withSystem(useDb(), async (tx) => {
    await tx.insert(pushSubscription).values({
      userId: session.user.id,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent,
    }).onConflictDoUpdate({
      target: pushSubscription.endpoint,
      set: { userId: session.user.id, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent },
    })
    await tx.execute(sql`
      delete from push_subscription where user_id = ${session.user.id} and id not in (
        select id from push_subscription where user_id = ${session.user.id}
        order by coalesce(last_used_at, created_at) desc limit ${MAX_DEVICES}
      )
    `)
  })
  return { ok: true }
})
