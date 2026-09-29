/**
 * Powiadomienia – słowniki wspólne dla serwera i interfejsu.
 *
 * Zespół (mechanicy, biuro): powiadomienie zawsze trafia do dzwonka w aplikacji, a dodatkowo – według
 * ustawień osoby – e-mailem i jako push na urządzenia, na których je włączyła.
 * Klient: SMS / push („zarejestrowany telefon”) i e-mail przy zdarzeniach zlecenia, z linkiem do statusu naprawy.
 *
 * Teksty są w tłumaczeniach (i18n/locales: notifications.text.*). Serwer korzysta z tych samych plików
 * przy e-mailach i powiadomieniach push, więc treść w dzwonku, e-mailu i na telefonie jest jednakowa.
 */
import { z } from 'zod'
import { hasPermission, type PermissionRequest } from './permissions'
import type { BadgeColor } from './workshop'

// ─────────────────────────────────────────────────────────────────────────────
// Zespół warsztatu
// ─────────────────────────────────────────────────────────────────────────────

export const TEAM_NOTIFICATION_TYPES = [
  'task.assigned',
  'task.unassigned',
  'task.available',
  'work_request.created',
  'work_request.decided',
  'work_request.part_ordered',
  'work_request.part_delivered',
  'approval.answered',
  'approval.expired',
  'work_order.tasks_completed',
] as const
export type TeamNotificationType = (typeof TEAM_NOTIFICATION_TYPES)[number]

export interface TeamNotificationInfo {
  /** klucz w tłumaczeniach (notifications.types.*) */
  key: string
  icon: string
  color: BadgeColor
  /** kogo dotyczy – ustawienia pokazują tylko typy, które dana rola może dostać */
  audience: PermissionRequest
  /** z wyjątkiem osób z tym uprawnieniem (np. „zadania do wzięcia” nie trafiają do biura, które je przydziela) */
  except?: PermissionRequest
  /** domyślne kanały dodatkowe (dzwonek w aplikacji jest zawsze) */
  defaults: { email: boolean, push: boolean }
}

export const TEAM_NOTIFICATIONS: Record<TeamNotificationType, TeamNotificationInfo> = {
  'task.assigned': {
    key: 'taskAssigned',
    icon: 'i-lucide-clipboard-check',
    color: 'info',
    audience: { task: ['work'] },
    defaults: { email: false, push: true },
  },
  'task.unassigned': {
    key: 'taskUnassigned',
    icon: 'i-lucide-clipboard-x',
    color: 'neutral',
    audience: { task: ['work'] },
    defaults: { email: false, push: false },
  },
  // tylko przy zasadzie „mechanicy sami biorą zadania” – nikt ich nie przydziela, więc trzeba o nich powiedzieć
  'task.available': {
    key: 'taskAvailable',
    icon: 'i-lucide-hand',
    color: 'info',
    audience: { task: ['selfAssign'] },
    except: { task: ['assign'] },
    defaults: { email: false, push: true },
  },
  'work_request.created': {
    key: 'requestCreated',
    icon: 'i-lucide-message-square-warning',
    color: 'warning',
    audience: { workRequest: ['quote'] },
    defaults: { email: false, push: true },
  },
  'work_request.decided': {
    key: 'requestDecided',
    icon: 'i-lucide-scale',
    color: 'success',
    audience: { workRequest: ['create'] },
    defaults: { email: false, push: true },
  },
  'work_request.part_ordered': {
    key: 'partOrdered',
    icon: 'i-lucide-truck',
    color: 'info',
    audience: { workRequest: ['create'] },
    defaults: { email: false, push: false },
  },
  'work_request.part_delivered': {
    key: 'partDelivered',
    icon: 'i-lucide-package-check',
    color: 'success',
    audience: { task: ['work'] },
    defaults: { email: false, push: true },
  },
  'approval.answered': {
    key: 'approvalAnswered',
    icon: 'i-lucide-user-check',
    color: 'success',
    audience: { workRequest: ['decide'] },
    // dotychczas biuro dostawało e-mail o odpowiedzi klienta – zostaje domyślnie włączony
    defaults: { email: true, push: true },
  },
  'approval.expired': {
    key: 'approvalExpired',
    icon: 'i-lucide-clock-alert',
    color: 'warning',
    audience: { workRequest: ['decide'] },
    defaults: { email: true, push: false },
  },
  'work_order.tasks_completed': {
    key: 'tasksCompleted',
    icon: 'i-lucide-flag',
    color: 'success',
    audience: { workOrder: ['update'] },
    defaults: { email: false, push: true },
  },
}

