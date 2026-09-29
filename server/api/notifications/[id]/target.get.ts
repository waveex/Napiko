/**
 * Dokąd prowadzi powiadomienie (dotknięcie push, link z e-maila): oznacza je jako przeczytane
 * i zwraca warsztat oraz ścieżkę – aplikacja przełącza warsztat, jeśli powiadomienie dotyczy innego.
 * Kontekst osoby (withUser): aktywny może być inny warsztat; baza przepuszcza tylko powiadomienia zalogowanej osoby
 * z warsztatów, do których wciąż należy.
 */
import { and, eq, isNull } from 'drizzle-orm'
import { withUser } from '../../../db/tenant'
import { notification } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const id = await getIdParam(event)

  const target = await withUser(useDb(), session.user.id, async (tx) => {
    const [row] = await tx.select({ orgId: notification.orgId, link: notification.link }).from(notification)
      .where(and(eq(notification.id, id), eq(notification.userId, session.user.id)))
      .limit(1)
    if (!row) return null
    await tx.update(notification).set({ readAt: new Date() })
      .where(and(eq(notification.id, id), isNull(notification.readAt)))
    return row
  })
  if (!target) throw notFound('Nie znaleziono powiadomienia.')
  return {
    orgId: target.orgId,
    link: target.link ?? '/app/notifications',
    switchOrganization: target.orgId !== session.session.activeOrganizationId,
  }
})
