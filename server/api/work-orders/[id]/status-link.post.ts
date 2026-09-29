/**
 * Link do strony statusu naprawy (do skopiowania, np. do komunikatora). rotate: nowy link –
 * poprzedni przestaje działać (np. trafił do niewłaściwej osoby).
 */
import { withTenant } from '../../../db/tenant'
import { loadOrderSummary } from '../../../db/notifications'
import { recordAudit } from '../../../db/audit'
import { ensureStatusLink } from '../../../db/customer-notifications'
import { getEnv } from '../../../lib/env'
import { statusLinkSchema } from '../../../../shared/notifications'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { customerNotification: ['send'] })
  const id = await getIdParam(event)
  const { rotate } = await readValidatedBody(event, body => statusLinkSchema.parse(body ?? {}))

  return withTenant(useDb(), ctx, async (tx) => {
    const order = await loadOrderSummary(tx, id)
    if (!order) throw notFound('Nie znaleziono zlecenia.')
    const link = await ensureStatusLink(tx, getEnv(), order, { rotate })
    if (rotate) {
      await recordAudit(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'status_link.rotated',
        entityType: 'work_order',
        entityId: id,
        data: { number: order.number, version: link.version },
        ...requestMeta(event),
      })
    }
    return { url: link.url }
  })
})
