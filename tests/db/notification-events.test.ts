/**
 * Zdarzenia warsztatu → powiadomienia: kto je dostaje (przydział, zadania do wzięcia, zgłoszenia, decyzje, części,
 * koniec prac), wiadomości do klienta przy zmianie statusu (potwierdzenie biura), prośby o akceptację,
 * sprzątanie, szablony e-maili i teksty (SMS, maskowanie danych na stronie statusu).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import {
  customer, customerNotification, job, notification, organizationSettings, task, taskAssignment, vehicle, workOrder,
  workRequest, approvalRequest, type ApprovalSnapshot,
} from '../../server/db/schema'
import { withSystem, withTenant } from '../../server/db/tenant'
import {
  cleanupNotifications, notifyIfAllTasksDone, notifyPartStatus, notifyTaskAssignment, notifyTasksAvailable, notifyWorkRequestCreated,
  notifyWorkRequestDecided,
} from '../../server/db/notifications'
import {
  customerVehicleText, queueApprovalDelivery, queueOrderStatusNotification, registerCustomerPush,
} from '../../server/db/customer-notifications'
import { getEnv, type Env } from '../../server/lib/env'
import { renderEmail } from '../../server/lib/email-templates'
import { renderTeamNotification } from '../../server/lib/notification-texts'
import { redactSms, toSmsText } from '../../server/lib/sms'
import { maskEmail, maskPhone, isTeamNotificationFor, teamNotificationParams } from '../../shared/notifications'
import { addMember, createMemberWithOrg, createTestDb } from '../helpers'

const { db, pool } = createTestDb()
type Ctx = { userId: string, orgId: string }
let office: Ctx
let mechanic: Ctx
let mechanic2: Ctx
let env: Env

function testEnv(): Env {
  return { ...getEnv(), VAPID_PUBLIC_KEY: 'B'.repeat(87), VAPID_PRIVATE_KEY: 'p'.repeat(43), appUrl: 'https://oxy.test' }
}

async function seedOrder(number: string, contact: { phone?: string | null, email?: string | null } = {}, vehicleData: Partial<typeof vehicle.$inferInsert> = {}) {
  return withTenant(db, office, async (tx) => {
    const [c] = await tx.insert(customer).values({
      orgId: office.orgId,
      name: 'Anna Klientka',
      phone: contact.phone === undefined ? '+48600200300' : contact.phone,
      email: contact.email === undefined ? 'anna@example.com' : contact.email,
    }).returning()
    const [v] = await tx.insert(vehicle).values({
      orgId: office.orgId, customerId: c!.id, type: 'car', make: 'Skoda', model: 'Octavia', registrationNumber: 'BI7777', ...vehicleData,
    }).returning()
    const [o] = await tx.insert(workOrder).values({ orgId: office.orgId, number, customerId: c!.id, vehicleId: v!.id }).returning()
    return { id: o!.id, customerId: c!.id, number }
  })
}

/** Powiadomienia danej osoby (RLS: każdy czyta tylko swoje). */
function inbox(ctx: Ctx) {
  return withTenant(db, ctx, tx => tx.select().from(notification).where(eq(notification.orgId, ctx.orgId)))
}

async function setPolicy(policy: 'office' | 'self' | 'mixed') {
  await withSystem(db, tx => tx.insert(organizationSettings).values({ orgId: office.orgId, assignmentPolicy: policy })
    .onConflictDoUpdate({ target: organizationSettings.orgId, set: { assignmentPolicy: policy } }))
}

beforeAll(async () => {
  env = testEnv()
  office = await createMemberWithOrg(db, { role: 'office' })
  mechanic = await addMember(db, office.orgId, 'mechanic')
  mechanic2 = await addMember(db, office.orgId, 'mechanic')
})

beforeEach(async () => {
  await withSystem(db, tx => tx.delete(notification).where(eq(notification.orgId, office.orgId)))
})

afterAll(async () => {
  await pool.end()
})

