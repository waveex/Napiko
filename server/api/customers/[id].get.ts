/**
 * Karta klienta: dane (kontakt tylko dla uprawnionych), pojazdy i ostatnie zlecenia.
 */
import { and, desc, eq, isNull } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { customer, vehicle, workOrder } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { customer: ['read'] })
  const id = await getIdParam(event)
  const contact = can(ctx, { customerContact: ['read'] })

  return withTenant(useDb(), ctx, async (tx) => {
    const [row] = await tx.select().from(customer).where(eq(customer.id, id)).limit(1)
    if (!row) throw notFound('Nie znaleziono klienta.')
    const vehicles = await tx.select().from(vehicle)
      .where(and(eq(vehicle.customerId, id), isNull(vehicle.archivedAt)))
      .orderBy(desc(vehicle.createdAt))
    const orders = await tx
      .select({
        id: workOrder.id,
        number: workOrder.number,
        status: workOrder.status,
        vehicleId: workOrder.vehicleId,
        receivedAt: workOrder.receivedAt,
      })
      .from(workOrder)
      .where(eq(workOrder.customerId, id))
      .orderBy(desc(workOrder.receivedAt))
      .limit(50)
    return {
      ...maskCustomer(row, contact),
      vehicles,
      workOrders: orders,
      can: {
        update: can(ctx, { customer: ['update'] }),
        addVehicle: can(ctx, { vehicle: ['create'] }),
        createWorkOrder: can(ctx, { workOrder: ['create'] }),
        seeContact: contact,
      },
    }
  })
})
