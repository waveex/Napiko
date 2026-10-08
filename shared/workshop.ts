/**
 * Słowniki warsztatu wspólne dla serwera i interfejsu.
 * Etykiety są w tłumaczeniach (i18n/locales): vehicleType.*, workOrderStatus.*, taskStatus.* itd.
 */

export const CUSTOMER_KINDS = ['person', 'company'] as const
export type CustomerKind = (typeof CUSTOMER_KINDS)[number]

export const METER_UNITS = ['km', 'mth', 'none'] as const
export type MeterUnit = (typeof METER_UNITS)[number]

export const VEHICLE_TYPES = [
  'car', 'van', 'truck', 'bus', 'trailer', 'camper', 'motorcycle', 'moped', 'atv',
  'bicycle', 'ebike', 'scooter', 'tractor', 'agricultural', 'forklift', 'construction', 'boat', 'garden', 'other',
] as const
export type VehicleType = (typeof VEHICLE_TYPES)[number]

/** Jak identyfikujemy obiekt: VIN (pojazdy drogowe), numer ramy (rowery) albo numer fabryczny (maszyny). */
export type IdentifierKind = 'vin' | 'frame' | 'serial'

export interface VehicleTypeInfo {
  icon: string
  meterUnit: MeterUnit
  identifier: IdentifierKind
  /** Czy zwykle ma tablice rejestracyjne. */
  registration: boolean
}

export const VEHICLE_TYPE_INFO: Record<VehicleType, VehicleTypeInfo> = {
  car: { icon: 'i-lucide-car', meterUnit: 'km', identifier: 'vin', registration: true },
  van: { icon: 'i-lucide-truck', meterUnit: 'km', identifier: 'vin', registration: true },
  truck: { icon: 'i-lucide-truck', meterUnit: 'km', identifier: 'vin', registration: true },
  bus: { icon: 'i-lucide-bus', meterUnit: 'km', identifier: 'vin', registration: true },
  trailer: { icon: 'i-lucide-container', meterUnit: 'none', identifier: 'vin', registration: true },
  camper: { icon: 'i-lucide-caravan', meterUnit: 'km', identifier: 'vin', registration: true },
  motorcycle: { icon: 'i-lucide-bike', meterUnit: 'km', identifier: 'vin', registration: true },
  moped: { icon: 'i-lucide-bike', meterUnit: 'km', identifier: 'vin', registration: true },
  atv: { icon: 'i-lucide-tractor', meterUnit: 'km', identifier: 'vin', registration: true },
  bicycle: { icon: 'i-lucide-bike', meterUnit: 'none', identifier: 'frame', registration: false },
  ebike: { icon: 'i-lucide-bike', meterUnit: 'km', identifier: 'frame', registration: false },
  scooter: { icon: 'i-lucide-zap', meterUnit: 'km', identifier: 'serial', registration: false },
  tractor: { icon: 'i-lucide-tractor', meterUnit: 'mth', identifier: 'vin', registration: true },
  agricultural: { icon: 'i-lucide-wheat', meterUnit: 'mth', identifier: 'serial', registration: false },
  forklift: { icon: 'i-lucide-forklift', meterUnit: 'mth', identifier: 'serial', registration: false },
  construction: { icon: 'i-lucide-construction', meterUnit: 'mth', identifier: 'serial', registration: false },
  boat: { icon: 'i-lucide-sailboat', meterUnit: 'mth', identifier: 'serial', registration: false },
  garden: { icon: 'i-lucide-leaf', meterUnit: 'mth', identifier: 'serial', registration: false },
  other: { icon: 'i-lucide-wrench', meterUnit: 'none', identifier: 'serial', registration: false },
}

export const WORK_ORDER_STATUSES = [
  'received', 'in_progress', 'waiting_approval', 'waiting_parts', 'ready', 'closed', 'cancelled',
] as const
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number]

/** Kolumny tablicy zleceń (zamknięte i anulowane są w archiwum). */
export const BOARD_STATUSES = ['received', 'in_progress', 'waiting_approval', 'waiting_parts', 'ready'] as const satisfies readonly WorkOrderStatus[]

export const TASK_STATUSES = [
  'todo', 'in_progress', 'paused', 'waiting_parts', 'waiting_approval', 'done', 'cancelled',
] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