describe('zdarzenia warsztatu → odbiorcy powiadomień', () => {
  it('przydział zadania: powiadomiony przypisany mechanik, ale nie ktoś, kto bierze zadanie sam', async () => {
    const o = await seedOrder('ZL/E/1')
    const [t] = await withTenant(db, office, tx => tx.insert(task).values({ orgId: office.orgId, workOrderId: o.id, title: 'Wymiana oleju' }).returning())
    await withTenant(db, office, tx => notifyTaskAssignment(tx, {
      orgId: office.orgId, actorUserId: office.userId, userId: mechanic.userId, taskId: t!.id, taskTitle: t!.title, workOrderId: o.id, assigned: true,
    }))
    const [n] = await inbox(mechanic)
    expect(n).toMatchObject({ type: 'task.assigned', link: '/app/my-tasks', entityId: t!.id })
    expect(n!.data).toMatchObject({ task: 'Wymiana oleju', order: 'ZL/E/1', vehicle: 'Skoda Octavia BI7777', actor: expect.stringMatching(/^Test/) })

    const self = await withTenant(db, mechanic2, tx => notifyTaskAssignment(tx, {
      orgId: office.orgId, actorUserId: mechanic2.userId, userId: mechanic2.userId, taskId: t!.id, taskTitle: t!.title, workOrderId: o.id, assigned: true,
    }))
    expect(self).toHaveLength(0)
  })

  it('zadania do wzięcia: tylko przy zasadzie „sami biorą” i tylko dla mechaników (bez biura)', async () => {
    const o = await seedOrder('ZL/E/2')
    const [t] = await withTenant(db, office, tx => tx.insert(task).values({ orgId: office.orgId, workOrderId: o.id, title: 'Diagnostyka' }).returning())
    await setPolicy('office')
    expect(await withTenant(db, office, tx => notifyTasksAvailable(tx, {
      orgId: office.orgId, actorUserId: office.userId, workOrderId: o.id, taskIds: [t!.id], taskTitle: t!.title,
    }))).toHaveLength(0)

    await setPolicy('self')
    const owner = await addMember(db, office.orgId, 'owner')
    const sent = await withTenant(db, mechanic, tx => notifyTasksAvailable(tx, {
      orgId: office.orgId, actorUserId: mechanic.userId, workOrderId: o.id, taskIds: [t!.id], taskTitle: t!.title,
    }))
    // autor (mechanik) pominięty; biuro i właściciel przydzielają zadania, więc tego nie dostają
    expect(sent).toHaveLength(1)
    const [n] = await inbox(mechanic2)
    expect(n).toMatchObject({ type: 'task.available', link: '/app/my-tasks' })
    expect(n!.data).toMatchObject({ count: 1 })
    expect(await inbox(owner)).toHaveLength(0)
    expect(isTeamNotificationFor('task.available', 'office')).toBe(false)
    expect(isTeamNotificationFor('task.available', 'mechanic')).toBe(true)
    await setPolicy('office')
  })

  it('zgłoszenie potrzeby trafia do biura; decyzja – do mechanika, który zgłosił', async () => {
    const o = await seedOrder('ZL/E/3')
    const [r] = await withTenant(db, mechanic, tx => tx.insert(workRequest).values({
      orgId: office.orgId, workOrderId: o.id, kind: 'extra_work', title: 'Klocki tył', reportedBy: mechanic.userId,
    }).returning())
    await withTenant(db, mechanic, tx => notifyWorkRequestCreated(tx, { orgId: office.orgId, actorUserId: mechanic.userId, request: r!, hold: true }))
    const [forOffice] = await inbox(office)
    expect(forOffice).toMatchObject({ type: 'work_request.created', link: `/app/orders/${o.id}` })
    expect(renderTeamNotification('work_request.created', forOffice!.data).title).toBe('Praca dodatkowa – zadanie wstrzymane')
    expect(await inbox(mechanic2)).toHaveLength(0)

    await withTenant(db, office, tx => notifyWorkRequestDecided(tx, {
      orgId: office.orgId, actorUserId: null, request: r!, decision: 'approved', via: 'customer', createdTaskId: crypto.randomUUID(),
    }))
    const [forMechanic] = await inbox(mechanic)
    expect(forMechanic).toMatchObject({ type: 'work_request.decided', link: '/app/my-tasks' })
    expect(renderTeamNotification('work_request.decided', forMechanic!.data)).toEqual({
      title: 'Klient zatwierdził pracę',
      body: '„Klocki tył” – Skoda Octavia BI7777, ZL/E/3. Zadanie jest na Twojej liście.',
    })
  })

  it('dostawa części: dla zgłaszającego i osób przypisanych do wstrzymanego zadania', async () => {
    const o = await seedOrder('ZL/E/4')
    const [t] = await withTenant(db, office, tx => tx.insert(task).values({ orgId: office.orgId, workOrderId: o.id, title: 'Sprzęgło' }).returning())
    await withTenant(db, office, tx => tx.insert(taskAssignment).values({ orgId: office.orgId, taskId: t!.id, userId: mechanic2.userId }))
    const [r] = await withTenant(db, mechanic, tx => tx.insert(workRequest).values({
      orgId: office.orgId, workOrderId: o.id, taskId: t!.id, kind: 'part', title: 'Docisk', reportedBy: mechanic.userId,
    }).returning())
    await withTenant(db, office, tx => notifyPartStatus(tx, { orgId: office.orgId, actorUserId: office.userId, request: r!, status: 'delivered' }))
    expect((await inbox(mechanic)).map(n => n.type)).toEqual(['work_request.part_delivered'])
    expect((await inbox(mechanic2)).map(n => n.type)).toEqual(['work_request.part_delivered'])
    expect(await inbox(office)).toHaveLength(0)
  })

  it('koniec prac: biuro dostaje powiadomienie dopiero, gdy wszystkie zadania są zakończone', async () => {
    const o = await seedOrder('ZL/E/5')
    await withTenant(db, office, tx => tx.insert(task).values([
      { orgId: office.orgId, workOrderId: o.id, title: 'A', status: 'done' },
      { orgId: office.orgId, workOrderId: o.id, title: 'B', status: 'in_progress' },
    ]))
    expect(await withTenant(db, mechanic, tx => notifyIfAllTasksDone(tx, { orgId: office.orgId, actorUserId: mechanic.userId, workOrderId: o.id }))).toHaveLength(0)
    await withTenant(db, office, tx => tx.update(task).set({ status: 'done' }).where(eq(task.workOrderId, o.id)))
    // biuro i właściciel (dodany w poprzednim teście) – mechanicy nie zmieniają statusu zlecenia
    expect(await withTenant(db, mechanic, tx => notifyIfAllTasksDone(tx, { orgId: office.orgId, actorUserId: mechanic.userId, workOrderId: o.id }))).toHaveLength(2)
    expect(await inbox(mechanic2)).toHaveLength(0)
    const [n] = await inbox(office)
    expect(n).toMatchObject({ type: 'work_order.tasks_completed', link: `/app/orders/${o.id}` })
    // zlecenie już gotowe do odbioru – bez powiadomienia
    await withTenant(db, office, tx => tx.update(workOrder).set({ status: 'ready' }).where(eq(workOrder.id, o.id)))
    expect(await withTenant(db, mechanic, tx => notifyIfAllTasksDone(tx, { orgId: office.orgId, actorUserId: mechanic.userId, workOrderId: o.id }))).toHaveLength(0)
  })
})

