/**
 * Czy subskrypcja push tej przeglądarki należy do zalogowanej osoby (np. po zmianie konta na wspólnym telefonie
 * przeglądarka ma subskrypcję poprzedniej osoby – wtedy pokazujemy „Włącz”, a nie „Włączone”).
 */
import { and, eq } from 'drizzle-orm'
import { withSystem } from '../../db/tenant'
import { pushSubscription } from '../../db/schema'
import { pushUnsubscribeSchema } from '../../../shared/notifications'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { endpoint } = await readValidatedBody(event, body => pushUnsubscribeSchema.parse(body))
  const [row] = await withSystem(useDb(), tx => tx.select({ id: pushSubscription.id }).from(pushSubscription)
    .where(and(eq(pushSubscription.endpoint, endpoint), eq(pushSubscription.userId, session.user.id)))
    .limit(1))
  return { mine: !!row }
})
