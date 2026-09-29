/**
 * Walidacja danych wspólna dla formularzy (aplikacja) i API (serwer).
 */
import { z } from 'zod'
import {
  CUSTOMER_KINDS, ESTIMATE_ITEM_KINDS, METER_UNITS, SERVICE_PRICINGS, TASK_STATUSES, VEHICLE_TYPES, WORK_ORDER_STATUSES,
  WORK_REQUEST_KINDS, WORK_REQUEST_URGENCIES, isValidIban, isValidTaxId, normalizeIban, normalizeTaxId,
} from './workshop'

export const ASSIGNMENT_POLICY_OPTIONS = [
  { value: 'office', label: 'Biuro przydziela zadania' },
  { value: 'self', label: 'Mechanicy sami biorą zadania' },
  { value: 'mixed', label: 'Tryb mieszany' },
] as const

export const orgSettingsSchema = z.object({
  assignmentPolicy: z.enum(['office', 'self', 'mixed']),
  smsSenderName: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9 .-]{0,11}$/, 'Do 11 znaków: litery bez polskich znaków, cyfry, spacja, kropka, myślnik')
    .transform(v => v || null)
    .nullable(),
  timezone: z.string().trim().min(1).max(64),
  locale: z.enum(['pl', 'en']),
  logoFileId: z.uuid().nullable(),
})

export type OrgSettingsInput = z.input<typeof orgSettingsSchema>

export const FILE_RULES = {
  logo: {
    maxBytes: 2 * 1024 * 1024,
    types: ['image/png', 'image/jpeg', 'image/webp'],
  },
  attachment: {
    maxBytes: 200 * 1024 * 1024,
    types: ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf'],
  },
} as const

export const uploadRequestSchema = z
  .object({
    fileName: z.string().trim().min(1).max(200),
    contentType: z.string().trim().min(3).max(100),
    sizeBytes: z.number().int().positive(),
    purpose: z.enum(['logo', 'attachment']),
  })
  .superRefine((value, ctx) => {
    const rule = FILE_RULES[value.purpose]
    if (!(rule.types as readonly string[]).includes(value.contentType)) {
      ctx.addIssue({ code: 'custom', path: ['contentType'], message: 'Niedozwolony typ pliku.' })
    }
    if (value.sizeBytes > rule.maxBytes) {
      ctx.addIssue({ code: 'custom', path: ['sizeBytes'], message: `Plik jest za duży (maks. ${Math.round(rule.maxBytes / 1024 / 1024)} MB).` })
    }
  })

export type UploadRequest = z.infer<typeof uploadRequestSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Warsztat: klienci, pojazdy, zlecenia, zadania
// ─────────────────────────────────────────────────────────────────────────────

/** Tekst opcjonalny z formularza: pusty napis → null. */
function nullableText(max: number) {
  return z.string().trim().max(max).nullish().transform(v => (v ? v : null))
}

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i

export const customerSchema = z.object({
  kind: z.enum(CUSTOMER_KINDS),
  name: z.string().trim().min(2).max(200),
  taxId: nullableText(20),
  email: nullableText(200).refine(v => v === null || z.email().safeParse(v).success, 'Nieprawidłowy adres e-mail.'),
  phone: nullableText(20).refine(v => v === null || /^[+\d][\d\s()-]{6,19}$/.test(v), 'Nieprawidłowy numer telefonu.'),
  notes: nullableText(2000),
  /** Wiadomości o naprawie SMS-em / e-mailem (klient może z nich zrezygnować). Brak pola = bez zmian / domyślnie tak. */
  notifySms: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
})
export type CustomerInput = z.input<typeof customerSchema>

export const customerUpdateSchema = customerSchema.partial()

export const vehicleSchema = z.object({
  customerId: z.uuid(),
  type: z.enum(VEHICLE_TYPES),
  make: nullableText(60),
  model: nullableText(80),
  year: z.number().int().min(1900).max(2100).nullish().transform(v => v ?? null),
  registrationNumber: nullableText(20),
  vin: nullableText(17).refine(v => v === null || VIN_RE.test(v), 'VIN ma 17 znaków (bez liter I, O, Q).'),
  serialNumber: nullableText(60),
  meterUnit: z.enum(METER_UNITS),
  meterValue: z.number().int().min(0).max(100_000_000).nullish().transform(v => v ?? null),
  notes: nullableText(2000),
})
export type VehicleInput = z.input<typeof vehicleSchema>

export const vehicleUpdateSchema = vehicleSchema.omit({ customerId: true }).partial()

export const workOrderCreateSchema = z.object({
  customerId: z.uuid(),
  vehicleId: z.uuid(),
  description: nullableText(4000),
  meterValue: z.number().int().min(0).max(100_000_000).nullish().transform(v => v ?? null),
  promisedAt: z.iso.datetime({ offset: true }).nullish().transform(v => v ?? null),
  tasks: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  /**
   * Potwierdzenie przyjęcia pojazdu dla klienta: true – wyślij (kanały z ustawień warsztatu), false – nie wysyłaj,
   * brak pola – według ustawień warsztatu.
   */
  notifyCustomer: z.boolean().optional(),
})
export type WorkOrderCreateInput = z.input<typeof workOrderCreateSchema>

