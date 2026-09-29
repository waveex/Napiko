/**
 * Linki dla klienta bez konta (strona akceptacji /approve/…, strona statusu naprawy /s/…).
 *
 * Token z linku wskazuje warsztat dopiero po odczytaniu z bazy, dlatego sam odczyt odbywa się w kontekście
 * systemowym – i to jest JEDYNE miejsce endpointów publicznych, które go używa. Cała dalsza praca idzie przez
 * withCustomerLink(): baza przepuszcza wtedy tylko warsztat, do którego należy link.
 */
import { eq } from 'drizzle-orm'
import { withSystem } from '../db/tenant'
import { approvalRequest, workOrderStatusLink } from '../db/schema'
import { hashStatusToken } from '../db/customer-notifications'

/** Warsztat prośby o akceptację z tokenu (albo null, gdy link jest nieprawidłowy). */
export async function resolveApprovalOrg(token: string): Promise<string | null> {
  const [row] = await withSystem(useDb(), tx => tx.select({ orgId: approvalRequest.orgId }).from(approvalRequest)
    .where(eq(approvalRequest.tokenHash, hashApprovalToken(token))).limit(1))
  return row?.orgId ?? null
}

/** Warsztat i zlecenie z tokenu strony statusu (albo null, gdy link jest nieprawidłowy lub unieważniony). */
export async function resolveStatusLink(token: string): Promise<{ orgId: string, workOrderId: string } | null> {
  const [row] = await withSystem(useDb(), tx => tx
    .select({ orgId: workOrderStatusLink.orgId, workOrderId: workOrderStatusLink.workOrderId })
    .from(workOrderStatusLink)
    .where(eq(workOrderStatusLink.tokenHash, hashStatusToken(token)))
    .limit(1))
  return row ?? null
}

export function invalidLink(message = 'Link jest nieprawidłowy albo został unieważniony.') {
  return createError({ statusCode: 404, message })
}
