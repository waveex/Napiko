/**
 * Powiadomienia klienta w zleceniu: co i którędy wysłano, link do statusu naprawy, kanały klienta.
 */
import { withTenant } from '../../../db/tenant'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { customerNotification: ['read'] })
  const id = await getIdParam(event)
  return withTenant(useDb(), ctx, tx => loadCustomerNotificationPanel(tx, ctx, id))
})