export const workOrderUpdateSchema = z.object({
  status: z.enum(WORK_ORDER_STATUSES).optional(),
  description: nullableText(4000).optional(),
  meterValue: z.number().int().min(0).max(100_000_000).nullish().transform(v => v ?? null).optional(),
  promisedAt: z.iso.datetime({ offset: true }).nullish().transform(v => v ?? null).optional(),
  /** Paragon z kasy fiskalnej – zwykle wpisywany przy zamknięciu zlecenia. */
  receiptNumber: nullableText(40).optional(),
  receiptIssuedOn: z.iso.date().nullish().transform(v => v ?? null).optional(),
  /** Przy zmianie statusu na „gotowe do odbioru”: true – powiadom klienta, false – nie, brak pola – według ustawień. */
  notifyCustomer: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (value.receiptIssuedOn && value.receiptNumber === null) {
    ctx.addIssue({ code: 'custom', path: ['receiptNumber'], message: 'Podaj numer paragonu.' })
  }
})

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: nullableText(4000),
  parentId: z.uuid().nullish().transform(v => v ?? null),
  estimatedMinutes: z.number().int().min(0).max(100_000).nullish().transform(v => v ?? null),
})
export type TaskCreateInput = z.input<typeof taskCreateSchema>

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: nullableText(4000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  estimatedMinutes: z.number().int().min(0).max(100_000).nullish().transform(v => v ?? null).optional(),
  position: z.number().int().min(0).max(10_000).optional(),
})

export const assignmentSchema = z.object({ userId: z.uuid() })

// ─────────────────────────────────────────────────────────────────────────────
// Praca mechanika: czas pracy, zgłoszone potrzeby, załączniki
// ─────────────────────────────────────────────────────────────────────────────

export const taskWorkSchema = z.object({ action: z.enum(['start', 'pause', 'finish']) })

export const workRequestCreateSchema = z.object({
  kind: z.enum(WORK_REQUEST_KINDS),
  title: z.string().trim().min(2).max(200),
  description: nullableText(4000),
  urgency: z.enum(WORK_REQUEST_URGENCIES),
  taskId: z.uuid().nullish().transform(v => v ?? null),
  /** Mechanik nie może kontynuować zadania bez tej części / decyzji. */
  holdTask: z.boolean().default(false),
})
export type WorkRequestCreateInput = z.input<typeof workRequestCreateSchema>

/** Kwota netto z formularza: liczba ≥ 0 z dokładnością do grosza. */
const money = z.number().min(0).max(10_000_000).refine(v => Math.round(v * 100) === Number((v * 100).toFixed(6)), 'Maksymalnie dwa miejsca po przecinku.')

export const workRequestActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('quote'),
    partsNet: money.nullable(),
    laborNet: money.nullable(),
    vatRate: z.number().min(0).max(100),
    officeNote: nullableText(2000),
  }),
  z.object({
    action: z.literal('decide'),
    decision: z.enum(['approved', 'rejected']),
    decisionNote: nullableText(500),
  }),
  z.object({
    action: z.literal('status'),
    status: z.enum(['ordered', 'done', 'cancelled']),
  }),
])
export type WorkRequestAction = z.input<typeof workRequestActionSchema>

export const attachmentCreateSchema = z.object({
  fileId: z.uuid(),
  taskId: z.uuid().nullish().transform(v => v ?? null),
  workRequestId: z.uuid().nullish().transform(v => v ?? null),
  caption: nullableText(300),
})

// ─────────────────────────────────────────────────────────────────────────────
// Akceptacje klienta
// ─────────────────────────────────────────────────────────────────────────────

export const APPROVAL_EXPIRY_DAYS = [1, 3, 7, 14] as const

const approvalDelivery = {
  channel: z.enum(['link', 'email', 'sms']),
  recipient: nullableText(200),
  message: nullableText(500),
  expiresInDays: z.number().int().min(1).max(14).default(3),
}

function checkRecipient(value: { channel: 'link' | 'email' | 'sms', recipient: string | null }, ctx: z.RefinementCtx) {
  if (value.channel === 'email' && !(value.recipient && z.email().safeParse(value.recipient).success)) {
    ctx.addIssue({ code: 'custom', path: ['recipient'], message: 'Podaj poprawny adres e-mail.' })
  }
  if (value.channel === 'sms' && !(value.recipient && /^\+?\d{9,15}$/.test(value.recipient.replace(/[\s()-]/g, '')))) {
    ctx.addIssue({ code: 'custom', path: ['recipient'], message: 'Podaj poprawny numer telefonu.' })
  }
}

export const approvalCreateSchema = z.object({
  requestIds: z.array(z.uuid()).min(1).max(30),
  ...approvalDelivery,
}).superRefine(checkRecipient)
export type ApprovalCreateInput = z.input<typeof approvalCreateSchema>

/** Kosztorys do akceptacji: te same kanały co prośba o zgodę na prace dodatkowe. */
export const estimateApprovalCreateSchema = z.object(approvalDelivery).superRefine(checkRecipient)
export type EstimateApprovalCreateInput = z.input<typeof estimateApprovalCreateSchema>

