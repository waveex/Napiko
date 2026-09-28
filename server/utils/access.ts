/**
 * Uprawnienia w endpointach i minimalizacja danych osobowych.
 */
import { hasPermission, type PermissionRequest } from '../../shared/permissions'
import type { TenantRequestContext } from './tenant'

export function can(ctx: TenantRequestContext, request: PermissionRequest) {
  return hasPermission(ctx.role, request)
}

export function assertCan(ctx: TenantRequestContext, request: PermissionRequest) {
  if (!can(ctx, request)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Brak uprawnień do tej operacji.' })
  }
}

export function notFound(message = 'Nie znaleziono.') {
  return createError({ statusCode: 404, statusMessage: 'Not Found', message })
}

/** Mechanik widzi klienta z nazwy, ale nie jego danych kontaktowych (RODO: minimalizacja danych). */
export function maskCustomer<T extends { email: string | null, phone: string | null, taxId: string | null, notes: string | null }>(
  customer: T,
  visible: boolean,
): T {
  return visible ? customer : { ...customer, email: null, phone: null, taxId: null, notes: null }
}

/** Wzorzec ILIKE z tekstu użytkownika (znaki specjalne traktowane dosłownie). */
export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, m => `\\${m}`)}%`
}
