/**
 * Powiadomienia klienta: przyjęcie pojazdu, gotowość do odbioru i prośby o akceptację.
 *
 * Kanał „telefon” to SMS albo push: gdy klient włączył powiadomienia w telefonie (na stronie statusu naprawy)
 * i numer w jego karcie jest ten sam co przy włączeniu, wysyłamy push – bez kosztu SMS-a (decyzja D5).
 * Gdy push przestanie działać (klient wyłączył powiadomienia, zmienił telefon), zadanie w kolejce wysyła SMS.
 *
 * Każda wiadomość ma wpis w customer_notification (co, którym kanałem, z jakim skutkiem), a jej treść
 * z linkiem jest tylko w zadaniu kolejki i znika po wysłaniu (minimalizacja danych).
 * Moduł nie zależy od Nuxta – korzystają z niego endpointy, zadania w tle i testy.
 */
import { createHash, createHmac } from 'node:crypto'
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import type { Tx } from './client'
import { enqueueJob } from './jobs'
import { recordAudit } from './audit'
import {
  companyProfile, customer, customerNotification, customerPushSubscription, organization, organizationSettings, user,
  workOrder, workOrderStatusLink,
} from './schema'
import { loadOrderSummary, type OrderSummary } from './notifications'
import type { Env } from '../lib/env'
import { isPushConfigured, type PushMessage } from '../lib/push'
import { toSmsText } from '../lib/sms'
import type { OutgoingEmail } from '../lib/mail-types'
import pl from '../../i18n/locales/pl.json'
import {
  resolveCustomerNotificationSettings, type AutoCustomerEvent, type CustomerChannel, type CustomerNotificationEvent,
} from '../../shared/notifications'
import { normalizePhone, type VehicleType } from '../../shared/workshop'

// ─────────────────────────────────────────────────────────────────────────────
// Link do strony statusu naprawy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Token linku wyliczany z sekretu serwera (HMAC): ten sam link można odtworzyć przy kolejnej wiadomości
 * albo skopiować w karcie zlecenia, a w bazie jest tylko jego skrót. 144 bity – nie do odgadnięcia.
 */
export function statusLinkToken(env: Pick<Env, 'BETTER_AUTH_SECRET'>, orgId: string, workOrderId: string, version: number) {
  const key = createHmac('sha256', env.BETTER_AUTH_SECRET).update('oxy:work-order-status-link:v1').digest()
  return createHmac('sha256', key).update(`${orgId}:${workOrderId}:${version}`).digest('base64url').slice(0, 24)
}

export function hashStatusToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function statusPageUrl(env: Pick<Env, 'appUrl'>, token: string) {
  return `${env.appUrl}/s/${token}`
}

/** Ustawienia powiadomień klienta na stronie statusu (link w stopce e-maila). */
export function statusPreferencesUrl(env: Pick<Env, 'appUrl'>, token: string) {
  return `${statusPageUrl(env, token)}#powiadomienia`
}

/** Rezygnacja z e-maili jednym kliknięciem (nagłówek List-Unsubscribe, RFC 8058). */
export function statusUnsubscribeUrl(env: Pick<Env, 'appUrl'>, token: string) {
  return `${env.appUrl}/api/public/status/${token}/unsubscribe`
}

/** Pojazd w wiadomości do klienta: marka, model i tablice, a gdy ich brak – numer fabryczny albo typ pojazdu. */
export function customerVehicleText(order: Pick<OrderSummary, 'vehicleLabel' | 'vehicle'>) {
  return order.vehicleLabel || (pl.vehicleType as Record<VehicleType, string>)[order.vehicle.type as VehicleType] || 'pojazd'
}

/**
 * Link do statusu naprawy zlecenia: tworzy go przy pierwszym użyciu, a po zmianie sekretu serwera naprawia skrót.
 * rotate: nowa wersja tokenu – poprzedni link przestaje działać (np. wysłany na zły numer).
 */
