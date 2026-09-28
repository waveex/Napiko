/**
 * Karta pojazdu: dane, właściciel (kontakt tylko dla uprawnionych) i historia zleceń.
 */
import { desc, eq } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { customer, vehicle, workOrder } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { vehicle: ['read'] })
  const id = await getIdParam(event)
  const contact = can(ctx, { customerContact: ['read'] })

  return withTenant(useDb(), ctx, async (tx) => {
    const [row] = await tx.select().from(vehicle).where(eq(vehicle.id, id)).limit(1)
    if (!row) throw notFound('Nie znaleziono pojazdu.')
    const [owner] = await tx.select().from(customer).where(eq(customer.id, row.customerId)).limit(1)
    const orders = await tx
      .select({
        id: workOrder.id,
        number: workOrder.number,
        status: workOrder.status,
        description: workOrder.description,
        meterValue: workOrder.meterValue,
        receivedAt: workOrder.receivedAt,
        closedAt: workOrder.closedAt,
      })
      .from(workOrder)
      .where(eq(workOrder.vehicleId, id))
      .orderBy(desc(workOrder.receivedAt))
    return {
      ...row,
      customer: owner ? maskCustomer(owner, contact) : null,
      workOrders: orders,
      can: {
        update: can(ctx, { vehicle: ['update'] }),
        createWorkOrder: can(ctx, { workOrder: ['create'] }),
      },
    }
  })
})