export const approvalAnswerSchema = z.object({
  decisions: z.array(z.object({
    requestId: z.uuid(),
    decision: z.enum(['approved', 'rejected']),
  })).min(1).max(30),
  note: nullableText(1000),
  /** Wyraźna zgoda na koszt zatwierdzonych pozycji – wymagana, gdy cokolwiek zatwierdzono. */
  consent: z.boolean(),
})
export type ApprovalAnswerInput = z.input<typeof approvalAnswerSchema>

/** Odpowiedź klienta na kosztorys: jedna decyzja o całości. */
export const estimateAnswerSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: nullableText(1000),
  consent: z.boolean(),
})
export type EstimateAnswerInput = z.input<typeof estimateAnswerSchema>

/** Token z linku akceptacji (base64url). */
export const approvalTokenSchema = z.object({ token: z.string().regex(/^[\w-]{20,100}$/) })

// ─────────────────────────────────────────────────────────────────────────────
// Rozliczenie zlecenia (E4): dane firmy, cennik, kosztorys
// ─────────────────────────────────────────────────────────────────────────────

const vatRate = z.number().min(0).max(100)

export const companyProfileSchema = z.object({
  legalName: nullableText(200),
  taxId: nullableText(30)
    .transform(normalizeTaxId)
    .refine(v => v === null || isValidTaxId(v), 'Nieprawidłowy NIP (sprawdź cyfry) albo numer VAT UE.'),
  street: nullableText(200),
  postalCode: nullableText(12),
  city: nullableText(100),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'Kod kraju, np. PL.').default('PL'),
  phone: nullableText(30).refine(v => v === null || /^[+\d][\d\s()-]{6,29}$/.test(v), 'Nieprawidłowy numer telefonu.'),
  email: nullableText(200).refine(v => v === null || z.email().safeParse(v).success, 'Nieprawidłowy adres e-mail.'),
  website: nullableText(200),
  bankAccount: nullableText(50)
    .transform(normalizeIban)
    .refine(v => v === null || isValidIban(v), 'Nieprawidłowy numer rachunku – sprawdź cyfry (26 cyfr albo IBAN).'),
  laborRateNet: money.nullable(),
  defaultVatRate: vatRate,
  documentFooter: nullableText(1000),
}).superRefine((value, ctx) => {
  if (value.country === 'PL' && value.postalCode && !/^\d{2}-\d{3}$/.test(value.postalCode)) {
    ctx.addIssue({ code: 'custom', path: ['postalCode'], message: 'Kod pocztowy w formacie 00-000.' })
  }
})
export type CompanyProfileInput = z.input<typeof companyProfileSchema>

/** Liczba z dokładnością do 2 miejsc po przecinku (norma czasu, stawki). */
function decimals(max: number, digits: number) {
  const factor = 10 ** digits
  return z.number().max(max).refine(v => Math.abs(Math.round(v * factor) - v * factor) < 1e-6, `Maksymalnie ${digits} miejsca po przecinku.`)
}

export const servicePriceSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: nullableText(1000),
  category: nullableText(60),
  pricing: z.enum(SERVICE_PRICINGS),
  priceNet: money.nullable(),
  laborHours: decimals(1000, 2).refine(v => v > 0, 'Norma czasu musi być większa od zera.').nullable(),
  vatRate,
}).superRefine((value, ctx) => {
  if (value.pricing === 'fixed' && value.priceNet === null) {
    ctx.addIssue({ code: 'custom', path: ['priceNet'], message: 'Podaj cenę netto.' })
  }
  if (value.pricing === 'hourly' && value.laborHours === null) {
    ctx.addIssue({ code: 'custom', path: ['laborHours'], message: 'Podaj normę czasu w godzinach.' })
  }
})
export type ServicePriceInput = z.input<typeof servicePriceSchema>

const quantity = decimals(100_000, 3).refine(v => v > 0, 'Ilość musi być większa od zera.')
const unit = z.string().trim().min(1).max(10)
const discount = decimals(100, 2).refine(v => v >= 0, 'Rabat od 0 do 100%.')

export const estimateItemCreateSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('price_list'),
    servicePriceId: z.uuid(),
    /** ile razy usługa (np. 2 × wymiana opony) */
    count: quantity.default(1),
  }),
  z.object({
    source: z.literal('manual'),
    kind: z.enum(ESTIMATE_ITEM_KINDS),
    name: z.string().trim().min(1).max(200),
    quantity,
    unit,
    unitPriceNet: money,
    discountPercent: discount.default(0),
    vatRate,
  }),
])
export type EstimateItemCreateInput = z.input<typeof estimateItemCreateSchema>

export const estimateItemUpdateSchema = z.object({
  kind: z.enum(ESTIMATE_ITEM_KINDS).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  quantity: quantity.optional(),
  unit: unit.optional(),
  unitPriceNet: money.optional(),
  discountPercent: discount.optional(),
  vatRate: vatRate.optional(),
})
export type EstimateItemUpdateInput = z.input<typeof estimateItemUpdateSchema>
