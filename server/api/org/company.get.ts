/**
 * Dane firmy warsztatu (nagłówek kosztorysów i dokumentów).
 * Stawkę roboczogodziny widzi tylko osoba z dostępem do rozliczeń.
 */
import { withTenant } from '../../db/tenant'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { settings: ['read'] })
  const profile = await withTenant(useDb(), ctx, tx => loadCompanyProfile(tx, ctx.orgId))
  const billing = can(ctx, { billing: ['read'] })
  return { ...profile, laborRateNet: billing ? profile.laborRateNet : null }
})
