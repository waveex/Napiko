/**
 * Lista klientów warsztatu z wyszukiwaniem (nazwa; dla biura także telefon, e-mail, NIP, nr rej. i VIN).
 */
import { and, asc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { withTenant } from '../../db/tenant'
import { customer, vehicle } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { customer: ['read'] })
  const { q } = await getValidatedQuery(event, query => z.object({ q: z.string().trim().max(100).optional() }).parse(query))
  const contact = can(ctx, { customerContact: ['read'] })

  return withTenant(useDb(), ctx, async (tx) => {
    let search: SQL | undefined
    if (q) {
      const p = likePattern(q)
      const vehicleMatch = sql`exists (
        select 1 from vehicle v
        where v.customer_id = ${customer.id} and v.archived_at is null
          and (v.registration_number ilike ${p} or v.vin ilike ${p} or v.serial_number ilike ${p})
      )`
      search = contact
        ? or(ilike(customer.name, p), ilike(customer.phone, p), ilike(customer.email, p), ilike(customer.taxId, p), vehicleMatch)
        : or(ilike(customer.name, p), vehicleMatch)
    }
    const rows = await tx
      .select({
        id: customer.id,
        kind: customer.kind,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        taxId: customer.taxId,
        notes: customer.notes,
        createdAt: customer.createdAt,
        // $count zamiast surowego SQL: w zapytaniu bez złączeń Drizzle nie kwalifikuje kolumn nazwą tabeli
        vehicleCount: tx.$count(vehicle, and(eq(vehicle.customerId, customer.id), isNull(vehicle.archivedAt))),
      })
      .from(customer)
      .where(and(isNull(customer.archivedAt), search))
      .orderBy(asc(customer.name))
      .limit(100)
    return rows.map(r => maskCustomer(r, contact))
  })
})
