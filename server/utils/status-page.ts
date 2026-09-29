/**
 * Strona statusu naprawy dla klienta (/s/<token>): odszukanie zlecenia po tokenie z linku.
 */
import { eq } from 'drizzle-orm'
import { withCustomerLink } from '../db/tenant'
import { customer, workOrder } from '../db/schema'

/** Zlecenie i klient z tokenu strony statusu (w bazie jest tylko skrót tokenu). */
export async function findStatusTarget(token: string) {
  const link = await resolveStatusLink(token)
  if (!link) throw invalidLink()
  const [row] = await withCustomerLink(useDb(), link.orgId, tx => tx
    .select({
      orgId: workOrder.orgId,
      orderId: workOrder.id,
      number: workOrder.number,
      customerId: workOrder.customerId,
      phone: customer.phone,
    })
    .from(workOrder)
    .innerJoin(customer, eq(customer.id, workOrder.customerId))
    .where(eq(workOrder.id, link.workOrderId))
    .limit(1))
  if (!row) throw invalidLink()
  return row
}
