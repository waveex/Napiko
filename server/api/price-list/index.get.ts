/**
 * Cennik usług warsztatu. Usługi liczone z normy czasu dostają cenę ze stawki roboczogodziny z danych firmy.
 */
import { and, asc, ilike, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { withTenant } from '../../db/tenant'
import { servicePrice } from '../../db/schema'
import { estimateLine } from '../../../shared/workshop'

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  archived: z.enum(['0', '1']).optional(),
})

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { billing: ['read'] })
  const query = await getValidatedQuery(event, value => querySchema.parse(value))

  return withTenant(useDb(), ctx, async (tx) => {
    const profile = await loadCompanyProfile(tx, ctx.orgId)
    const filters = [query.archived === '1' ? sql`${servicePrice.archivedAt} is not null` : isNull(servicePrice.archivedAt)]
    if (query.q) {
      const pattern = likePattern(query.q)
      filters.push(or(ilike(servicePrice.name, pattern), ilike(servicePrice.category, pattern))!)
    }
    const rows = await tx.select().from(servicePrice)
      .where(and(...filters))
      .orderBy(sql`${servicePrice.category} nulls last`, asc(sql`lower(${servicePrice.name})`))
      .limit(500)

    const rate = profile.laborRateNet
    const items = rows.map((row) => {
      // cena jednostkowa pozycji w kosztorysie: stała albo stawka roboczogodziny (ilość = norma czasu)
      const unitPriceNet = row.pricing === 'fixed' ? row.priceNet : rate
      const quantity = row.pricing === 'fixed' ? '1' : row.laborHours!
      const value = unitPriceNet === null ? null : estimateLine({ quantity, unitPriceNet, discountPercent: 0, vatRate: row.vatRate })
      return { ...row, netCents: value?.netCents ?? null, grossCents: value?.grossCents ?? null }
    })
    return { items, laborRateNet: rate, defaultVatRate: profile.defaultVatRate }
  })
})
