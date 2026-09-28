/**
 * Dziennik zdarzeń. Numer kolejny, czas i skrót (hash) nadaje wyzwalacz w bazie,
 * więc aplikacja nie może ich podrobić, a zmiana wcześniejszego wpisu psuje łańcuch.
 */
import { auditEvent } from './schema'
import type { Tx } from './client'

export interface AuditInput {
  orgId: string
  actorUserId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  data?: Record<string, unknown>
  ip?: string | null
  userAgent?: string | null
}

export async function recordAudit(tx: Tx, input: AuditInput) {
  await tx.insert(auditEvent).values({
    orgId: input.orgId,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    data: input.data ?? {},
    ip: input.ip ?? null,
    userAgent: input.userAgent?.slice(0, 500) ?? null,
  })
}