export function isTeamNotificationType(value: unknown): value is TeamNotificationType {
  return typeof value === 'string' && (TEAM_NOTIFICATION_TYPES as readonly string[]).includes(value)
}

/** Czy osoba z tą rolą (rolami) może dostać dany typ powiadomienia – do ustawień i do rozsyłania. */
export function isTeamNotificationFor(type: TeamNotificationType, role: string | null | undefined) {
  const info = TEAM_NOTIFICATIONS[type]
  return hasPermission(role, info.audience) && !(info.except && hasPermission(role, info.except))
}

/**
 * Dane do treści powiadomienia (wstawiane w tłumaczenia: {order}, {vehicle}, {task}, {title}, {actor}…).
 * Wyłącznie teksty i liczby – bez danych kontaktowych klienta.
 */
export interface TeamNotificationData {
  order?: string
  /** marka, model i tablice; pusty – w treści zostaje typ pojazdu (vehicleType) */
  vehicle?: string
  vehicleType?: string
  task?: string
  title?: string
  actor?: string
  kind?: string
  urgency?: string
  decision?: string
  via?: string
  approved?: number
  rejected?: number
  total?: string
  /** uwagi klienta (odpowiedź na prośbę o akceptację) */
  note?: string
  /** mechanik wstrzymał zadanie do czasu dostawy części / decyzji */
  hold?: boolean
  /** zatwierdzona praca dodatkowa stała się zadaniem odbiorcy */
  newTask?: boolean
  count?: number
  [key: string]: string | number | boolean | undefined
}

/**
 * Wariant tekstu (notifications.text.<wariant>) – ten sam typ zdarzenia może mieć różne treści,
 * np. zatwierdzenie i odrzucenie pracy dodatkowej albo decyzja klienta i biura.
 */
export function teamNotificationVariant(type: TeamNotificationType, data: TeamNotificationData): TeamNotificationVariant {
  switch (type) {
    case 'task.assigned':
      return 'taskAssigned'
    case 'task.unassigned':
      return 'taskUnassigned'
    case 'task.available':
      return 'tasksAvailable'
    case 'work_request.created':
      if (data.kind === 'part') return data.hold ? 'partRequestedHold' : 'partRequested'
      return data.hold ? 'extraWorkReportedHold' : 'extraWorkReported'
    case 'work_request.decided': {
      const approved = data.decision === 'approved'
      if (data.kind === 'part') return approved ? 'partApproved' : 'partRejected'
      if (data.via === 'customer') return approved ? 'approvedByCustomer' : 'rejectedByCustomer'
      return approved ? 'approvedByOffice' : 'rejectedByOffice'
    }
    case 'work_request.part_ordered':
      return 'partOrdered'
    case 'work_request.part_delivered':
      return 'partDelivered'
    case 'approval.answered':
      if (data.kind === 'estimate') return data.decision === 'approved' ? 'estimateApproved' : 'estimateRejected'
      return 'approvalAnswered'
    case 'approval.expired':
      return data.kind === 'estimate' ? 'estimateExpired' : 'approvalExpired'
    case 'work_order.tasks_completed':
      return 'tasksCompleted'
  }
}

/** Wszystkie warianty tekstów – test pilnuje, żeby każdy miał tłumaczenie PL i EN. */
export const TEAM_NOTIFICATION_VARIANTS = [
  'taskAssigned', 'taskUnassigned', 'tasksAvailable', 'partRequested', 'partRequestedHold', 'extraWorkReported',
  'extraWorkReportedHold', 'approvedByCustomer', 'rejectedByCustomer', 'approvedByOffice', 'rejectedByOffice', 'partApproved',
  'partRejected', 'partOrdered', 'partDelivered', 'approvalAnswered', 'estimateApproved', 'estimateRejected', 'approvalExpired',
  'estimateExpired', 'tasksCompleted',
] as const
export type TeamNotificationVariant = (typeof TEAM_NOTIFICATION_VARIANTS)[number]

