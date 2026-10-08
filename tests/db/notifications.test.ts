/**
 * Powiadomienia: izolacja (RLS), rozsyłanie do zespołu według ról i ustawień, trasowanie wiadomości do klienta
 * (push na zarejestrowany telefon zamiast SMS-a, SMS jako zapas), link do statusu naprawy i zadania w kolejce.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import {
  approvalRequest, customer, customerNotification, customerPushSubscription, job, member, notification,
  notificationPreference, organizationSettings, pushSubscription, task, vehicle, workOrder, workOrderStatusLink,
  type ApprovalSnapshot,
} from '../../server/db/schema'
import { withSystem, withTenant } from '../../server/db/tenant'
import { processJobs } from '../../server/db/jobs'
import { allTasksDone, notifyApprovalOutcome, notifyTeam, loadOrderSummary } from '../../server/db/notifications'
import {
  ensureStatusLink, hashStatusToken, queueCustomerDelivery, queueOrderStatusNotification, registerCustomerPush, statusLinkToken,
} from '../../server/db/customer-notifications'
import { notificationJobHandlers } from '../../server/db/notification-jobs'
import { getEnv, type Env } from '../../server/lib/env'
import { PushDeliveryError, type PushMessage, type PushResult, type PushSender, type PushTarget } from '../../server/lib/push'
import { toSmsText, type OutgoingSms } from '../../server/lib/sms'
import type { OutgoingEmail } from '../../server/lib/mail-types'
import { renderTeamNotification } from '../../server/lib/notification-texts'
import { interpolate, TEAM_NOTIFICATION_VARIANTS } from '../../shared/notifications'
import pl from '../../i18n/locales/pl.json'
import en from '../../i18n/locales/en.json'
import { addMember, createMemberWithOrg, createTestDb, pgErrorMessage } from '../helpers'

const { db, pool } = createTestDb()
type Ctx = { userId: string, orgId: string }
let office: Ctx
let mechanic: Ctx
let mechanic2: Ctx
let other: Ctx
let order: { id: string, customerId: string, number: string }
let env: Env

/** Środowisko z włączonym push (klucze testowe) niezależnie od lokalnego .env. */
function testEnv(): Env {
  return {
    ...getEnv(),
    VAPID_PUBLIC_KEY: 'B'.repeat(87),
    VAPID_PRIVATE_KEY: 'p'.repeat(43),
    appUrl: 'https://napiko.test',
  }
}

async function seedOrder(ctx: Ctx, number: string, contact: { phone?: string | null, email?: string | null } = {}) {
  return withTenant(db, ctx, async (tx) => {
    const [c] = await tx.insert(customer).values({
      orgId: ctx.orgId,
      name: 'Jan Klient',
      phone: contact.phone === undefined ? '+48600100200' : contact.phone,
      email: contact.email === undefined ? 'jan@example.com' : contact.email,
    }).returning()
    const [v] = await tx.insert(vehicle).values({
      orgId: ctx.orgId, customerId: c!.id, type: 'car', make: 'Toyota', model: 'Corolla', registrationNumber: 'BI12345',
    }).returning()
    const [o] = await tx.insert(workOrder).values({ orgId: ctx.orgId, number, customerId: c!.id, vehicleId: v!.id }).returning()
    return { id: o!.id, customerId: c!.id, number }
  })
}

function jobsOf(orgId: string, type?: string) {
  return withSystem(db, tx => tx.select().from(job)
    .where(and(eq(job.orgId, orgId), type ? eq(job.type, type) : sql`true`)))
}

/** Atrapa usługi push: zapisuje wysyłki, wynik zależy od adresu urządzenia. */
function fakePush(results: Record<string, PushResult | 'error' | 'reject'> = {}) {
  const sent: { target: PushTarget, message: PushMessage }[] = []
  const sender: PushSender = {
    enabled: true,
    publicKey: 'B'.repeat(87),
    async send(target, message) {
      const result = results[target.endpoint] ?? 'ok'
      if (result === 'error') throw new PushDeliveryError('Push niedostępny: HTTP 503', 503)
      if (result === 'reject') throw new PushDeliveryError('Usługa push odrzuciła wiadomość (HTTP 403).', 403)
      sent.push({ target, message })
      return result
    },
  }
  return { sender, sent }
}