/**
 * work – zwykłe zadanie robocze; handover – „Wydanie auta”, dokładane automatycznie, gdy wszystkie zadania
 * zlecenia są zrobione (nie liczy się do postępu prac).
 */
export const TASK_KINDS = ['work', 'handover'] as const
export type TaskKind = (typeof TASK_KINDS)[number]

/** Tytuł zapisany w bazie; interfejs pokazuje tłumaczenie (tasks.handover). */
export const HANDOVER_TASK_TITLE = 'Wydanie auta'

/**
 * Wszystkie zadania robocze (bez anulowanych) są zrobione – wtedy zlecenie czeka tylko na wydanie.
 * Zadanie wydania nie bierze udziału w tej ocenie.
 */
export function allWorkDone(tasks: readonly { kind: TaskKind, status: TaskStatus }[]) {
  const work = tasks.filter(t => t.kind === 'work' && t.status !== 'cancelled')
  return work.length > 0 && work.every(t => t.status === 'done')
}

export type BadgeColor = 'neutral' | 'primary' | 'info' | 'warning' | 'success' | 'error'

export const WORK_ORDER_STATUS_COLOR: Record<WorkOrderStatus, BadgeColor> = {
  received: 'neutral',
  in_progress: 'info',
  waiting_approval: 'warning',
  waiting_parts: 'warning',
  ready: 'success',
  closed: 'neutral',
  cancelled: 'error',
}

export const TASK_STATUS_COLOR: Record<TaskStatus, BadgeColor> = {
  todo: 'neutral',
  in_progress: 'info',
  paused: 'neutral',
  waiting_parts: 'warning',
  waiting_approval: 'warning',
  done: 'success',
  cancelled: 'error',
}

export const TASK_STATUS_ICON: Record<TaskStatus, string> = {
  todo: 'i-lucide-circle',
  in_progress: 'i-lucide-circle-play',
  paused: 'i-lucide-circle-pause',
  waiting_parts: 'i-lucide-package',
  waiting_approval: 'i-lucide-hourglass',
  done: 'i-lucide-circle-check',
  cancelled: 'i-lucide-circle-x',
}

/** Numer zlecenia widoczny dla ludzi, np. ZL/2026/0007. */
export function formatWorkOrderNumber(year: number, sequence: number) {
  return `ZL/${year}/${String(sequence).padStart(4, '0')}`
}

/** Tablice rejestracyjne: wielkie litery, bez spacji i myślników. */
export function normalizeRegistration(value: string | null | undefined) {
  const v = (value ?? '').toUpperCase().replace(/[\s-]/g, '')
  return v || null
}

/** Telefon: bez spacji i myślników; 9 cyfr traktujemy jako numer polski (+48). */
export function normalizePhone(value: string | null | undefined) {
  const v = (value ?? '').replace(/[\s()-]/g, '')
  if (!v) return null
  if (/^\d{9}$/.test(v)) return `+48${v}`
  if (/^00\d+$/.test(v)) return `+${v.slice(2)}`
  return v
}

// ─────────────────────────────────────────────────────────────────────────────
// Praca mechanika: zgłoszone potrzeby (części, prace dodatkowe)
// ─────────────────────────────────────────────────────────────────────────────

/** part – część potrzebna w zakresie zlecenia; extra_work – praca dodatkowa, wymaga zgody klienta. */
export const WORK_REQUEST_KINDS = ['part', 'extra_work'] as const
export type WorkRequestKind = (typeof WORK_REQUEST_KINDS)[number]

/** Pilność jak w cyfrowej inspekcji pojazdu: czerwone – bezpieczeństwo, żółte – zalecane, zielone – może poczekać. */
export const WORK_REQUEST_URGENCIES = ['urgent', 'recommended', 'later'] as const
export type WorkRequestUrgency = (typeof WORK_REQUEST_URGENCIES)[number]

export const WORK_REQUEST_STATUSES = ['open', 'quoted', 'approved', 'rejected', 'ordered', 'done', 'cancelled'] as const
export type WorkRequestStatus = (typeof WORK_REQUEST_STATUSES)[number]

