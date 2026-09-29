/**
 * Wyłączenie push na tym urządzeniu (także przy wylogowaniu – kolejna osoba na tym telefonie nie dostanie cudzych powiadomień).
 */
import { and, eq } from 'drizzle-orm'
import { withSystem } from '../../db/tenant'
import { pushSubscription } from '../../db/schema'
import { pushUnsubscribeSchema } from '../../../shared/notifications'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { endpoint } = await readValidatedBody(event, body => pushUnsubscribeSchema.parse(body))
  const removed = await withSystem(useDb(), tx => tx.delete(pushSubscription)
    .where(and(eq(pushSubscription.endpoint, endpoint), eq(pushSubscription.userId, session.user.id)))
    .returning({ id: pushSubscription.id }))
  return { removed: removed.length }
})
