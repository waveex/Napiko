/**
 * Rozliczenie zlecenia (E4): izolacja warsztatów, spójność kosztorysu, reguły w bazie
 * oraz rachunek na groszach i walidacja NIP / rachunku.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import {
  approvalRequest, companyProfile, customer, estimateItem, servicePrice, vehicle, workOrder, workRequest,
  type EstimateSnapshot,
} from '../../server/db/schema'
import { withTenant } from '../../server/db/tenant'
import {
  estimateLine, estimateTotals, formatIban, formatTaxId, isValidIban, isValidNip, isValidTaxId, multiplyDecimals,
  normalizeIban, normalizeTaxId, scaled,
} from '../../shared/workshop'
import { companyProfileSchema, servicePriceSchema } from '../../shared/schemas'
import { createMemberWithOrg, createTestDb, pgErrorMessage } from '../helpers'

const { db, pool } = createTestDb()
type Ctx = { userId: string, orgId: string }
let a: Ctx
let b: Ctx

async function seed(ctx: Ctx, number: string) {
  return withTenant(db, ctx, async (tx) => {
    const [c] = await tx.insert(customer).values({ orgId: ctx.orgId, name: 'Klient' }).returning()
    const [v] = await tx.insert(vehicle).values({ orgId: ctx.orgId, customerId: c!.id, type: 'car' }).returning()
    const [o] = await tx.insert(workOrder).values({ orgId: ctx.orgId, number, customerId: c!.id, vehicleId: v!.id }).returning()
    const [r] = await tx.insert(workRequest).values({ orgId: ctx.orgId, workOrderId: o!.id, title: 'Klocki tył', status: 'quoted', laborNet: '100.00', partsNet: '80.00' }).returning()
    return { order: o!, request: r! }
  })
}

let a1: Awaited<ReturnType<typeof seed>>
let a2: Awaited<ReturnType<typeof seed>>
let b1: Awaited<ReturnType<typeof seed>>

beforeAll(async () => {
  a = await createMemberWithOrg(db)
  b = await createMemberWithOrg(db)
  a1 = await seed(a, 'ZL/A/1')
  a2 = await seed(a, 'ZL/A/2')
  b1 = await seed(b, 'ZL/B/1')
})

afterAll(async () => {
  await pool.end()
})

const item = (ctx: Ctx, workOrderId: string, extra: Partial<typeof estimateItem.$inferInsert> = {}) => ({
  orgId: ctx.orgId,
  workOrderId,
  name: 'Wymiana klocków',
  unitPriceNet: '150.00',
  ...extra,
})

describe('rachunek kosztorysu (grosze, bez błędów zaokrągleń)', () => {
  it('liczy netto, VAT i brutto pozycji', () => {
    expect(estimateLine({ quantity: '1.500', unitPriceNet: '150.00', discountPercent: '0', vatRate: '23' }))
      .toEqual({ netCents: 22500, vatCents: 5175, grossCents: 27675 })
    // 3 × 33,33 zł z rabatem 10% = 89,991 → 89,99 zł
    expect(estimateLine({ quantity: 3, unitPriceNet: 33.33, discountPercent: 10, vatRate: 8 }))
      .toEqual({ netCents: 8999, vatCents: 720, grossCents: 9719 })
    // połówka grosza zaokrąglana w górę: 0,05 zł × 23% = 1,15 gr → 1 gr; 0,50 zł × 23% = 11,5 gr → 12 gr
    expect(estimateLine({ quantity: 1, unitPriceNet: '0.05', discountPercent: 0, vatRate: 23 }).vatCents).toBe(1)
    expect(estimateLine({ quantity: 1, unitPriceNet: '0.50', discountPercent: 0, vatRate: 23 }).vatCents).toBe(12)
    expect(estimateLine({ quantity: '0.001', unitPriceNet: '0.01', discountPercent: 0, vatRate: 0 }).netCents).toBe(0)
  })

  it('sumuje pozycje i zestawia je według stawek VAT', () => {
    const lines = [
      { vatRate: '23.00', ...estimateLine({ quantity: 1, unitPriceNet: 100, discountPercent: 0, vatRate: 23 }) },
      { vatRate: '8.00', ...estimateLine({ quantity: 2, unitPriceNet: 10, discountPercent: 0, vatRate: 8 }) },
      { vatRate: '23', ...estimateLine({ quantity: 1, unitPriceNet: 50, discountPercent: 0, vatRate: 23 }) },
    ]
    const totals = estimateTotals(lines)
    expect(totals.netCents).toBe(17000)
    expect(totals.grossCents).toBe(totals.netCents + totals.vatCents)
    expect(totals.byRate.map(r => r.vatRate)).toEqual(['23', '8'])
    expect(totals.byRate[0]).toMatchObject({ netCents: 15000, vatCents: 3450 })
  })

  it('mnoży liczby dziesiętne dokładnie (norma czasu × liczba usług)', () => {
    expect(multiplyDecimals('1.50', 2, 3)).toBe('3.000')
    expect(multiplyDecimals('0.15', 3, 3)).toBe('0.450')
    expect(multiplyDecimals('0.25', '0.5', 3)).toBe('0.125')
    expect(scaled('12.345', 2)).toBe(1235n)
  })
})

describe('walidacja danych firmy', () => {
  it('sprawdza sumę kontrolną NIP i normalizuje zapis', () => {
    expect(isValidNip('1234563218')).toBe(true)
    expect(isValidNip('1234563219')).toBe(false)
    expect(normalizeTaxId('PL 123-456-32-18')).toBe('1234563218')
    expect(formatTaxId('1234563218')).toBe('123-456-32-18')
    expect(isValidTaxId('DE123456789')).toBe(true)
    expect(isValidTaxId('PL12')).toBe(false)
  })

  it('sprawdza numer rachunku (IBAN, także zapisany jako 26 cyfr)', () => {
    const nrb = '61 1090 1014 0000 0712 1981 2874'
    expect(normalizeIban(nrb)).toBe('PL61109010140000071219812874')
    expect(isValidIban(normalizeIban(nrb)!)).toBe(true)
    expect(isValidIban('PL61109010140000071219812875')).toBe(false)
    expect(formatIban('PL61109010140000071219812874')).toBe('PL61 1090 1014 0000 0712 1981 2874')
  })

  it('schemat formularza odrzuca błędny NIP, rachunek i kod pocztowy', () => {
    const base = { legalName: 'Auto-Serwis', taxId: null, street: null, postalCode: null, city: null, phone: null, email: null, website: null, bankAccount: null, laborRateNet: 150, defaultVatRate: 23, documentFooter: null }
    expect(companyProfileSchema.safeParse({ ...base, taxId: '123-456-32-18' }).success).toBe(true)
    expect(companyProfileSchema.safeParse({ ...base, taxId: '123-456-32-19' }).success).toBe(false)
    expect(companyProfileSchema.safeParse({ ...base, bankAccount: '61109010140000071219812875' }).success).toBe(false)
    expect(companyProfileSchema.safeParse({ ...base, postalCode: '15001' }).success).toBe(false)
    expect(companyProfileSchema.safeParse({ ...base, postalCode: '15-001' }).success).toBe(true)
  })

  it('usługa w cenniku ma cenę albo normę czasu – zależnie od sposobu liczenia', () => {
    const base = { name: 'Wymiana oleju', description: null, category: null, vatRate: 23 }
    expect(servicePriceSchema.safeParse({ ...base, pricing: 'fixed', priceNet: null, laborHours: 1 }).success).toBe(false)
    expect(servicePriceSchema.safeParse({ ...base, pricing: 'hourly', priceNet: 100, laborHours: null }).success).toBe(false)
    expect(servicePriceSchema.safeParse({ ...base, pricing: 'hourly', priceNet: null, laborHours: 1.5 }).success).toBe(true)
  })
})

describe('izolacja warsztatów (RLS)', () => {
  it('dane firmy, cennik i kosztorys są widoczne tylko we własnym warsztacie', async () => {
    await withTenant(db, a, async (tx) => {
      await tx.insert(companyProfile).values({ orgId: a.orgId, legalName: 'Warsztat A', laborRateNet: '150.00' })
      await tx.insert(servicePrice).values({ orgId: a.orgId, name: 'Diagnostyka', pricing: 'fixed', priceNet: '100.00' })
      await tx.insert(estimateItem).values(item(a, a1.order.id))
    })
    const seen = await withTenant(db, b, async tx => ({
      profiles: await tx.select().from(companyProfile),
      prices: await tx.select().from(servicePrice),
      items: await tx.select().from(estimateItem),
    }))
    expect(seen.profiles).toHaveLength(0)
    expect(seen.prices).toHaveLength(0)
    expect(seen.items).toHaveLength(0)
  })

  it('warsztat nie zapisze danych innego warsztatu', async () => {
    const message = await pgErrorMessage(withTenant(db, b, tx => tx.insert(companyProfile).values({ orgId: a.orgId, legalName: 'Podszywka' })))
    expect(message).toMatch(/row-level security/)
  })
})

describe('spójność kosztorysu', () => {
  it('pozycja nie może wskazywać zlecenia innego warsztatu', async () => {
    const message = await pgErrorMessage(withTenant(db, a, tx => tx.insert(estimateItem).values(item(a, b1.order.id))))
    expect(message).toMatch(/foreign key|violates/)
  })

  it('pozycja z wyceny musi pochodzić z tego samego zlecenia', async () => {
    const message = await pgErrorMessage(withTenant(db, a, tx =>
      tx.insert(estimateItem).values(item(a, a2.order.id, { workRequestId: a1.request.id, source: 'work_request' }))))
    expect(message).toMatch(/tego samego zlecenia/)
  })

  it('zatwierdzona wycena trafia do kosztorysu raz (osobno robocizna i części)', async () => {
    await withTenant(db, a, async (tx) => {
      await tx.insert(estimateItem).values(item(a, a1.order.id, { workRequestId: a1.request.id, source: 'work_request', kind: 'labor' }))
      await tx.insert(estimateItem).values(item(a, a1.order.id, { workRequestId: a1.request.id, source: 'work_request', kind: 'part' }))
    })
    const message = await pgErrorMessage(withTenant(db, a, tx =>
      tx.insert(estimateItem).values(item(a, a1.order.id, { workRequestId: a1.request.id, source: 'work_request', kind: 'labor' }))))
    expect(message).toMatch(/estimate_item_request_kind_uq/)
  })

  it('odrzuca zerową ilość, ujemną cenę i rabat powyżej 100%', async () => {
    for (const bad of [{ quantity: '0' }, { unitPriceNet: '-1.00' }, { discountPercent: '101' }]) {
      const message = await pgErrorMessage(withTenant(db, a, tx => tx.insert(estimateItem).values(item(a, a1.order.id, bad))))
      expect(message).toMatch(/check constraint/)
    }
  })

  it('usunięcie zgłoszenia zostawia pozycję w kosztorysie (bez powiązania)', async () => {
    const r = await withTenant(db, a, async (tx) => {
      const [request] = await tx.insert(workRequest).values({ orgId: a.orgId, workOrderId: a2.order.id, title: 'Tarcze', status: 'quoted', partsNet: '200.00' }).returning()
      const [line] = await tx.insert(estimateItem).values(item(a, a2.order.id, { workRequestId: request!.id, source: 'work_request', kind: 'part' })).returning()
      await tx.delete(workRequest).where(eq(workRequest.id, request!.id))
      return (await tx.select().from(estimateItem).where(eq(estimateItem.id, line!.id)))[0]
    })
    expect(r?.workRequestId).toBeNull()
    expect(r?.orgId).toBe(a.orgId)
  })
})

describe('cennik', () => {
  it('nazwa usługi nie powtarza się w aktywnym cenniku (bez względu na wielkość liter)', async () => {
    await withTenant(db, a, tx => tx.insert(servicePrice).values({ orgId: a.orgId, name: 'Wymiana oleju', pricing: 'hourly', laborHours: '0.50' }))
    const message = await pgErrorMessage(withTenant(db, a, tx =>
      tx.insert(servicePrice).values({ orgId: a.orgId, name: 'WYMIANA OLEJU', pricing: 'fixed', priceNet: '80.00' })))
    expect(message).toMatch(/service_price_org_name_uq/)
    // po usunięciu z cennika nazwa jest znów wolna; inny warsztat może mieć taką samą
    await withTenant(db, a, tx => tx.update(servicePrice).set({ archivedAt: new Date() })
      .where(and(eq(servicePrice.orgId, a.orgId), eq(servicePrice.name, 'Wymiana oleju'))))
    await withTenant(db, a, tx => tx.insert(servicePrice).values({ orgId: a.orgId, name: 'wymiana oleju', pricing: 'fixed', priceNet: '80.00' }))
    await withTenant(db, b, tx => tx.insert(servicePrice).values({ orgId: b.orgId, name: 'Wymiana oleju', pricing: 'fixed', priceNet: '90.00' }))
  })

  it('cena stała wymaga ceny, norma czasu – liczby godzin', async () => {
    const fixed = await pgErrorMessage(withTenant(db, a, tx => tx.insert(servicePrice).values({ orgId: a.orgId, name: 'Bez ceny', pricing: 'fixed' })))
    expect(fixed).toMatch(/service_price_pricing_check/)
    const hourly = await pgErrorMessage(withTenant(db, a, tx => tx.insert(servicePrice).values({ orgId: a.orgId, name: 'Bez normy', pricing: 'hourly', laborHours: '0' })))
    expect(hourly).toMatch(/service_price_pricing_check/)
  })
})

describe('akceptacja kosztorysu i paragon', () => {
  const snapshot: EstimateSnapshot = {
    version: 1,
    kind: 'estimate',
    organization: { name: 'A', legalName: null, taxId: null, address: null, phone: null, email: null },
    order: { number: 'ZL/A/1' },
    vehicle: { type: 'car', make: null, model: null, registrationNumber: null },
    message: null,
    currency: 'PLN',
    lines: [],
    totals: { netCents: 0, vatCents: 0, grossCents: 0, byRate: [] },
    totalGrossCents: 0,
    estimateHash: 'x',
    footer: null,
    createdAt: new Date().toISOString(),
  }
  const base = (tokenHash: string) => ({
    orgId: a.orgId,
    workOrderId: a1.order.id,
    tokenHash,
    channel: 'link' as const,
    snapshot,
    snapshotHash: 'x',
    expiresAt: new Date(Date.now() + 3600_000),
  })

  it('decyzję o całości zapisujemy tylko przy kosztorysie i tylko po odpowiedzi', async () => {
    const onRequests = await pgErrorMessage(withTenant(db, a, tx =>
      tx.insert(approvalRequest).values({ ...base('est-1'), kind: 'work_requests', decision: 'approved' })))
    expect(onRequests).toMatch(/approval_request_decision_check/)
    const pendingWithDecision = await pgErrorMessage(withTenant(db, a, tx =>
      tx.insert(approvalRequest).values({ ...base('est-2'), kind: 'estimate', decision: 'approved' })))
    expect(pendingWithDecision).toMatch(/approval_request_decision_check/)
    const answeredWithout = await pgErrorMessage(withTenant(db, a, tx =>
      tx.insert(approvalRequest).values({ ...base('est-3'), kind: 'estimate', status: 'answered', answeredAt: new Date() })))
    expect(answeredWithout).toMatch(/approval_request_decision_check/)
    await withTenant(db, a, tx =>
      tx.insert(approvalRequest).values({ ...base('est-4'), kind: 'estimate', status: 'answered', answeredAt: new Date(), decision: 'rejected' }))
  })

  it('data paragonu wymaga jego numeru', async () => {
    const message = await pgErrorMessage(withTenant(db, a, tx =>
      tx.update(workOrder).set({ receiptIssuedOn: '2026-09-26' }).where(eq(workOrder.id, a1.order.id))))
    expect(message).toMatch(/work_order_receipt_check/)
    await withTenant(db, a, tx =>
      tx.update(workOrder).set({ receiptNumber: '0123/2026', receiptIssuedOn: '2026-09-26' }).where(eq(workOrder.id, a1.order.id)))
  })
})