/** Zgłoszenia wymagające jeszcze działania biura. */
export const OPEN_WORK_REQUEST_STATUSES = ['open', 'quoted', 'approved', 'ordered'] as const satisfies readonly WorkRequestStatus[]

export const WORK_REQUEST_STATUS_COLOR: Record<WorkRequestStatus, BadgeColor> = {
  open: 'warning',
  quoted: 'info',
  approved: 'success',
  rejected: 'neutral',
  ordered: 'info',
  done: 'success',
  cancelled: 'neutral',
}

export const URGENCY_COLOR: Record<WorkRequestUrgency, BadgeColor> = {
  urgent: 'error',
  recommended: 'warning',
  later: 'success',
}

export const VAT_RATES = [23, 8, 5, 0] as const

/** Kwoty z bazy (numeric jako tekst) → grosze; unikamy błędów zaokrągleń liczb zmiennoprzecinkowych. */
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  return Math.round(Number(value) * 100)
}

/** Suma brutto wyceny w groszach: (części + robocizna) netto × (1 + VAT). */
export function grossCents(partsNet: string | number | null, laborNet: string | number | null, vatRate: string | number) {
  const net = toCents(partsNet) + toCents(laborNet)
  return Math.round(net * (1 + Number(vatRate) / 100))
}

/** Czas w sekundach → „1 h 05 min” / „12 min” / „45 s”. */
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`
  if (m) return `${m} min`
  return `${s} s`
}

/** Licznik na żywo: „1:05:09”. */
export function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Rozliczenie zlecenia (E4): cennik, kosztorys, dane firmy
// ─────────────────────────────────────────────────────────────────────────────

/** fixed – cena stała netto; hourly – norma czasu × stawka roboczogodziny z danych firmy. */
export const SERVICE_PRICINGS = ['fixed', 'hourly'] as const
export type ServicePricing = (typeof SERVICE_PRICINGS)[number]

export const ESTIMATE_ITEM_KINDS = ['labor', 'part', 'other'] as const
export type EstimateItemKind = (typeof ESTIMATE_ITEM_KINDS)[number]

export const ESTIMATE_ITEM_SOURCES = ['manual', 'price_list', 'work_request'] as const
export type EstimateItemSource = (typeof ESTIMATE_ITEM_SOURCES)[number]

/** Podpowiedzi jednostek w formularzu (można wpisać własną). */
export const ESTIMATE_UNITS = ['usł.', 'h', 'szt.', 'kpl.', 'l', 'kg', 'm'] as const

/**
 * Liczba dziesiętna (tekst z bazy albo liczba z formularza) → liczba całkowita w jednostkach 10^-digits,
 * np. scaled('1.235', 3) = 1235n. Liczymy na BigInt, żeby uniknąć błędów liczb zmiennoprzecinkowych.
 */
export function scaled(value: string | number | null | undefined, digits: number): bigint {
  if (value === null || value === undefined || value === '') return 0n
  const text = typeof value === 'number' ? value.toFixed(digits + 2) : value.trim()
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(text)
  if (!match) return 0n
  const [, sign, int = '', frac = ''] = match
  // jedna cyfra więcej do zaokrąglenia połówek w górę
  const n = (BigInt((int || '0') + (frac + '0'.repeat(digits + 1)).slice(0, digits + 1)) + 5n) / 10n
  return sign ? -n : n
}

function divRound(value: bigint, divisor: bigint) {
  return (value * 2n + divisor) / (2n * divisor)
}

export interface EstimateLineInput {
  quantity: string | number
  unitPriceNet: string | number
  discountPercent: string | number
  vatRate: string | number
}

/** Wartość pozycji kosztorysu w groszach: netto = ilość × cena × (1 − rabat), VAT od netto pozycji. */
export function estimateLine(line: EstimateLineInput) {
  const qtyMilli = scaled(line.quantity, 3)
  const unitCents = scaled(line.unitPriceNet, 2)
  const discountBp = scaled(line.discountPercent, 2)
  const vatBp = scaled(line.vatRate, 2)
  const netCents = divRound(unitCents * qtyMilli * (10000n - discountBp), 10_000_000n)
  const vatCents = divRound(netCents * vatBp, 10_000n)
  return { netCents: Number(netCents), vatCents: Number(vatCents), grossCents: Number(netCents + vatCents) }
}

/** Stawka VAT jako tekst bez zbędnych zer: '23.00' → '23', '5.50' → '5.5'. */
export function vatKey(rate: string | number) {
  return String(Number(rate))
}

/** Sumy kosztorysu: suma pozycji oraz zestawienie według stawek VAT. */
export function estimateTotals(lines: { vatRate: string | number, netCents: number, vatCents: number, grossCents: number }[]) {
  const byRate = new Map<string, { vatRate: string, netCents: number, vatCents: number, grossCents: number }>()
  for (const line of lines) {
    const key = vatKey(line.vatRate)
    const row = byRate.get(key) ?? { vatRate: key, netCents: 0, vatCents: 0, grossCents: 0 }
    row.netCents += line.netCents
    row.vatCents += line.vatCents
    row.grossCents += line.grossCents
    byRate.set(key, row)
  }
  return {
    netCents: lines.reduce((sum, l) => sum + l.netCents, 0),
    vatCents: lines.reduce((sum, l) => sum + l.vatCents, 0),
    grossCents: lines.reduce((sum, l) => sum + l.grossCents, 0),
    byRate: [...byRate.values()].sort((a, b) => Number(b.vatRate) - Number(a.vatRate)),
  }
}

/** NIP / numer VAT: bez spacji, kresek i kropek, wielkie litery; prefiks PL przy 10 cyfrach pomijamy. */
export function normalizeTaxId(value: string | null | undefined) {
  const v = (value ?? '').toUpperCase().replace(/[\s.-]/g, '')
  if (!v) return null
  return /^PL\d{10}$/.test(v) ? v.slice(2) : v
}

/** Suma kontrolna NIP (wagi 6-5-7-2-3-4-5-6-7). */
export function isValidNip(nip: string) {
  if (!/^\d{10}$/.test(nip)) return false
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const sum = weights.reduce((acc, w, i) => acc + w * Number(nip[i]), 0)
  return sum % 11 !== 10 && sum % 11 === Number(nip[9])
}

/** Polski NIP (10 cyfr, z sumą kontrolną) albo numer VAT UE z prefiksem kraju. */
export function isValidTaxId(value: string) {
  if (/^\d{10}$/.test(value)) return isValidNip(value)
  return /^[A-Z]{2}[0-9A-Z+*]{2,12}$/.test(value) && !value.startsWith('PL')
}

/** Rachunek: bez spacji, wielkie litery; 26 cyfr (NRB) traktujemy jako polski IBAN. */
export function normalizeIban(value: string | null | undefined) {
  const v = (value ?? '').toUpperCase().replace(/[\s-]/g, '')
  if (!v) return null
  return /^\d{26}$/.test(v) ? `PL${v}` : v
}

/** Suma kontrolna IBAN (mod 97). */
export function isValidIban(iban: string) {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false
  if (iban.startsWith('PL') && iban.length !== 28) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const char of rearranged) {
    const code = char >= 'A' && char <= 'Z' ? String(char.charCodeAt(0) - 55) : char
    for (const digit of code) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

/** IBAN do wyświetlenia: grupy po 4 znaki. */
export function formatIban(iban: string | null | undefined) {
  return iban ? iban.replace(/(.{4})/g, '$1 ').trim() : ''
}

/** NIP do wyświetlenia: 123-456-78-90. */
export function formatTaxId(taxId: string | null | undefined) {
  if (!taxId) return ''
  return /^\d{10}$/.test(taxId) ? `${taxId.slice(0, 3)}-${taxId.slice(3, 6)}-${taxId.slice(6, 8)}-${taxId.slice(8)}` : taxId
}

/** Iloczyn dwóch liczb dziesiętnych z zaokrągleniem do `digits` miejsc, np. norma 1,5 h × 2 usługi = '3.000'. */
export function multiplyDecimals(a: string | number, b: string | number, digits: number) {
  const product = scaled(a, digits) * scaled(b, digits)
  const factor = 10n ** BigInt(digits)
  const n = (product * 2n + factor) / (2n * factor)
  const text = n.toString().padStart(digits + 1, '0')
  return digits ? `${text.slice(0, -digits)}.${text.slice(-digits)}` : text
}
