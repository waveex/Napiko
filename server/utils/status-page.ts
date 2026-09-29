/**
 * Strona statusu naprawy dla klienta (/s/<token>): odszukanie zlecenia po tokenie z linku.
 */
import { eq } from 'drizzle-orm'
import { withSystem } from '../db/tenant'
import { customer, workOrder, workOrderStatusLink } from '../db/schema'
import { hashStatusToken } from '../db/customer-notifications'

/** Zlecenie i klient z tokenu strony statusu (w bazie jest tylko skrót tokenu). */
export async function findStatusTarget(token: string) {
  const [row] = await withSystem(useDb(), tx => tx
    .select({
      orgId: workOrder.orgId,
      orderId: workOrder.id,
      number: workOrder.number,
      customerId: workOrder.customerId,
      phone: customer.phone,
    })
    .from(workOrderStatusLink)
    .innerJoin(workOrder, eq(workOrder.id, workOrderStatusLink.workOrderId))
    .innerJoin(customer, eq(customer.id, workOrder.customerId))
    .where(eq(workOrderStatusLink.tokenHash, hashStatusToken(token)))
    .limit(1))
  if (!row) throw createError({ statusCode: 404, message: 'Link jest nieprawidłowy albo został unieważniony.' })
  return row
}
