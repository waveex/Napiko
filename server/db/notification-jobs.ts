/**
 * Zadania w tle związane z powiadomieniami:
 *  - push.send – push do urządzeń członka zespołu,
 *  - customer-notification.send – wiadomość do klienta (push na zarejestrowany telefon z SMS-em jako zapasem, SMS, e-mail),
 *  - approval.expiry-check – po terminie linku: powiadomienie biura, że klient nie odpowiedział.
 * Moduł nie zależy od Nuxta: usługi (push, SMS, poczta) przekazuje server/utils/jobs.ts, a testy – atrapy.
 */
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Db } from './client'
import type { ClaimedJob, JobHandler } from './jobs'
import { withSystem } from './tenant'
import { approvalRequest, customerNotification, customerPushSubscription, notification, pushSubscription } from './schema'
import { loadOrderSummary, notifyApprovalOutcome, type TeamNotificationJob } from './notifications'
import { customerPushTargets, type CustomerDeliveryJob } from './customer-notifications'
import { isPermanentPushError, type PushSender } from '../lib/push'
import type { OutgoingSms } from '../lib/sms'
import type { OutgoingEmail } from '../lib/mail-types'

export interface NotificationJobDeps {
  db: Db
  push: PushSender
  sendSms: (sms: OutgoingSms) => Promise<void>
  sendEmail: (email: OutgoingEmail) => Promise<void>
}

/** Ile usługa push przechowuje wiadomość dla telefonu bez zasięgu. */
const TEAM_PUSH_TTL = 24 * 3600
const CUSTOMER_PUSH_TTL = 2 * 24 * 3600

function errorText(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500)
}