function handlersWith(push: PushSender) {
  const sms: OutgoingSms[] = []
  const emails: OutgoingEmail[] = []
  const handlers = notificationJobHandlers({
    db,
    push,
    sendSms: async (message) => {
      sms.push(message)
    },
    sendEmail: async (email) => {
      emails.push(email)
    },
  })
  return { handlers, sms, emails }
}

/** Uruchamia tylko zadania tej organizacji (kolejka jest wspólna dla plików testów). */
async function runJobs(orgId: string, handlers: ReturnType<typeof handlersWith>['handlers']) {
  await withSystem(db, tx => tx.update(job).set({ runAt: sql`now() + interval '1 day'` })
    .where(and(sql`${job.orgId} is distinct from ${orgId}`, eq(job.status, 'pending'))))
  const result = await processJobs(db, handlers, { budgetMs: 5000 })
  await withSystem(db, tx => tx.update(job).set({ runAt: sql`now()` })
    .where(and(sql`${job.orgId} is distinct from ${orgId}`, eq(job.status, 'pending'), sql`${job.runAt} > now() + interval '23 hours'`)))
  return result
}

beforeAll(async () => {
  env = testEnv()
  office = await createMemberWithOrg(db, { role: 'office' })
  mechanic = await addMember(db, office.orgId, 'mechanic')
  mechanic2 = await addMember(db, office.orgId, 'mechanic')
  other = await createMemberWithOrg(db)
  order = await seedOrder(office, 'ZL/N/1')
})

afterAll(async () => {
  await pool.end()
})

describe('powiadomienia zespołu: izolacja', () => {
  it('członek może powiadomić innego członka, ale czyta tylko swoje', async () => {
    const [id] = await withTenant(db, office, tx => notifyTeam(tx, {
      orgId: office.orgId,
      type: 'task.assigned',
      actorUserId: office.userId,
      userIds: [mechanic.userId],
      workOrderId: order.id,
      link: '/app/my-tasks',
      data: { order: order.number, vehicle: 'Toyota Corolla BI12345', task: 'Wymiana klocków' },
    }))
    expect(id).toBeTruthy()
    expect(await withTenant(db, office, tx => tx.select().from(notification))).toHaveLength(0)
    const mine = await withTenant(db, mechanic, tx => tx.select().from(notification))
    expect(mine.map(n => n.id)).toEqual([id])
    expect(mine[0]!.data).toMatchObject({ actor: expect.stringMatching(/^Test/), task: 'Wymiana klocków' })
    expect(await withTenant(db, mechanic2, tx => tx.select().from(notification))).toHaveLength(0)
  })

  it('odbiorca oznacza jako przeczytane, ale nie zmieni treści', async () => {
    const [row] = await withTenant(db, mechanic, tx => tx.update(notification).set({ readAt: new Date() }).returning())
    expect(row!.readAt).toBeTruthy()
    expect(await pgErrorMessage(withTenant(db, mechanic, tx => tx.update(notification).set({ link: '/app/zmienione' }))))
      .toMatch(/tylko datę przeczytania/)
  })

  it('inny warsztat nie widzi powiadomień i nie może ich dodać', async () => {
    expect(await withTenant(db, other, tx => tx.select().from(notification))).toHaveLength(0)
    expect(await pgErrorMessage(withTenant(db, other, tx => tx.insert(notification).values({
      orgId: office.orgId, userId: mechanic.userId, type: 'task.assigned',
    })))).toMatch(/row-level security/)
  })

  it('powiadomienie może trafić tylko do członka warsztatu i prowadzić tylko do ścieżki w aplikacji', async () => {
    expect(await pgErrorMessage(withTenant(db, office, tx => tx.insert(notification).values({
      orgId: office.orgId, userId: other.userId, type: 'task.assigned',
    })))).toMatch(/notification_member_fk/)
    expect(await pgErrorMessage(withTenant(db, office, tx => tx.insert(notification).values({
      orgId: office.orgId, userId: mechanic.userId, type: 'task.assigned', link: 'https://zly.example/phishing',
    })))).toMatch(/notification_link_check/)
  })

  it('ustawienia kanałów czyta zespół, a zmienia wyłącznie sama osoba', async () => {
    await withTenant(db, mechanic, tx => tx.insert(notificationPreference).values({
      orgId: office.orgId, userId: mechanic.userId, type: 'task.unassigned', email: true, push: true,
    }))
    const seen = await withTenant(db, office, tx => tx.select().from(notificationPreference))
    expect(seen.some(p => p.userId === mechanic.userId)).toBe(true)
    expect(await pgErrorMessage(withTenant(db, office, tx => tx.insert(notificationPreference).values({
      orgId: office.orgId, userId: mechanic.userId, type: 'task.assigned', email: true, push: false,
    })))).toMatch(/row-level security/)
    const changed = await withTenant(db, office, tx => tx.update(notificationPreference).set({ email: false })
      .where(eq(notificationPreference.userId, mechanic.userId)).returning())
    expect(changed).toHaveLength(0)
  })

  it('urządzenia push widzi tylko ich właściciel', async () => {
    await withTenant(db, mechanic, tx => tx.insert(pushSubscription).values({
      userId: mechanic.userId, endpoint: 'https://push.example/rls-test', p256dh: 'k'.repeat(87), auth: 'a'.repeat(22),
    }))
    expect(await withTenant(db, office, tx => tx.select().from(pushSubscription))).toHaveLength(0)
    expect(await withTenant(db, mechanic, tx => tx.select().from(pushSubscription))).toHaveLength(1)
    expect(await pgErrorMessage(withTenant(db, office, tx => tx.insert(pushSubscription).values({
      userId: mechanic.userId, endpoint: 'https://push.example/podrzucony', p256dh: 'k'.repeat(87), auth: 'a'.repeat(22),
    })))).toMatch(/row-level security/)
    await withSystem(db, tx => tx.delete(pushSubscription).where(eq(pushSubscription.userId, mechanic.userId)))
  })
})

