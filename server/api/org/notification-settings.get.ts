/**
 * Powiadomienia klienta w ustawieniach warsztatu: które zdarzenia wysyłać automatycznie i którymi kanałami.
 */
import { withTenant } from '../../db/tenant'
import { organizationSettings } from '../../db/schema'
import { getEnv } from '../../lib/env'
import { resolveCustomerNotificationSettings } from '../../../shared/notifications'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { settings: ['read'] })
  const [settings] = await withTenant(useDb(), ctx, tx => tx.select({
    customerNotifications: organizationSettings.customerNotifications,
    smsSenderName: organizationSettings.smsSenderName,
  }).from(organizationSettings).limit(1))
  return {
    customerNotifications: resolveCustomerNotificationSettings(settings?.customerNotifications),
    smsSenderName: settings?.smsSenderName ?? null,
    /** log – SMS-y trafiają tylko do logów serwera (bramka nieskonfigurowana) */
    smsProvider: getEnv().SMS_PROVIDER,
    pushEnabled: usePush().enabled,
  }
})