describe('wiadomości do klienta', () => {
  it('gotowy do odbioru: potwierdzenie biura wysyła ponownie, automat – tylko raz', async () => {
    const o = await seedOrder('ZL/E/6')
    const auto = () => withTenant(db, office, tx => queueOrderStatusNotification(tx, env, {
      orgId: office.orgId, workOrderId: o.id, event: 'order_ready', trigger: 'auto', actorUserId: office.userId,
    }))
    expect(await auto()).toHaveLength(2)
    expect(await auto()).toHaveLength(0)
    const confirmed = await withTenant(db, office, tx => queueOrderStatusNotification(tx, env, {
      orgId: office.orgId, workOrderId: o.id, event: 'order_ready', trigger: 'auto', force: true, actorUserId: office.userId,
    }))
    expect(confirmed.map(r => r.via)).toEqual(['sms', 'email'])
    const smsJob = (await withSystem(db, tx => tx.select().from(job).where(sql`${job.payload}->>'notificationId' = ${confirmed[0]!.id}`)))[0]!
    expect((smsJob.payload.sms as { message: string }).message).toMatch(/^Warsztat \w+: naprawa zakonczona, Skoda Octavia BI7777 czeka na odbior\. Szczegoly: https:\/\/oxy\.test\/s\/[\w-]{24}$/)
    const emailJob = (await withSystem(db, tx => tx.select().from(job).where(sql`${job.payload}->>'notificationId' = ${confirmed[1]!.id}`)))[0]!
    expect(emailJob.payload.email).toMatchObject({
      to: 'anna@example.com',
      template: 'order-ready',
      data: { unsubscribeUrl: expect.stringMatching(/^https:\/\/oxy\.test\/api\/public\/status\/[\w-]{24}\/unsubscribe$/), preferencesUrl: expect.stringMatching(/#powiadomienia$/) },
    })
  })

  it('pojazd bez marki i tablic: w treści typ pojazdu (bez numeru zlecenia w miejscu nazwy)', async () => {
    expect(customerVehicleText({ vehicleLabel: '', vehicle: { type: 'construction', make: null, model: null, registrationNumber: null, serialNumber: null } }))
      .toBe('Maszyna budowlana')
    expect(teamNotificationParams({ vehicle: '', vehicleType: 'forklift' }, key => (key === 'vehicleType.forklift' ? 'Wózek widłowy' : key)))
      .toMatchObject({ vehicle: 'Wózek widłowy', next: '' })
  })

  it('prośba o akceptację: wpis w dzienniku wiadomości, push zamiast SMS-a na zarejestrowany telefon', async () => {
    const o = await seedOrder('ZL/E/7', { phone: '+48600999888' })
    const snapshot: ApprovalSnapshot = {
      version: 1, organization: { name: 'W' }, order: { number: o.number },
      vehicle: { type: 'car', make: 'Skoda', model: 'Octavia', registrationNumber: 'BI7777' },
      message: null, currency: 'PLN', items: [], totalGrossCents: 0, createdAt: new Date().toISOString(),
    }
    const [approval] = await withTenant(db, office, tx => tx.insert(approvalRequest).values({
      orgId: office.orgId, workOrderId: o.id, tokenHash: `delivery-${crypto.randomUUID()}`, channel: 'sms', recipient: '+48600999888',
      snapshot, snapshotHash: 'x', expiresAt: new Date(Date.now() + 3600_000), sentBy: office.userId,
    }).returning())
    const input = {
      orgId: office.orgId, workOrderId: o.id, approvalId: approval!.id, kind: 'work_requests' as const, channel: 'sms' as const,
      recipient: '+48600999888', sentBy: office.userId, organizationName: 'Auto Serwis Łódź', smsFrom: null,
      vehicle: 'Skoda Octavia BI7777', orderNumber: o.number, url: 'https://oxy.test/approve/abc', message: null, expires: '01.10.2026',
    }
    const bySms = await withTenant(db, office, tx => queueApprovalDelivery(tx, env, input))
    expect(bySms).toMatchObject({ status: 'queued', via: 'sms' })
    await withSystem(db, tx => registerCustomerPush(tx, {
      orgId: office.orgId, customerId: o.customerId, phone: '+48600999888', endpoint: 'https://push.example/e7', p256dh: 'k'.repeat(87), auth: 'a'.repeat(22), userAgent: null,
    }))
    const byPush = await withTenant(db, office, tx => queueApprovalDelivery(tx, env, input))
    expect(byPush).toMatchObject({ status: 'queued', via: 'push' })
    const rows = await withTenant(db, office, tx => tx.select().from(customerNotification).where(eq(customerNotification.approvalId, approval!.id)))
    expect(rows.map(r => r.event)).toEqual(['approval_request', 'approval_request'])
    const [pushJob] = await withSystem(db, tx => tx.select().from(job).where(sql`${job.payload}->>'notificationId' = ${byPush.id}`))
    expect(pushJob!.payload).toMatchObject({
      push: { title: 'Auto Serwis Łódź', body: 'Prosimy o decyzję w sprawie dodatkowych prac (Skoda Octavia BI7777).' },
      // SMS jako zapas, bez polskich znaków
      sms: { message: 'Auto Serwis Lodz: prosimy o decyzje w sprawie dodatkowych prac (Skoda Octavia BI7777). Opis i ceny: https://oxy.test/approve/abc' },
    })
  })
})

describe('sprzątanie', () => {
  it('usuwa przeczytane starsze niż 90 dni i wszystkie starsze niż 180 dni', async () => {
    const o = await seedOrder('ZL/E/8')
    const base = { orgId: office.orgId, userId: mechanic.userId, type: 'task.assigned', workOrderId: o.id }
    await withSystem(db, tx => tx.insert(notification).values([
      { ...base, createdAt: sql`now() - interval '100 days'`, readAt: sql`now() - interval '99 days'` } as never,
      { ...base, createdAt: sql`now() - interval '100 days'` } as never,
      { ...base, createdAt: sql`now() - interval '200 days'` } as never,
      { ...base },
    ]))
    const result = await cleanupNotifications(db)
    expect(result.notifications).toBeGreaterThanOrEqual(2)
    const left = await withSystem(db, tx => tx.select({ readAt: notification.readAt }).from(notification)
      .where(and(eq(notification.orgId, office.orgId), eq(notification.userId, mechanic.userId))))
    // zostają: nieprzeczytane sprzed 100 dni i dzisiejsze
    expect(left).toHaveLength(2)
    expect(left.every(n => n.readAt === null)).toBe(true)
  })
})

describe('szablony i teksty', () => {
  it('e-mail zespołu w języku warsztatu, z linkiem do ustawień', () => {
    const pl = renderEmail({ to: 'a@example.com', template: 'team-notification', data: { title: 'Nowe zadanie', body: 'Treść', organizationName: 'Warsztat', url: 'https://oxy.test/app/n/1', settingsUrl: 'https://oxy.test/app/notifications', lang: 'pl' } })
    expect(pl.subject).toBe('Nowe zadanie – Warsztat')
    expect(pl.html).toContain('Otwórz w OXY')
    expect(pl.text).toContain('Ustawienia powiadomień: https://oxy.test/app/notifications')
    const en = renderEmail({ to: 'a@example.com', template: 'team-notification', data: { title: 'New task', body: 'Body', organizationName: 'Garage', url: 'https://oxy.test/app/n/1', lang: 'en' } })
    expect(en.html).toContain('Open in OXY')
  })

  it('e-mail do klienta: nadawca to warsztat, rezygnacja jednym kliknięciem (RFC 8058), treść bez wstrzykniętego HTML', () => {
    const email = renderEmail({
      to: 'klient@example.com',
      template: 'order-received',
      data: {
        organizationName: 'Auto <b>Serwis</b>', vehicle: 'Kia Ceed', orderNumber: 'ZL/1', url: 'https://oxy.test/s/abc', phone: '85 123 45 67',
        address: 'ul. Lipowa 1, Białystok', promised: '30.09.2026, 16:00', preferencesUrl: 'https://oxy.test/s/abc#powiadomienia',
        unsubscribeUrl: 'https://oxy.test/api/public/status/abc/unsubscribe',
      },
    })
    expect(email.subject).toBe('Auto <b>Serwis</b>: przyjęliśmy pojazd Kia Ceed')
    expect(email.html).toContain('Auto &lt;b&gt;Serwis&lt;/b&gt;')
    expect(email.html).not.toContain('<b>Serwis</b>')
    expect(email.html).toContain('Planowany termin odbioru: 30.09.2026, 16:00.')
    expect(email.headers).toEqual({
      'List-Unsubscribe': '<https://oxy.test/api/public/status/abc/unsubscribe>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
  })

  it('SMS: bez polskich znaków, w logach bez numeru i tokenów', () => {
    expect(toSmsText('Źdźbło – „żółć” … ok')).toBe('Zdzblo - "zolc" ... ok')
    expect(redactSms({ to: '+48600100200', message: 'Status: https://oxy.test/s/AbCdEf123456789012345678 i https://oxy.test/approve/xyz_-1' }))
      .toBe('+••••••••200: Status: https://oxy.test/s/… i https://oxy.test/approve/…')
  })

  it('strona statusu: numer i e-mail klienta zamaskowane', () => {
    expect(maskPhone('+48 600 100 200')).toBe('••• ••• 200')
    expect(maskPhone(null)).toBeNull()
    expect(maskEmail('jan.kowalski@example.com')).toBe('j•••@example.com')
    expect(maskEmail('bez-malpy')).toBeNull()
  })
})