/**
 * Parametry tekstu: dane powiadomienia i uzupełnienia w języku odbiorcy (typ pojazdu zamiast pustej nazwy,
 * „Zadanie jest na Twojej liście” przy zatwierdzonej pracy). `translate` to vue-i18n `t` albo odczyt z plików tłumaczeń.
 */
export function teamNotificationParams(data: TeamNotificationData, translate: (key: string) => string): Record<string, unknown> {
  return {
    ...data,
    vehicle: data.vehicle || (data.vehicleType ? translate(`vehicleType.${data.vehicleType}`) : ''),
    next: data.newTask ? translate('notifications.next.newTask') : '',
  }
}

/** Podstawienie {nazwa} w tekście – ta sama składnia co w vue-i18n (bez liczby mnogiej i odwołań @). */
export function interpolate(template: string, data: Record<string, unknown>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = data[key]
    return value === undefined || value === null ? '' : String(value)
  }).replace(/\s+([,.)])/g, '$1').replace(/\s{2,}/g, ' ').trim()
}

export const notificationPreferenceSchema = z.object({
  type: z.enum(TEAM_NOTIFICATION_TYPES),
  email: z.boolean(),
  push: z.boolean(),
})
export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>

/** Subskrypcja Web Push z przeglądarki (PushSubscription.toJSON()). */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(1000).refine(url => url.startsWith('https://'), 'Adres usługi push musi używać HTTPS.'),
  keys: z.object({
    p256dh: z.string().regex(/^[\w-]{20,200}={0,2}$/),
    auth: z.string().regex(/^[\w-]{10,100}={0,2}$/),
  }),
})
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>

export const pushUnsubscribeSchema = z.object({ endpoint: z.url().max(1000) })

export const notificationReadSchema = z.union([
  z.object({ ids: z.array(z.uuid()).min(1).max(200) }),
  z.object({ all: z.literal(true) }),
])

// ─────────────────────────────────────────────────────────────────────────────
// Klient warsztatu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zdarzenia, o których powiadamiamy klienta. Decyzja D5: SMS tylko przy przyjęciu pojazdu,
 * prośbie o akceptację (prace dodatkowe, kosztorys) i gotowości do odbioru.
 */
export const CUSTOMER_NOTIFICATION_EVENTS = ['order_received', 'order_ready', 'approval_request', 'estimate_request'] as const
export type CustomerNotificationEvent = (typeof CUSTOMER_NOTIFICATION_EVENTS)[number]

/** Zdarzenia wysyłane automatycznie według ustawień warsztatu (akceptacje wysyła biuro ręcznie). */
export const AUTO_CUSTOMER_EVENTS = ['order_received', 'order_ready'] as const
export type AutoCustomerEvent = (typeof AUTO_CUSTOMER_EVENTS)[number]

/** phone – SMS albo push, gdy klient włączył powiadomienia w telefonie; email – e-mail. */
export const CUSTOMER_CHANNELS = ['phone', 'email'] as const
export type CustomerChannel = (typeof CUSTOMER_CHANNELS)[number]

export const CUSTOMER_DELIVERIES = ['push', 'sms', 'email'] as const
export type CustomerDelivery = (typeof CUSTOMER_DELIVERIES)[number]

export const CUSTOMER_NOTIFICATION_STATUSES = ['queued', 'sent', 'failed', 'skipped'] as const
export type CustomerNotificationStatus = (typeof CUSTOMER_NOTIFICATION_STATUSES)[number]

/** Dlaczego nie wysłano: brak numeru / adresu albo klient nie chce tego kanału. */
export const CUSTOMER_SKIP_REASONS = ['no_contact', 'opted_out'] as const
export type CustomerSkipReason = (typeof CUSTOMER_SKIP_REASONS)[number]

export const CUSTOMER_NOTIFICATION_STATUS_COLOR: Record<CustomerNotificationStatus, BadgeColor> = {
  queued: 'info',
  sent: 'success',
  failed: 'error',
  skipped: 'neutral',
}

