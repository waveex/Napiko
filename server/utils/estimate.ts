/**
 * Kosztorys zlecenia: odczyt z sumami, skrót wersji, pozycje z zatwierdzonych wycen i dane firmy.
 * Kwoty liczymy w groszach wspólną funkcją estimateLine() (ta sama w aplikacji i na serwerze).
 */
import { createHash } from 'node:crypto'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import type { Tx } from '../db/client'
import { recordAudit } from '../db/audit'
import { approvalRequest, companyProfile, estimateItem, organization } from '../db/schema'
import type { EstimateSnapshot } from '../db/schema'
import { estimateLine, estimateTotals, formatTaxId } from '../../shared/workshop'
import type { Actor, RequestMeta } from './task-status'

export type EstimateItemRow = typeof estimateItem.$inferSelect

/** Skrót pozycji kosztorysu – zmienia się przy każdej zmianie ceny, ilości, rabatu, VAT albo nazwy. */
export function estimateHash(items: EstimateItemRow[]) {
  const canonical = items.map(i => [i.id, i.kind, i.name, i.quantity, i.unit, i.unitPriceNet, i.discountPercent, i.vatRate])
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

export async function loadEstimateItems(tx: Tx, workOrderId: string) {
  return tx.select().from(estimateItem)
    .where(eq(estimateItem.workOrderId, workOrderId))
    .orderBy(asc(estimateItem.position), asc(estimateItem.createdAt))
}

/** Kosztorys z wartościami pozycji, sumami i stanem ostatniej akceptacji klienta. */
export async function loadEstimate(tx: Tx, workOrderId: string) {
  const items = await loadEstimateItems(tx, workOrderId)
  const lines = items.map(item => ({ ...item, ...estimateLine(item) }))
  const hash = estimateHash(items)

  // Ostatnia wysłana (niewycofana) prośba o akceptację kosztorysu
  const [last] = await tx
    .select({
      id: approvalRequest.id,
      status: approvalRequest.status,
      decision: approvalRequest.decision,
      expiresAt: approvalRequest.expiresAt,
      answeredAt: approvalRequest.answeredAt,
      customerNote: approvalRequest.customerNote,
      createdAt: approvalRequest.createdAt,
      estimateHash: sql<string>`${approvalRequest.snapshot}->>'estimateHash'`,
      totalGrossCents: sql<number>`(${approvalRequest.snapshot}->>'totalGrossCents')::int`,
    })
    .from(approvalRequest)
    .where(and(eq(approvalRequest.workOrderId, workOrderId), eq(approvalRequest.kind, 'estimate'), sql`${approvalRequest.status} <> 'cancelled'`))
    .orderBy(desc(approvalRequest.createdAt))
    .limit(1)

  return {
    items: lines,
    totals: estimateTotals(lines),
    hash,
    approval: last
      ? {
          ...last,
          expired: last.status === 'pending' && last.expiresAt.getTime() < Date.now(),
          /** kosztorys zmieniono po wysłaniu – klient zaakceptował (albo ogląda) inną wersję */
          outdated: last.estimateHash !== hash,
        }
      : null,
  }
}

export async function nextEstimatePosition(tx: Tx, workOrderId: string) {
  const [row] = await tx
    .select({ next: sql<number>`coalesce(max(${estimateItem.position}) + 1, 0)::int` })
    .from(estimateItem)
    .where(eq(estimateItem.workOrderId, workOrderId))
  return row?.next ?? 0
}

export interface QuotedRequest {
  id: string
  workOrderId: string
  kind: 'part' | 'extra_work'
  title: string
  partsNet: string | null
  laborNet: string | null
  vatRate: string
}

/**
 * Zatwierdzona wycena (przez biuro albo klienta) trafia do kosztorysu: robocizna i części jako osobne pozycje.
 * Drugi raz tej samej wyceny nie dodajemy (unikalny indeks work_request_id + rodzaj pozycji).
 */
export async function addRequestToEstimate(tx: Tx, actor: Actor, request: QuotedRequest, orderNumber: string, meta: RequestMeta) {
  const labor = Number(request.laborNet ?? 0) > 0
  const parts = Number(request.partsNet ?? 0) > 0
  if (!labor && !parts) return 0

  const existing = await tx.select({ kind: estimateItem.kind }).from(estimateItem)
    .where(eq(estimateItem.workRequestId, request.id))
  const has = new Set(existing.map(e => e.kind))
  const both = labor && parts
  const start = await nextEstimatePosition(tx, request.workOrderId)
  const rows: (typeof estimateItem.$inferInsert)[] = []
  if (labor && !has.has('labor')) {
    rows.push({
      orgId: actor.orgId,
      workOrderId: request.workOrderId,
      kind: 'labor',
      name: both ? `${request.title} – robocizna` : request.title,
      quantity: '1',
      unit: 'usł.',
      unitPriceNet: request.laborNet!,
      vatRate: request.vatRate,
      source: 'work_request',
      workRequestId: request.id,
      position: start + rows.length,
      createdBy: actor.userId,
    })
  }
  if (parts && !has.has('part')) {
    rows.push({
      orgId: actor.orgId,
      workOrderId: request.workOrderId,
      kind: 'part',
      name: both ? `${request.title} – części` : request.title,
      quantity: '1',
      unit: 'kpl.',
      unitPriceNet: request.partsNet!,
      vatRate: request.vatRate,
      source: 'work_request',
      workRequestId: request.id,
      position: start + rows.length,
      createdBy: actor.userId,
    })
  }
  if (!rows.length) return 0
  await tx.insert(estimateItem).values(rows)
  await recordAudit(tx, {
    orgId: actor.orgId,
    actorUserId: actor.userId,
    action: 'estimate.items_added',
    entityType: 'work_order',
    entityId: request.workOrderId,
    data: { number: orderNumber, fromRequest: request.id, names: rows.map(r => r.name) },
    ...meta,
  })
  return rows.length
}

/** Dane firmy; gdy warsztat ich nie uzupełnił – nazwa organizacji i domyślny VAT 23%. */
export async function loadCompanyProfile(tx: Tx, orgId: string) {
  const [row] = await tx.select().from(companyProfile).where(eq(companyProfile.orgId, orgId)).limit(1)
  if (row) return { ...row, saved: true }
  const [org] = await tx.select({ name: organization.name }).from(organization).where(eq(organization.id, orgId)).limit(1)
  return {
    orgId,
    legalName: org?.name ?? null,
    taxId: null,
    street: null,
    postalCode: null,
    city: null,
    country: 'PL',
    phone: null,
    email: null,
    website: null,
    bankAccount: null,
    laborRateNet: null,
    defaultVatRate: '23',
    documentFooter: null,
    createdAt: null,
    updatedAt: null,
    saved: false,
  }
}

/** Adres w jednej linii: „ul. Polna 1, 15-001 Białystok”. */
export function formatAddress(profile: { street: string | null, postalCode: string | null, city: string | null, country: string }) {
  const place = [profile.postalCode, profile.city].filter(Boolean).join(' ')
  const parts = [profile.street, place, profile.country !== 'PL' ? profile.country : null].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

/** Nagłówek kosztorysu wysyłanego klientowi. */
export function snapshotOrganization(name: string, profile: Awaited<ReturnType<typeof loadCompanyProfile>>): EstimateSnapshot['organization'] {
  return {
    name,
    legalName: profile.legalName,
    taxId: profile.taxId ? formatTaxId(profile.taxId) : null,
    address: formatAddress(profile),
    phone: profile.phone,
    email: profile.email,
  }
}

/** Wartości kolumn cennika z formularza (kwoty jako tekst z dwoma miejscami po przecinku). */
export function servicePriceValues(input: {
  name: string
  description: string | null
  category: string | null
  pricing: 'fixed' | 'hourly'
  priceNet: number | null
  laborHours: number | null
  vatRate: number
}) {
  return {
    name: input.name,
    description: input.description,
    category: input.category,
    pricing: input.pricing,
    priceNet: input.pricing === 'fixed' && input.priceNet !== null ? input.priceNet.toFixed(2) : null,
    laborHours: input.pricing === 'hourly' && input.laborHours !== null ? input.laborHours.toFixed(2) : null,
    vatRate: input.vatRate.toFixed(2),
  }
}

/** Powtórzona nazwa w aktywnym cenniku → czytelny komunikat zamiast błędu bazy. */
export function priceNameConflict(error: unknown) {
  if (isUniqueViolation(error)) {
    return createError({ statusCode: 409, statusMessage: 'Conflict', message: 'Usługa o tej nazwie jest już w cenniku.' })
  }
  return error
}

/** Kwota w groszach → „1 234,56 zł” (e-mail, SMS). */
export function formatPln(cents: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(cents / 100)
}
