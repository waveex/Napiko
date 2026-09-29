/**
 * Karta „Powiadomienia klienta” w zleceniu: historia wiadomości, link do statusu naprawy,
 * kanały klienta (telefon / push / e-mail) i ustawienia warsztatu.
 */
import { and, eq, isNull } from 'drizzle-orm'
import type { Tx } from '../db/client'
import { customer, customerPushSubscription, organizationSettings, workOrderStatusLink } from '../db/schema'
import { loadOrderSummary } from '../db/notifications'
import { hashStatusToken, loadCustomerNotifications, statusLinkToken, statusPageUrl } from '../db/customer-notifications'
import { getEnv } from '../lib/env'
import { resolveCustomerNotificationSettings } from '../../shared/notifications'
import type { TenantRequestContext } from './tenant'

export async function loadCustomerNotificationPanel(tx: Tx, ctx: TenantRequestContext, workOrderId: string) {
  const order = await loadOrderSummary(tx, workOrderId)
  if (!order) throw notFound('Nie znaleziono zlecenia.')
  const env = getEnv()
  const contact = can(ctx, { customerContact: ['read'] })
  const send = can(ctx, { customerNotification: ['send'] })

  const [client] = await tx.select({
    phone: customer.phone,
    email: customer.email,
    notifySms: customer.notifySms,
    notifyEmail: customer.notifyEmail,
  }).from(customer).where(eq(customer.id, order.customerId)).limit(1)
  const devices = await tx.select({ phone: customerPushSubscription.phone }).from(customerPushSubscription)
    .where(and(eq(customerPushSubscription.customerId, order.customerId), isNull(customerPushSubscription.revokedAt)))
  const [link] = await tx.select().from(workOrderStatusLink).where(eq(workOrderStatusLink.workOrderId, workOrderId)).limit(1)
  // Link odtwarzamy z sekretu serwera; po zmianie sekretu stary link nie działa – trzeba utworzyć nowy
  const token = link ? statusLinkToken(env, ctx.orgId, workOrderId, link.version) : null
  const linkValid = !!link && !!token && hashStatusToken(token) === link.tokenHash
  const [settings] = await tx.select({ customerNotifications: organizationSettings.customerNotifications })
    .from(organizationSettings).limit(1)
  const items = await loadCustomerNotifications(tx, workOrderId, { contact })

  return {
    items,
    /** kiedy ostatnio wysłano (albo zaplanowano) wiadomość o danym zdarzeniu – do podpowiedzi przy zmianie statusu */
    lastSent: {
      order_received: items.find(i => i.event === 'order_received' && i.status !== 'skipped')?.createdAt ?? null,
      order_ready: items.find(i => i.event === 'order_ready' && i.status !== 'skipped')?.createdAt ?? null,
    },
    statusLink: linkValid
      ? {
          url: send ? statusPageUrl(env, token!) : null,
          firstViewedAt: link!.firstViewedAt,
          lastViewedAt: link!.lastViewedAt,
          viewCount: link!.viewCount,
        }
      : null,
    customer: {
      hasPhone: !!client?.phone,
      hasEmail: !!client?.email,
      phone: contact ? client?.phone ?? null : null,
      email: contact ? client?.email ?? null : null,
      notifySms: client?.notifySms ?? true,
      notifyEmail: client?.notifyEmail ?? true,
      /** „zarejestrowany telefon”: push dla aktualnego numeru z karty klienta */
      pushActive: devices.some(d => (d.phone ?? null) === (client?.phone ?? null)),
    },
    settings: resolveCustomerNotificationSettings(settings?.customerNotifications),
    /** log – SMS-y trafiają tylko do logów serwera (bramka SMS nieskonfigurowana) */
    smsProvider: env.SMS_PROVIDER,
    pushEnabled: usePush().enabled,
    orderStatus: order.status,
    can: { send },
  }
}
