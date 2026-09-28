/**
 * Zapis danych firmy (pierwszy zapis tworzy wiersz). Zmiany trafiają do dziennika zdarzeń.
 */
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { companyProfile } from '../../db/schema'
import { companyProfileSchema } from '../../../shared/schemas'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { settings: ['update'], billing: ['update'] })
  const input = await readValidatedBody(event, body => companyProfileSchema.parse(body))

  return withTenant(useDb(), ctx, async (tx) => {
    const before = await loadCompanyProfile(tx, ctx.orgId)
    const values = {
      ...input,
      laborRateNet: input.laborRateNet === null ? null : input.laborRateNet.toFixed(2),
      defaultVatRate: input.defaultVatRate.toFixed(2),
    }
    const [after] = await tx.insert(companyProfile)
      .values({ orgId: ctx.orgId, ...values })
      .onConflictDoUpdate({ target: companyProfile.orgId, set: values })
      .returning()

    const changed = (Object.keys(values) as (keyof typeof values)[])
      .filter(key => String(before[key] ?? '') !== String(after![key] ?? ''))
    if (changed.length) {
      await recordAudit(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'company.updated',
        entityType: 'company_profile',
        entityId: ctx.orgId,
        data: { fields: changed },
        ...requestMeta(event),
      })
    }
    return { ...after!, saved: true }
  })
})