describe('powiadomienia zespołu: rozsyłanie', () => {
  it('odbiorcy według uprawnienia, bez autora zdarzenia', async () => {
    const owner = await addMember(db, office.orgId, 'owner')
    const ids = await withTenant(db, office, tx => notifyTeam(tx, {
      orgId: office.orgId,
      type: 'work_request.created',
      actorUserId: office.userId,
      permission: { workRequest: ['quote'] },
      workOrderId: order.id,
      data: { order: order.number, title: 'Klocki tył', kind: 'extra_work' },
    }))
    // biuro (autor) pominięte, właściciel powiadomiony, mechanicy nie mają uprawnienia do wyceny
    expect(ids).toHaveLength(1)
    const [row] = await withTenant(db, owner, tx => tx.select().from(notification))
    expect(row).toMatchObject({ type: 'work_request.created', userId: owner.userId })
    await withSystem(db, tx => tx.delete(member).where(eq(member.userId, owner.userId)))
  })

  it('e-mail i push według ustawień domyślnych i własnych', async () => {
    await withSystem(db, tx => tx.delete(job).where(eq(job.orgId, office.orgId)))
    // task.assigned: domyślnie push tak, e-mail nie; mechanik2 włącza e-mail i wyłącza push
    await withTenant(db, mechanic2, tx => tx.insert(notificationPreference).values({
      orgId: office.orgId, userId: mechanic2.userId, type: 'task.assigned', email: true, push: false,
    }))
    process.env.VAPID_PUBLIC_KEY = env.VAPID_PUBLIC_KEY
    process.env.VAPID_PRIVATE_KEY = env.VAPID_PRIVATE_KEY
    const saved = { ...getEnv() }
    Object.assign(getEnv(), { VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY })
    try {
      await withTenant(db, office, tx => notifyTeam(tx, {
        orgId: office.orgId,
        type: 'task.assigned',
        actorUserId: office.userId,
        userIds: [mechanic.userId, mechanic2.userId],
        data: { order: order.number, vehicle: 'Toyota Corolla BI12345', task: 'Diagnostyka' },
      }))
    }
    finally {
      Object.assign(getEnv(), { VAPID_PUBLIC_KEY: saved.VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY: saved.VAPID_PRIVATE_KEY })
    }
    const push = await jobsOf(office.orgId, 'push.send')
    const email = await jobsOf(office.orgId, 'email.send')
    expect(push.map(j => j.payload.userId)).toEqual([mechanic.userId])
    expect(push[0]!.payload).toMatchObject({ title: 'Nowe zadanie', url: expect.stringMatching(/^\/app\/n\//) })
    expect(push[0]!.payload.body).toContain('„Diagnostyka”')
    expect(email).toHaveLength(1)
    expect(email[0]!.payload).toMatchObject({ template: 'team-notification', data: { title: 'Nowe zadanie' } })
  })

  it('odpowiedź klienta trafia do osoby, która wysłała prośbę; gdy odeszła – do biura', async () => {
    const summary = (await withTenant(db, office, tx => loadOrderSummary(tx, order.id)))!
    const sender = await addMember(db, office.orgId, 'office')
    const approval = { id: crypto.randomUUID(), orgId: office.orgId, kind: 'work_requests' as const, sentBy: sender.userId }
    const first = await withSystem(db, tx => notifyApprovalOutcome(tx, 'approval.answered', approval, summary, { approved: 1, rejected: 0 }))
    expect(first).toHaveLength(1)
    await withSystem(db, tx => tx.delete(member).where(eq(member.userId, sender.userId)))
    const fallback = await withSystem(db, tx => notifyApprovalOutcome(tx, 'approval.answered', approval, summary, { approved: 1, rejected: 0 }))
    // pozostały członek biura (office) – mechanicy nie decydują o pracach dodatkowych
    expect(fallback).toHaveLength(1)
    const [row] = await withTenant(db, office, tx => tx.select().from(notification).where(eq(notification.type, 'approval.answered')))
    expect(row!.data).toMatchObject({ approved: 1, vehicle: 'Toyota Corolla BI12345' })
  })

  it('wszystkie zadania zakończone (anulowane się nie liczą)', async () => {
    const o = await seedOrder(office, 'ZL/N/2')
    expect(await withTenant(db, office, tx => allTasksDone(tx, o.id))).toBe(false)
    await withTenant(db, office, tx => tx.insert(task).values([
      { orgId: office.orgId, workOrderId: o.id, title: 'A', status: 'done' },
      { orgId: office.orgId, workOrderId: o.id, title: 'B', status: 'cancelled' },
    ]))
    expect(await withTenant(db, office, tx => allTasksDone(tx, o.id))).toBe(true)
    await withTenant(db, office, tx => tx.insert(task).values({ orgId: office.orgId, workOrderId: o.id, title: 'C' }))
    expect(await withTenant(db, office, tx => allTasksDone(tx, o.id))).toBe(false)
  })
})

describe('teksty powiadomień', () => {
  it('każdy wariant ma tytuł i treść po polsku i angielsku', () => {
    for (const messages of [pl, en]) {
      for (const variant of TEAM_NOTIFICATION_VARIANTS) {
        const texts = (messages.notifications.text as Record<string, { title: string, body: string }>)[variant]
        expect(texts?.title, variant).toBeTruthy()
        expect(texts?.body, variant).toBeTruthy()
        // tylko proste podstawienia {nazwa} – serwer nie obsługuje składni liczby mnogiej i odwołań vue-i18n
        expect(`${texts!.title}${texts!.body}`, variant).not.toMatch(/[@|]/)
      }
    }
  })

  it('treść e-maila i push z tych samych tłumaczeń', () => {
    const text = renderTeamNotification('approval.answered', { kind: 'estimate', decision: 'approved', total: '1 230,00 zł', vehicle: 'Kia Ceed', order: 'ZL/1' })
    expect(text).toEqual({ title: 'Kosztorys zaakceptowany', body: 'Klient zaakceptował kosztorys na 1 230,00 zł – Kia Ceed, ZL/1.' })
    expect(renderTeamNotification('task.assigned', { actor: 'Anna', task: 'X', vehicle: 'V', order: 'O' }, 'en').title).toBe('New task')
    expect(interpolate('{a} i {b}.', { a: 'x' })).toBe('x i.')
  })

  it('SMS bez polskich znaków (GSM-7, tańszy)', () => {
    expect(toSmsText('Przyjęliśmy pojazd „Łada” – Szczegóły…')).toBe('Przyjelismy pojazd "Lada" - Szczegoly...')
  })
})

describe('powiadomienia klienta', () => {
  it('link do statusu: stały token z sekretu serwera, w bazie tylko skrót; nowa wersja unieważnia poprzedni', async () => {
    const first = await withTenant(db, office, tx => ensureStatusLink(tx, env, { id: order.id, orgId: office.orgId }))
    const again = await withTenant(db, office, tx => ensureStatusLink(tx, env, { id: order.id, orgId: office.orgId }))
    expect(again.url).toBe(first.url)
    expect(first.url).toMatch(/^https:\/\/napiko\.test\/s\/[\w-]{24}$/)
    expect(first.token).toBe(statusLinkToken(env, office.orgId, order.id, 1))
    const [row] = await withTenant(db, office, tx => tx.select().from(workOrderStatusLink).where(eq(workOrderStatusLink.workOrderId, order.id)))
    expect(row!.tokenHash).toBe(hashStatusToken(first.token))
    expect(JSON.stringify(row)).not.toContain(first.token)
    const rotated = await withTenant(db, office, tx => ensureStatusLink(tx, env, { id: order.id, orgId: office.orgId }, { rotate: true }))
    expect(rotated.token).not.toBe(first.token)
    expect(rotated.version).toBe(2)
    // inny warsztat nie widzi linku
    expect(await withTenant(db, other, tx => tx.select().from(workOrderStatusLink))).toHaveLength(0)
  })

  it('przyjęcie pojazdu: SMS (bez polskich znaków) i e-mail, automatycznie tylko raz', async () => {
    const o = await seedOrder(office, 'ZL/N/3')
    const results = await withTenant(db, office, tx => queueOrderStatusNotification(tx, env, {
      orgId: office.orgId, workOrderId: o.id, event: 'order_received', trigger: 'auto', actorUserId: office.userId,
    }))
    expect(results.map(r => [r.status, r.via])).toEqual([['queued', 'sms'], ['queued', 'email']])
    const again = await withTenant(db, office, tx => queueOrderStatusNotification(tx, env, {
      orgId: office.orgId, workOrderId: o.id, event: 'order_received', trigger: 'auto', actorUserId: office.userId,
    }))
    expect(again).toHaveLength(0)
    const jobs = (await jobsOf(office.orgId, 'customer-notification.send'))
      .filter(j => results.some(r => r.id === j.payload.notificationId))
    const smsJob = jobs.find(j => j.payload.sms)!
    expect(smsJob.payload.sms).toMatchObject({ to: '+48600100200' })
    expect((smsJob.payload.sms as { message: string }).message).toMatch(/przyjelismy do naprawy Toyota Corolla BI12345 \(ZL\/N\/3\)\. Status naprawy: https:\/\/napiko\.test\/s\//)
    expect(jobs.find(j => j.payload.email)!.payload.email).toMatchObject({ to: 'jan@example.com', template: 'order-received' })
  })

  it('bez automatu w ustawieniach nic nie wychodzi; brak numeru i rezygnacja są odnotowane', async () => {
    await withSystem(db, tx => tx.insert(organizationSettings).values({
      orgId: office.orgId,
      customerNotifications: {
        order_received: { auto: false, phone: true, email: true },
        order_ready: { auto: true, phone: true, email: true },
      },
    }).onConflictDoNothing())
    const o = await seedOrder(office, 'ZL/N/4', { phone: null, email: 'x@example.com' })
    const none = await withTenant(db, office, tx => queueOrderStatusNotification(tx, env, {
      orgId: office.orgId, workOrderId: o.id, event: 'order_received', trigger: 'auto', actorUserId: office.userId,
    }))
    expect(none).toHaveLength(0)
    await withTenant(db, office, tx => tx.update(customer).set({ notifyEmail: false }).where(eq(customer.id, o.customerId)))
    const ready = await withTenant(db, office, tx => queueOrderStatusNotification(tx, env, {
      orgId: office.orgId, workOrderId: o.id, event: 'order_ready', trigger: 'auto', actorUserId: office.userId,
    }))
    expect(ready.map(r => [r.status, r.skipReason])).toEqual([['skipped', 'no_contact'], ['skipped', 'opted_out']])
  })

  it('zarejestrowany telefon: push zamiast SMS-a; po zmianie numeru – znów SMS', async () => {
    const o = await seedOrder(office, 'ZL/N/5', { phone: '600 700 800' })
    await withSystem(db, tx => registerCustomerPush(tx, {
      orgId: office.orgId, customerId: o.customerId, phone: '600 700 800', endpoint: 'https://push.example/klient-1',
      p256dh: 'k'.repeat(87), auth: 'a'.repeat(22), userAgent: 'Test',
    }))
    // w karcie klienta numer zapisany niesformatowany – porównujemy postać z karty
    const viaPush = await withTenant(db, office, tx => queueCustomerDelivery(tx, env, {
      orgId: office.orgId, workOrderId: o.id, customerId: o.customerId, event: 'order_ready', trigger: 'manual',
      sentBy: office.userId, channel: 'phone', recipient: '600 700 800', optedOut: false,
      content: { sms: 'SMS', push: { title: 'Warsztat', body: 'Gotowe', url: 'https://napiko.test/s/x' } },
    }))
    expect(viaPush.via).toBe('sms') // numer w subskrypcji niezgodny z postacią znormalizowaną
    await withSystem(db, tx => tx.update(customerPushSubscription).set({ phone: '+48600700800' })
      .where(eq(customerPushSubscription.customerId, o.customerId)))
    const push = await withTenant(db, office, tx => queueCustomerDelivery(tx, env, {
      orgId: office.orgId, workOrderId: o.id, customerId: o.customerId, event: 'order_ready', trigger: 'manual',
      sentBy: office.userId, channel: 'phone', recipient: '600 700 800', optedOut: true,
      content: { sms: 'SMS', push: { title: 'Warsztat', body: 'Gotowe', url: 'https://napiko.test/s/x' } },
    }))
    // rezygnacja z SMS-ów nie blokuje push, który klient włączył sam (SMS-a jako zapasu wtedy nie ma)
    expect(push).toMatchObject({ status: 'queued', via: 'push' })
    const [pushJob] = (await jobsOf(office.orgId, 'customer-notification.send')).filter(j => j.payload.notificationId === push.id)
    expect(pushJob!.payload).toMatchObject({ phone: '+48600700800', sms: null, push: { body: 'Gotowe' } })
    // bez kluczy VAPID push jest wyłączony – zostaje SMS
    const noPushEnv = { ...env, VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: undefined }
    const sms = await withTenant(db, office, tx => queueCustomerDelivery(tx, noPushEnv, {
      orgId: office.orgId, workOrderId: o.id, customerId: o.customerId, event: 'order_ready', trigger: 'manual',
      sentBy: office.userId, channel: 'phone', recipient: '600 700 800', optedOut: false,
      content: { sms: 'SMS', push: { title: 'Warsztat', body: 'Gotowe', url: 'https://napiko.test/s/x' } },
    }))
    expect(sms.via).toBe('sms')
  })

  it('izolacja: dziennik wiadomości i telefony klienta widzi tylko jego warsztat', async () => {
    expect(await withTenant(db, other, tx => tx.select().from(customerNotification))).toHaveLength(0)
    expect(await withTenant(db, other, tx => tx.select().from(customerPushSubscription))).toHaveLength(0)
    expect(await pgErrorMessage(withTenant(db, other, tx => tx.insert(customerNotification).values({
      orgId: office.orgId, workOrderId: order.id, customerId: order.customerId, event: 'order_ready', channel: 'phone', trigger: 'manual',
    })))).toMatch(/row-level security/)
  })
})

describe('zadania w kolejce', () => {
  // kolejka jest wspólna dla testów – każdy test zaczyna bez zaległych zadań tego warsztatu
  beforeEach(async () => {
    await withSystem(db, tx => tx.delete(job).where(and(eq(job.orgId, office.orgId), eq(job.status, 'pending'))))
  })

  it('push na zarejestrowany telefon; gdy wygasł – SMS jako zapas', async () => {
    const o = await seedOrder(office, 'ZL/N/6', { phone: '+48600111222' })
    await withSystem(db, async (tx) => {
      await registerCustomerPush(tx, {
        orgId: office.orgId, customerId: o.customerId, phone: '+48600111222', endpoint: 'https://push.example/ok',
        p256dh: 'k'.repeat(87), auth: 'a'.repeat(22), userAgent: null,
      })
    })
    const content = { sms: 'Gotowe do odbioru', push: { title: 'Warsztat', body: 'Gotowe', url: 'https://napiko.test/s/x' } }
    const input = {
      orgId: office.orgId, workOrderId: o.id, customerId: o.customerId, event: 'order_ready' as const, trigger: 'manual' as const,
      sentBy: office.userId, channel: 'phone' as const, recipient: '+48600111222', optedOut: false, content,
    }
    const first = await withTenant(db, office, tx => queueCustomerDelivery(tx, env, input))
    const ok = fakePush()
    const run1 = handlersWith(ok.sender)
    await runJobs(office.orgId, run1.handlers)
    expect(ok.sent).toHaveLength(1)
    expect(run1.sms).toHaveLength(0)
    const [sentRow] = await withTenant(db, office, tx => tx.select().from(customerNotification).where(eq(customerNotification.id, first.id)))
    expect(sentRow).toMatchObject({ status: 'sent', deliveredVia: 'push' })

    // telefon wyrejestrowany (410) → subskrypcja wyłączona, SMS jako zapas
    const second = await withTenant(db, office, tx => queueCustomerDelivery(tx, env, input))
    const gone = fakePush({ 'https://push.example/ok': 'gone' })
    const run2 = handlersWith(gone.sender)
    await runJobs(office.orgId, run2.handlers)
    // Klucz idempotencji = id zadania + kanał: ponowienie zadania nie wyśle klientowi drugiego SMS-a
    expect(run2.sms).toEqual([{ to: '+48600111222', message: 'Gotowe do odbioru', from: null, idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}-sms$/) }])
    const [fallback] = await withTenant(db, office, tx => tx.select().from(customerNotification).where(eq(customerNotification.id, second.id)))
    expect(fallback).toMatchObject({ status: 'sent', deliveredVia: 'sms' })
    expect(fallback!.error).toMatch(/Wysłano SMS/)
    const [device] = await withTenant(db, office, tx => tx.select().from(customerPushSubscription).where(eq(customerPushSubscription.customerId, o.customerId)))
    expect(device!.revokedAt).toBeTruthy()
  })

  it('chwilowa awaria usługi push: ponowienie, a przy ostatniej próbie SMS', async () => {
    const o = await seedOrder(office, 'ZL/N/7', { phone: '+48600333444' })
    await withSystem(db, tx => registerCustomerPush(tx, {
      orgId: office.orgId, customerId: o.customerId, phone: '+48600333444', endpoint: 'https://push.example/down',
      p256dh: 'k'.repeat(87), auth: 'a'.repeat(22), userAgent: null,
    }))
    const row = await withTenant(db, office, tx => queueCustomerDelivery(tx, env, {
      orgId: office.orgId, workOrderId: o.id, customerId: o.customerId, event: 'order_ready', trigger: 'manual',
      sentBy: office.userId, channel: 'phone', recipient: '+48600333444', optedOut: false,
      content: { sms: 'SMS zapasowy', push: { title: 'W', body: 'B', url: 'https://napiko.test/s/x' } },
    }))
    const down = fakePush({ 'https://push.example/down': 'error' })
    const run = handlersWith(down.sender)
    expect(await runJobs(office.orgId, run.handlers)).toMatchObject({ failed: 1 })
    expect(run.sms).toHaveLength(0)
    // ostatnia próba
    await withSystem(db, tx => tx.update(job).set({ runAt: sql`now()`, attempts: sql`${job.maxAttempts} - 1` })
      .where(sql`${job.payload}->>'notificationId' = ${row.id}`))
    await runJobs(office.orgId, run.handlers)
    expect(run.sms.map(s => s.message)).toEqual(['SMS zapasowy'])
    const [saved] = await withTenant(db, office, tx => tx.select().from(customerNotification).where(eq(customerNotification.id, row.id)))
    expect(saved).toMatchObject({ status: 'sent', deliveredVia: 'sms' })
  })

  it('push do zespołu: martwe urządzenia są usuwane', async () => {
    await withSystem(db, tx => tx.insert(pushSubscription).values([
      { userId: mechanic.userId, endpoint: 'https://push.example/phone', p256dh: 'k'.repeat(87), auth: 'a'.repeat(22) },
      { userId: mechanic.userId, endpoint: 'https://push.example/old', p256dh: 'k'.repeat(87), auth: 'a'.repeat(22) },
    ]))
    const [notificationId] = await withTenant(db, office, tx => notifyTeam(tx, {
      orgId: office.orgId, type: 'task.unassigned', actorUserId: office.userId, userIds: [mechanic.userId],
      data: { task: 'X', vehicle: 'V', order: 'O' },
    }))
    await withSystem(db, tx => tx.insert(job).values({
      orgId: office.orgId,
      type: 'push.send',
      payload: { orgId: office.orgId, userId: mechanic.userId, notificationId, title: 'T', body: 'B', url: `/app/n/${notificationId}`, tag: 't', lang: 'pl' },
    }))
    const push = fakePush({ 'https://push.example/old': 'gone' })
    await runJobs(office.orgId, handlersWith(push.sender).handlers)
    expect(push.sent.map(s => s.target.endpoint)).toContain('https://push.example/phone')
    const left = await withSystem(db, tx => tx.select().from(pushSubscription).where(eq(pushSubscription.userId, mechanic.userId)))
    expect(left.map(s => s.endpoint)).toEqual(['https://push.example/phone'])
    expect(left[0]!.lastUsedAt).toBeTruthy()
  })

  it('link do akceptacji wygasł bez odpowiedzi – jedno powiadomienie dla biura', async () => {
    const snapshot: ApprovalSnapshot = {
      version: 1, organization: { name: 'W' }, order: { number: order.number },
      vehicle: { type: 'car', make: 'Toyota', model: 'Corolla', registrationNumber: 'BI12345' },
      message: null, currency: 'PLN', items: [], totalGrossCents: 0, createdAt: new Date().toISOString(),
    }
    const [approval] = await withTenant(db, office, tx => tx.insert(approvalRequest).values({
      orgId: office.orgId, workOrderId: order.id, tokenHash: `expiry-${crypto.randomUUID()}`, channel: 'link', snapshot,
      snapshotHash: 'x', expiresAt: new Date(Date.now() - 1000), sentBy: office.userId,
    }).returning())
    const { handlers } = handlersWith(fakePush().sender)
    for (let i = 0; i < 2; i++) {
      await withSystem(db, tx => tx.insert(job).values({ orgId: office.orgId, type: 'approval.expiry-check', payload: { approvalId: approval!.id } }))
      await runJobs(office.orgId, handlers)
    }
    const expired = await withTenant(db, office, tx => tx.select().from(notification).where(eq(notification.type, 'approval.expired')))
    expect(expired).toHaveLength(1)
    expect(expired[0]).toMatchObject({ entityId: approval!.id, link: `/app/orders/${order.id}` })
  })
})