export function notificationJobHandlers(deps: NotificationJobDeps): Record<string, JobHandler> {
  const { db } = deps

  async function markCustomerNotification(
    id: string,
    values: { status: 'sent' | 'failed', deliveredVia?: 'push' | 'sms' | 'email', error?: string | null },
  ) {
    await withSystem(db, tx => tx.update(customerNotification).set({
      status: values.status,
      deliveredVia: values.deliveredVia ?? null,
      error: values.error ?? null,
      sentAt: values.status === 'sent' ? sql`now()` : null,
    }).where(eq(customerNotification.id, id)))
  }

  /** Push do wszystkich urządzeń; zwraca, czy choć jedno przyjęło wiadomość. Martwe subskrypcje usuwa / wyłącza. */
  async function pushToDevices<T extends { id: string, endpoint: string, p256dh: string, auth: string }>(
    targets: T[],
    send: (target: T) => ReturnType<PushSender['send']>,
    onGone: (ids: string[]) => Promise<unknown>,
    onOk: (ids: string[]) => Promise<unknown>,
  ) {
    const gone: string[] = []
    const ok: string[] = []
    let transient: unknown = null
    for (const target of targets) {
      try {
        const result = await send(target)
        if (result === 'gone') gone.push(target.id)
        else ok.push(target.id)
      }
      catch (error) {
        if (isPermanentPushError(error)) gone.push(target.id)
        else transient = error
      }
    }
    if (gone.length) await onGone(gone)
    if (ok.length) await onOk(ok)
    return { delivered: ok.length > 0, transient, remaining: targets.length - gone.length }
  }

  const teamPush: JobHandler = async (job: ClaimedJob) => {
    const p = job.payload as unknown as TeamNotificationJob
    if (!deps.push.enabled) return
    const targets = await withSystem(db, async (tx) => {
      // powiadomienie usunięte (np. osoba odeszła z warsztatu) – nie wysyłamy; próbny push nie ma powiadomienia
      if (p.notificationId) {
        const [stillThere] = await tx.select({ id: notification.id }).from(notification)
          .where(eq(notification.id, p.notificationId)).limit(1)
        if (!stillThere) return []
      }
      return tx.select().from(pushSubscription).where(eq(pushSubscription.userId, p.userId))
    })
    if (!targets.length) return
    const result = await pushToDevices(
      targets,
      target => deps.push.send(target, { title: p.title, body: p.body, url: p.url, tag: p.tag, lang: p.lang }, {
        ttlSeconds: TEAM_PUSH_TTL,
        urgency: 'high',
      }),
      ids => withSystem(db, tx => tx.delete(pushSubscription).where(inArray(pushSubscription.id, ids))),
      ids => withSystem(db, tx => tx.update(pushSubscription).set({ lastUsedAt: sql`now()` }).where(inArray(pushSubscription.id, ids))),
    )
    // Błąd przejściowy (sieć, 5xx): ponowienie. Urządzenia, które już dostały wiadomość, podmienią ją (ten sam znacznik).
    if (result.transient) throw result.transient
  }

  const customerDelivery: JobHandler = async (job: ClaimedJob) => {
    const p = job.payload as unknown as CustomerDeliveryJob
    const lastAttempt = job.attempts >= job.maxAttempts
    try {
      if (p.email) {
        await deps.sendEmail(p.email)
        await markCustomerNotification(p.notificationId, { status: 'sent', deliveredVia: 'email' })
        return
      }
      let pushNote: string | null = null
      if (p.push && deps.push.enabled) {
        const targets = await withSystem(db, tx => customerPushTargets(tx, p.customerId, p.phone))
        if (targets.length) {
          const result = await pushToDevices(
            targets,
            target => deps.push.send(target, p.push!, { ttlSeconds: CUSTOMER_PUSH_TTL, urgency: 'high' }),
            ids => withSystem(db, tx => tx.update(customerPushSubscription).set({ revokedAt: sql`now()` })
              .where(inArray(customerPushSubscription.id, ids))),
            ids => withSystem(db, tx => tx.update(customerPushSubscription).set({ lastSuccessAt: sql`now()` })
              .where(inArray(customerPushSubscription.id, ids))),
          )
          if (result.delivered) {
            await markCustomerNotification(p.notificationId, { status: 'sent', deliveredVia: 'push' })
            return
          }
          // Usługa push chwilowo niedostępna – ponawiamy; przy ostatniej próbie przechodzimy na SMS
          if (result.transient && result.remaining > 0 && !lastAttempt) throw result.transient
          pushNote = result.transient ? `Push: ${errorText(result.transient)}` : 'Push: telefon nie przyjmuje już powiadomień.'
        }
        else {
          pushNote = 'Push: telefon nie przyjmuje już powiadomień.'
        }
      }
      if (p.sms) {
        await deps.sendSms(p.sms)
        await markCustomerNotification(p.notificationId, { status: 'sent', deliveredVia: 'sms', error: pushNote ? `${pushNote} Wysłano SMS.` : null })
        return
      }
      await markCustomerNotification(p.notificationId, {
        status: 'failed',
        error: pushNote ? `${pushNote} Brak numeru do SMS-a albo klient zrezygnował z SMS-ów.` : 'Brak kanału wysyłki.',
      })
    }
    catch (error) {
      if (lastAttempt) await markCustomerNotification(p.notificationId, { status: 'failed', error: errorText(error) })
      throw error
    }
  }

  const approvalExpiry: JobHandler = async (job: ClaimedJob) => {
    const approvalId = String(job.payload.approvalId ?? '')
    if (!approvalId) return
    await withSystem(db, async (tx) => {
      const [approval] = await tx.select().from(approvalRequest).where(eq(approvalRequest.id, approvalId)).limit(1)
      if (!approval || approval.status !== 'pending' || approval.expiresAt.getTime() > Date.now()) return
      // jedno powiadomienie o wygaśnięciu na prośbę (zadanie mogło zostać ponowione)
      const [already] = await tx.select({ id: notification.id }).from(notification).where(and(
        eq(notification.entityId, approval.id),
        eq(notification.type, 'approval.expired'),
      )).limit(1)
      if (already) return
      const order = await loadOrderSummary(tx, approval.workOrderId)
      if (!order || order.status === 'closed' || order.status === 'cancelled') return
      await notifyApprovalOutcome(tx, 'approval.expired', approval, order, {})
    })
  }

  return {
    'push.send': teamPush,
    'customer-notification.send': customerDelivery,
    'approval.expiry-check': approvalExpiry,
  }
}
