/**
 * Sesja i kontekst aktywnego warsztatu w endpointach API.
 */
import type { H3Event } from 'h3'
import { and, eq } from 'drizzle-orm'
import { member } from '../db/schema'
import type { TenantContext } from '../db/tenant'
import { hasPermission, type PermissionRequest } from '../../shared/permissions'

export async function requireSession(event: H3Event) {
  const session = await useAuth().api.getSession({ headers: event.headers })
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Zaloguj się, aby kontynuować.' })
  }
  return session
}

export interface TenantRequestContext extends TenantContext {
  role: string
}

/**
 * Wymaga zalogowania, aktywnej organizacji, członkostwa i (opcjonalnie) uprawnień.
 * Samo członkostwo baza sprawdza jeszcze raz w politykach RLS.
 */
export async function requireTenant(event: H3Event, permissions?: PermissionRequest): Promise<TenantRequestContext> {
  const session = await requireSession(event)
  const orgId = session.session.activeOrganizationId
  if (!orgId) {
    throw createError({ statusCode: 409, statusMessage: 'No active organization', message: 'Wybierz organizację.' })
  }
  const [membership] = await useDb()
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, session.user.id)))
    .limit(1)
  if (!membership) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Nie należysz do tej organizacji.' })
  }
  if (permissions && !hasPermission(membership.role, permissions)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Brak uprawnień do tej operacji.' })
  }
  return { userId: session.user.id, orgId, role: membership.role }
}

/** Adres IP i przeglądarka do dziennika zdarzeń. */
export function requestMeta(event: H3Event) {
  return {
    ip: getRequestIP(event, { xForwardedFor: true }) ?? null,
    userAgent: getRequestHeader(event, 'user-agent') ?? null,
  }
}
