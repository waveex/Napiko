/**
 * Zmiana automatycznych powiadomień klienta (zdarzenia i kanały) – zapis w dzienniku zdarzeń.
 */
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { organizationSettings } from '../../db/schema'
import { customerNotificationSettingsSchema, resolveCustomerNotificationSettings } from '../../../shared/notifications'

const bodySchema = z.object({ customerNotifications: customerNotificationSettingsSchema })

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { settings: ['update'] })
  const { customerNotifications } = await readValidatedBody(event, body => bodySchema.parse(body))

  return withTenant(useDb(), ctx, async (tx) => {
    const [before] = await tx.select({ customerNotifications: organizationSettings.customerNotifications })
      .from(organizationSettings).limit(1)
    if (!before) throw createError({ statusCode: 404, message: 'Brak ustawień organizacji.' })
    const from = resolveCustomerNotificationSettings(before.customerNotifications)
    await tx.update(organizationSettings).set({ customerNotifications }).where(eq(organizationSettings.orgId, ctx.orgId))
    if (JSON.stringify(from) !== JSON.stringify(customerNotifications)) {
      await recordAudit(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'settings.updated',
        entityType: 'organization_settings',
        entityId: ctx.orgId,
        data: { changed: { customerNotifications: { from, to: customerNotifications } } },
        ...requestMeta(event),
      })
    }
    return { customerNotifications }
  })
})