export const customerNotificationRuleSchema = z.object({
  /** wysyłaj samo przy zdarzeniu (przyjęcie zlecenia, zmiana statusu na „gotowe do odbioru”) */
  auto: z.boolean(),
  phone: z.boolean(),
  email: z.boolean(),
})
export type CustomerNotificationRule = z.infer<typeof customerNotificationRuleSchema>

export const customerNotificationSettingsSchema = z.object({
  order_received: customerNotificationRuleSchema,
  order_ready: customerNotificationRuleSchema,
})
export type CustomerNotificationSettings = z.infer<typeof customerNotificationSettingsSchema>

/** Domyślnie (jak w migracji): przy przyjęciu i gotowości do odbioru – telefon i e-mail. */
export const DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS: CustomerNotificationSettings = {
  order_received: { auto: true, phone: true, email: true },
  order_ready: { auto: true, phone: true, email: true },
}

/** Ustawienia z bazy (jsonb) z uzupełnieniem brakujących pól wartościami domyślnymi. */
export function resolveCustomerNotificationSettings(value: unknown): CustomerNotificationSettings {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, Partial<CustomerNotificationRule> | undefined>
  const rule = (event: AutoCustomerEvent): CustomerNotificationRule => {
    const fallback = DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS[event]
    const given = source[event] ?? {}
    return {
      auto: typeof given.auto === 'boolean' ? given.auto : fallback.auto,
      phone: typeof given.phone === 'boolean' ? given.phone : fallback.phone,
      email: typeof given.email === 'boolean' ? given.email : fallback.email,
    }
  }
  return { order_received: rule('order_received'), order_ready: rule('order_ready') }
}

export const customerNotifySchema = z.object({
  event: z.enum(AUTO_CUSTOMER_EVENTS),
  phone: z.boolean(),
  email: z.boolean(),
}).refine(value => value.phone || value.email, { message: 'Wybierz co najmniej jeden kanał.', path: ['phone'] })
export type CustomerNotifyInput = z.infer<typeof customerNotifySchema>

export const statusLinkSchema = z.object({ rotate: z.boolean().default(false) })

/** Token strony statusu naprawy (base64url, 24 znaki). */
export const statusTokenSchema = z.object({ token: z.string().regex(/^[\w-]{24}$/) })

/** Kroki na stronie statusu naprawy widoczne dla klienta. */
export const STATUS_STEPS = ['received', 'in_progress', 'ready', 'closed'] as const
export type StatusStep = (typeof STATUS_STEPS)[number]

/** Status zlecenia → krok na osi naprawy (oczekiwanie na części / decyzję to nadal „w naprawie”). */
export function statusStep(status: string): StatusStep {
  if (status === 'received') return 'received'
  if (status === 'ready') return 'ready'
  if (status === 'closed') return 'closed'
  return 'in_progress'
}

/** Pojazd w treści powiadomień: „Toyota Corolla WX12345” (bez marki – sam numer rejestracyjny). */
export function vehicleText(
  vehicle: { make?: string | null, model?: string | null, registrationNumber?: string | null },
  fallback = '',
) {
  const name = [vehicle.make, vehicle.model].filter(Boolean).join(' ')
  return [name, vehicle.registrationNumber].filter(Boolean).join(' ') || fallback
}

/** Numer na publicznej stronie statusu: tylko trzy ostatnie cyfry („••• ••• 200”). */
export function maskPhone(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.length >= 3 ? `••• ••• ${digits.slice(-3)}` : null
}

/** Adres e-mail na publicznej stronie statusu: pierwsza litera i domena („j•••@example.com”). */
export function maskEmail(email: string | null | undefined) {
  const [local, domain] = (email ?? '').split('@')
  return local && domain ? `${local[0]}•••@${domain}` : null
}

/** Klient na stronie statusu włącza albo wyłącza wiadomości SMS / e-mail o naprawie. */
export const statusPreferencesSchema = z.object({
  sms: z.boolean().optional(),
  email: z.boolean().optional(),
}).refine(value => value.sms !== undefined || value.email !== undefined, { message: 'Brak zmian.' })