export async function ensureStatusLink(
  tx: Tx,
  env: Pick<Env, 'BETTER_AUTH_SECRET' | 'appUrl'>,
  order: { id: string, orgId: string },
  options: { rotate?: boolean } = {},
) {
  const [existing] = await tx.select().from(workOrderStatusLink).where(eq(workOrderStatusLink.workOrderId, order.id)).limit(1)
  const version = existing ? existing.version + (options.rotate ? 1 : 0) : 1
  const token = statusLinkToken(env, order.orgId, order.id, version)
  const tokenHash = hashStatusToken(token)
  if (!existing) {
    await tx.insert(workOrderStatusLink).values({ workOrderId: order.id, orgId: order.orgId, tokenHash, version })
      .onConflictDoNothing()
  }
  else if (existing.tokenHash !== tokenHash) {
    await tx.update(workOrderStatusLink).set({
      tokenHash,
      version,
      ...(options.rotate ? { firstViewedAt: null, lastViewedAt: null, viewCount: 0 } : {}),
    }).where(eq(workOrderStatusLink.workOrderId, order.id))
  }
  return { url: statusPageUrl(env, token), token, version }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wysyłka jednej wiadomości (wpis w dzienniku + zadanie w kolejce)
// ─────────────────────────────────────────────────────────────────────────────

export interface CustomerMessageContent {
  /** SMS – tekst bez polskich znaków dodajemy automatycznie (koszt, D5) */
  sms?: string
  push?: PushMessage
  email?: Pick<OutgoingEmail, 'template' | 'data'>
}

export interface CustomerDeliveryInput {
  orgId: string
  workOrderId: string
  customerId: string
  event: CustomerNotificationEvent
  trigger: 'auto' | 'manual'
  sentBy: string | null
  approvalId?: string | null
  channel: CustomerChannel
  /** numer telefonu albo adres e-mail */
  recipient: string | null
  /** klient zrezygnował z tego kanału (SMS / e-mail) */
  optedOut: boolean
  /** nazwa nadawcy SMS warsztatu */
  smsFrom?: string | null
  content: CustomerMessageContent
}

export interface CustomerDeliveryJob {
  notificationId: string
  orgId: string
  customerId: string
  /** numer, do którego przypisany jest „zarejestrowany telefon” */
  phone: string | null
  push: PushMessage | null
  sms: { to: string, message: string, from: string | null } | null
  email: OutgoingEmail | null
}

/** Wynik zaplanowania wiadomości: w kolejce (i którędy pójdzie) albo pominięta (dlaczego). */
export interface CustomerDeliveryResult {
  id: string
  status: 'queued' | 'skipped'
  via: 'push' | 'sms' | 'email' | null
  skipReason: 'no_contact' | 'opted_out' | null
}

/** Aktywne urządzenia klienta z włączonym push, zarejestrowane dla tego numeru telefonu. */
export async function customerPushTargets(tx: Tx, customerId: string, phone: string | null) {
  return tx.select().from(customerPushSubscription).where(and(
    eq(customerPushSubscription.customerId, customerId),
    isNull(customerPushSubscription.revokedAt),
    phone === null ? isNull(customerPushSubscription.phone) : eq(customerPushSubscription.phone, phone),
  ))
}

export async function queueCustomerDelivery(tx: Tx, env: Env, input: CustomerDeliveryInput) {
  const base = {
    orgId: input.orgId,
    workOrderId: input.workOrderId,
    customerId: input.customerId,
    approvalId: input.approvalId ?? null,
    event: input.event,
    channel: input.channel,
    trigger: input.trigger,
    sentBy: input.sentBy,
  }
  const skip = async (reason: 'no_contact' | 'opted_out', recipient: string | null): Promise<CustomerDeliveryResult> => {
    const [row] = await tx.insert(customerNotification)
      .values({ ...base, recipient, status: 'skipped', skipReason: reason })
      .returning({ id: customerNotification.id })
    return { id: row!.id, status: 'skipped', via: null, skipReason: reason }
  }
  const queue = async (recipient: string | null, job: Omit<CustomerDeliveryJob, 'notificationId' | 'orgId' | 'customerId'>): Promise<CustomerDeliveryResult> => {
    const [row] = await tx.insert(customerNotification).values({ ...base, recipient })
      .returning({ id: customerNotification.id })
    const payload: CustomerDeliveryJob = { notificationId: row!.id, orgId: input.orgId, customerId: input.customerId, ...job }
    // maks. 4 próby (30 s, 1 min, 2 min) – potem push przechodzi na SMS, a SMS / e-mail są oznaczane jako nieudane
    await enqueueJob(tx, { type: 'customer-notification.send', orgId: input.orgId, payload: { ...payload }, maxAttempts: 4 })
    return { id: row!.id, status: 'queued', via: job.email ? 'email' : job.push ? 'push' : 'sms', skipReason: null }
  }

  if (input.channel === 'email') {
    const to = input.recipient?.trim() || null
    if (!to || !input.content.email) return skip('no_contact', to)
    if (input.optedOut) return skip('opted_out', to)
    return queue(to, { phone: null, push: null, sms: null, email: { to, ...input.content.email } })
  }

  const phone = normalizePhone(input.recipient)
  const sms = phone && input.content.sms && !input.optedOut
    ? { to: phone, message: toSmsText(input.content.sms), from: input.smsFrom ?? null }
    : null
  // Telefon zarejestrowany do powiadomień → push; SMS jako zapas (rezygnacja z SMS-ów nie dotyczy push,
  // który klient włączył sam)
  const targets = isPushConfigured(env) && input.content.push ? await customerPushTargets(tx, input.customerId, phone) : []
  if (targets.length) return queue(phone, { phone, push: input.content.push!, sms, email: null })
  if (!phone) return skip('no_contact', null)
  if (input.optedOut) return skip('opted_out', phone)
  if (!sms) return skip('no_contact', phone)
  return queue(phone, { phone, push: null, sms, email: null })
}

// ─────────────────────────────────────────────────────────────────────────────
// Przyjęcie pojazdu i gotowość do odbioru
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderStatusNotificationInput {
  orgId: string
  workOrderId: string
  event: AutoCustomerEvent
  trigger: 'auto' | 'manual'
  actorUserId: string | null
  /** ręczna wysyłka: wybrane kanały; automatyczna – według ustawień warsztatu */
  channels?: { phone: boolean, email: boolean }
  /**
   * Biuro zaznaczyło „Powiadom klienta” (przyjęcie zlecenia, zmiana statusu): wysyłamy według kanałów z ustawień,
   * także gdy zdarzenie nie jest proponowane automatycznie albo klient był już o nim powiadomiony.
   */
  force?: boolean
  meta?: { ip: string | null, userAgent: string | null }
}

function formatDateTime(date: Date, timezone: string) {
  return date.toLocaleString('pl-PL', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' })
}

export interface OrderStatusMessageContext {
  organizationName: string
  order: OrderSummary
  url: string
  preferencesUrl: string
  unsubscribeUrl: string
  promised: string | null
  phone: string | null
  address: string | null
}

/**
 * Treść wiadomości o zmianie statusu (SMS, push, e-mail) – po polsku, jak pozostałe wiadomości do klientów.
 * Zdania nie zależą od rodzaju gramatycznego nazwy pojazdu („Maszyna budowlana czeka na odbiór”).
 */
export function orderStatusMessages(event: AutoCustomerEvent, ctx: OrderStatusMessageContext): Required<CustomerMessageContent> {
  const { organizationName: org, order, url } = ctx
  const vehicle = customerVehicleText(order)
  const common = {
    organizationName: org,
    vehicle,
    orderNumber: order.number,
    url,
    preferencesUrl: ctx.preferencesUrl,
    unsubscribeUrl: ctx.unsubscribeUrl,
    phone: ctx.phone ?? '',
    address: ctx.address ?? '',
  }
  if (event === 'order_received') {
    return {
      sms: `${org}: przyjęliśmy do naprawy ${vehicle} (${order.number}). Status naprawy: ${url}`,
      push: {
        title: org,
        body: `Przyjęliśmy do naprawy: ${vehicle} (${order.number}). Dotknij, aby sprawdzić status.`,
        url,
        tag: `order-${order.id}`,
        lang: 'pl',
      },
      email: { template: 'order-received', data: { ...common, promised: ctx.promised ?? '' } },
    }
  }
  return {
    sms: `${org}: naprawa zakończona, ${vehicle} czeka na odbiór. Szczegóły: ${url}`,
    push: {
      title: org,
      body: `Naprawa zakończona – ${vehicle} czeka na odbiór.`,
      url,
      tag: `order-${order.id}`,
      lang: 'pl',
    },
    email: { template: 'order-ready', data: common },
  }
}

/** Dane warsztatu do stopki wiadomości: nazwa, telefon, adres, nazwa nadawcy SMS, strefa czasowa. */
async function loadWorkshopContact(tx: Tx, orgId: string) {
  const [org] = await tx.select({ name: organization.name }).from(organization).where(eq(organization.id, orgId)).limit(1)
  const [settings] = await tx.select({
    customerNotifications: organizationSettings.customerNotifications,
    smsSenderName: organizationSettings.smsSenderName,
    timezone: organizationSettings.timezone,
  }).from(organizationSettings).where(eq(organizationSettings.orgId, orgId)).limit(1)
  const [profile] = await tx.select({
    phone: companyProfile.phone,
    street: companyProfile.street,
    postalCode: companyProfile.postalCode,
    city: companyProfile.city,
  }).from(companyProfile).where(eq(companyProfile.orgId, orgId)).limit(1)
  const address = profile ? [profile.street, [profile.postalCode, profile.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''
  return {
    name: org?.name ?? 'Warsztat',
    phone: profile?.phone ?? null,
    address: address || null,
    smsFrom: settings?.smsSenderName ?? null,
    timezone: settings?.timezone ?? 'Europe/Warsaw',
    rules: resolveCustomerNotificationSettings(settings?.customerNotifications),
  }
}

/**
 * Wiadomość o przyjęciu pojazdu albo gotowości do odbioru.
 *  - trigger "auto" (przyjęcie zlecenia, zmiana statusu): kanały z ustawień warsztatu; bez potwierdzenia biura
 *    tylko przy włączonym zdarzeniu i tylko raz na zlecenie,
 *  - confirmed: biuro zaznaczyło „Powiadom klienta” – wysyłamy według kanałów z ustawień, także ponownie,
 *  - trigger "manual" (karta „Powiadomienia klienta”): kanały wybrane przez biuro.
 */
export async function queueOrderStatusNotification(tx: Tx, env: Env, input: OrderStatusNotificationInput) {
  const order = await loadOrderSummary(tx, input.workOrderId)
  if (!order) return []
  const workshop = await loadWorkshopContact(tx, input.orgId)
  const rule = workshop.rules[input.event]

  let channels = input.channels ?? { phone: rule.phone, email: rule.email }
  if (input.trigger === 'auto') {
    channels = { phone: rule.phone, email: rule.email }
    if (!input.force) {
      if (!rule.auto) return []
      const [already] = await tx.select({ id: customerNotification.id }).from(customerNotification).where(and(
        eq(customerNotification.workOrderId, order.id),
        eq(customerNotification.event, input.event),
        eq(customerNotification.trigger, 'auto'),
      )).limit(1)
      if (already) return []
    }
  }
  if (!channels.phone && !channels.email) return []

  const [client] = await tx.select({
    phone: customer.phone,
    email: customer.email,
    notifySms: customer.notifySms,
    notifyEmail: customer.notifyEmail,
  }).from(customer).where(eq(customer.id, order.customerId)).limit(1)

  const link = await ensureStatusLink(tx, env, order)
  const content = orderStatusMessages(input.event, {
    organizationName: workshop.name,
    order,
    url: link.url,
    preferencesUrl: statusPreferencesUrl(env, link.token),
    unsubscribeUrl: statusUnsubscribeUrl(env, link.token),
    promised: order.promisedAt ? formatDateTime(order.promisedAt, workshop.timezone) : null,
    phone: workshop.phone,
    address: workshop.address,
  })

  const common = {
    orgId: input.orgId,
    workOrderId: order.id,
    customerId: order.customerId,
    event: input.event,
    trigger: input.trigger,
    sentBy: input.actorUserId,
    smsFrom: workshop.smsFrom,
  } as const
  const results: CustomerDeliveryResult[] = []
  if (channels.phone) {
    results.push(await queueCustomerDelivery(tx, env, {
      ...common,
      channel: 'phone',
      recipient: client?.phone ?? null,
      optedOut: !(client?.notifySms ?? true),
      content: { sms: content.sms, push: content.push },
    }))
  }
  if (channels.email) {
    results.push(await queueCustomerDelivery(tx, env, {
      ...common,
      channel: 'email',
      recipient: client?.email ?? null,
      optedOut: !(client?.notifyEmail ?? true),
      content: { email: content.email },
    }))
  }

  await recordAudit(tx, {
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    action: 'customer.notified',
    entityType: 'work_order',
    entityId: order.id,
    // bez numeru i adresu – w dzienniku nie powielamy danych kontaktowych klienta
    data: {
      number: order.number,
      event: input.event,
      trigger: input.trigger,
      confirmed: !!input.force,
      channels: Object.entries(channels).filter(([, on]) => on).map(([name]) => name),
      statuses: results.map(r => r.status),
    },
    ...input.meta,
  })
  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// Prośby o akceptację (prace dodatkowe, kosztorys): link wysłany SMS-em albo e-mailem
// ─────────────────────────────────────────────────────────────────────────────

export interface ApprovalDeliveryInput {
  orgId: string
  workOrderId: string
  approvalId: string
  kind: 'work_requests' | 'estimate'
  channel: 'email' | 'sms'
  recipient: string
  sentBy: string
  organizationName: string
  smsFrom: string | null
  /** pojazd w treści (marka, model, tablice) */
  vehicle: string
  orderNumber: string
  url: string
  message: string | null
  expires: string
  /** kosztorys: kwota brutto do akceptacji */
  total?: string
}

/**
 * Prośba o decyzję klienta: wpis w dzienniku wiadomości i wysyłka z kolejki. Na zarejestrowany telefon klienta
 * idzie push zamiast SMS-a. Odbiorcę wybiera biuro, więc rezygnacja z automatycznych wiadomości tu nie obowiązuje.
 */
export async function queueApprovalDelivery(tx: Tx, env: Env, input: ApprovalDeliveryInput) {
  const estimate = input.kind === 'estimate'
  const sms = estimate
    ? `${input.organizationName}: kosztorys naprawy (${input.vehicle}) na ${input.total} czeka na Twoją akceptację: ${input.url}`
    : `${input.organizationName}: prosimy o decyzję w sprawie dodatkowych prac (${input.vehicle}). Opis i ceny: ${input.url}`
  const push: PushMessage = {
    title: input.organizationName,
    body: estimate
      ? `Kosztorys naprawy (${input.vehicle}) na ${input.total} czeka na Twoją akceptację.`
      : `Prosimy o decyzję w sprawie dodatkowych prac (${input.vehicle}).`,
    url: input.url,
    tag: `approval-${input.approvalId}`,
    lang: 'pl',
  }
  const email: Pick<OutgoingEmail, 'template' | 'data'> = {
    template: estimate ? 'estimate-request' : 'approval-request',
    data: {
      organizationName: input.organizationName,
      vehicle: input.vehicle,
      orderNumber: input.orderNumber,
      message: input.message ?? '',
      expires: input.expires,
      url: input.url,
      ...(estimate ? { total: input.total ?? '' } : {}),
    },
  }
  const [client] = await tx.select({ customerId: workOrder.customerId }).from(workOrder)
    .where(eq(workOrder.id, input.workOrderId)).limit(1)
  return queueCustomerDelivery(tx, env, {
    orgId: input.orgId,
    workOrderId: input.workOrderId,
    customerId: client!.customerId,
    approvalId: input.approvalId,
    event: estimate ? 'estimate_request' : 'approval_request',
    trigger: 'manual',
    sentBy: input.sentBy,
    channel: input.channel === 'sms' ? 'phone' : 'email',
    recipient: input.recipient,
    optedOut: false,
    smsFrom: input.smsFrom,
    content: input.channel === 'sms' ? { sms, push } : { email },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Odczyt dla karty zlecenia i karty klienta
// ─────────────────────────────────────────────────────────────────────────────

/** Wiadomości wysłane klientowi w zleceniu (numer / adres tylko dla osób z dostępem do kontaktu). */
export async function loadCustomerNotifications(tx: Tx, workOrderId: string, options: { contact: boolean }) {
  const rows = await tx
    .select({
      id: customerNotification.id,
      event: customerNotification.event,
      channel: customerNotification.channel,
      deliveredVia: customerNotification.deliveredVia,
      recipient: customerNotification.recipient,
      status: customerNotification.status,
      skipReason: customerNotification.skipReason,
      trigger: customerNotification.trigger,
      error: customerNotification.error,
      sentAt: customerNotification.sentAt,
      createdAt: customerNotification.createdAt,
      sentByName: user.name,
    })
    .from(customerNotification)
    .leftJoin(user, eq(user.id, customerNotification.sentBy))
    .where(eq(customerNotification.workOrderId, workOrderId))
    .orderBy(desc(customerNotification.createdAt))
    .limit(100)
  return rows.map(r => ({ ...r, recipient: options.contact ? r.recipient : null }))
}

/** Urządzenia klienta z włączonym push („zarejestrowany telefon”). */
export async function loadCustomerPushDevices(tx: Tx, customerId: string, currentPhone: string | null) {
  const rows = await tx.select({
    id: customerPushSubscription.id,
    phone: customerPushSubscription.phone,
    userAgent: customerPushSubscription.userAgent,
    createdAt: customerPushSubscription.createdAt,
    lastSuccessAt: customerPushSubscription.lastSuccessAt,
  }).from(customerPushSubscription)
    .where(and(eq(customerPushSubscription.customerId, customerId), isNull(customerPushSubscription.revokedAt)))
    .orderBy(asc(customerPushSubscription.createdAt))
  return rows.map(({ phone, ...row }) => ({ ...row, active: (phone ?? null) === (currentPhone ?? null) }))
}

// ─────────────────────────────────────────────────────────────────────────────
// „Zarejestrowany telefon”: klient włącza push na stronie statusu naprawy
// ─────────────────────────────────────────────────────────────────────────────

/** Najwyżej tyle urządzeń klienta dostaje push – starsze wyłączamy. */
const MAX_CUSTOMER_DEVICES = 5

export async function registerCustomerPush(
  tx: Tx,
  input: { orgId: string, customerId: string, phone: string | null, endpoint: string, p256dh: string, auth: string, userAgent: string | null },
) {
  const [row] = await tx.insert(customerPushSubscription).values({
    orgId: input.orgId,
    customerId: input.customerId,
    phone: input.phone,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    userAgent: input.userAgent?.slice(0, 300) ?? null,
  }).onConflictDoUpdate({
    target: [customerPushSubscription.customerId, customerPushSubscription.endpoint],
    set: {
      phone: input.phone,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      revokedAt: null,
    },
  }).returning({ id: customerPushSubscription.id })

  await tx.execute(sql`
    update customer_push_subscription set revoked_at = now()
    where customer_id = ${input.customerId} and revoked_at is null and id not in (
      select id from customer_push_subscription
      where customer_id = ${input.customerId} and revoked_at is null
      order by updated_at desc
      limit ${MAX_CUSTOMER_DEVICES}
    )
  `)
  return row!
}

export async function revokeCustomerPush(tx: Tx, where: { customerId: string, endpoint?: string, id?: string }) {
  const conditions = [eq(customerPushSubscription.customerId, where.customerId), isNull(customerPushSubscription.revokedAt)]
  if (where.endpoint) conditions.push(eq(customerPushSubscription.endpoint, where.endpoint))
  if (where.id) conditions.push(eq(customerPushSubscription.id, where.id))
  return tx.update(customerPushSubscription).set({ revokedAt: new Date() }).where(and(...conditions))
    .returning({ id: customerPushSubscription.id })
}
