/**
 * Rozliczenie zlecenia (etap E4): dane firmy, cennik usług i kosztorys.
 * Migracja: netlify/database/migrations/20260926190000_billing.
 * Kwoty trzymamy jako numeric (w kodzie: tekst), a liczymy w groszach – shared/workshop.ts: estimateLine().
 */
import { relations } from 'drizzle-orm'
import { index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { organization, user } from './auth'
import { workOrder } from './workshop'
import { workRequest } from './mechanic'
import { ESTIMATE_ITEM_KINDS, ESTIMATE_ITEM_SOURCES, SERVICE_PRICINGS } from '../../../shared/workshop'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

/** Dane firmy warsztatu (1:1 z organizacją) – nagłówek kosztorysów i dokumentów. */
export const companyProfile = pgTable('company_profile', {
  orgId: uuid('org_id').primaryKey().references(() => organization.id, { onDelete: 'cascade' }),
  legalName: text('legal_name'),
  taxId: text('tax_id'),
  street: text('street'),
  postalCode: text('postal_code'),
  city: text('city'),
  country: text('country').notNull().default('PL'),
  phone: text('phone'),
  email: text('email'),
  website: text('website'),
  bankAccount: text('bank_account'),
  laborRateNet: numeric('labor_rate_net', { precision: 12, scale: 2 }),
  defaultVatRate: numeric('default_vat_rate', { precision: 5, scale: 2 }).notNull().default('23'),
  documentFooter: text('document_footer'),
  ...timestamps,
})

/** Cennik: cena stała albo norma czasu mnożona przez stawkę roboczogodziny. */
export const servicePrice = pgTable('service_price', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  pricing: text('pricing', { enum: SERVICE_PRICINGS }).notNull().default('fixed'),
  priceNet: numeric('price_net', { precision: 12, scale: 2 }),
  laborHours: numeric('labor_hours', { precision: 6, scale: 2 }),
  vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).notNull().default('23'),
  createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
  ...timestamps,
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, t => [
  uniqueIndex('service_price_org_id_uq').on(t.orgId, t.id),
])

/** Pozycja kosztorysu zlecenia. */
export const estimateItem = pgTable('estimate_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  workOrderId: uuid('work_order_id').notNull(),
  kind: text('kind', { enum: ESTIMATE_ITEM_KINDS }).notNull().default('labor'),
  name: text('name').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull().default('1'),
  unit: text('unit').notNull().default('szt.'),
  unitPriceNet: numeric('unit_price_net', { precision: 12, scale: 2 }).notNull(),
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).notNull().default('23'),
  source: text('source', { enum: ESTIMATE_ITEM_SOURCES }).notNull().default('manual'),
  servicePriceId: uuid('service_price_id'),
  workRequestId: uuid('work_request_id'),
  position: integer('position').notNull().default(0),
  createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
  ...timestamps,
}, t => [
  uniqueIndex('estimate_item_org_id_uq').on(t.orgId, t.id),
  index('estimate_item_org_work_order_idx').on(t.orgId, t.workOrderId, t.position),
])

export const estimateItemRelations = relations(estimateItem, ({ one }) => ({
  workOrder: one(workOrder, { fields: [estimateItem.workOrderId], references: [workOrder.id] }),
  servicePrice: one(servicePrice, { fields: [estimateItem.servicePriceId], references: [servicePrice.id] }),
  workRequest: one(workRequest, { fields: [estimateItem.workRequestId], references: [workRequest.id] }),
}))
