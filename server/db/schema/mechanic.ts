/**
 * Praca mechanika: czas pracy nad zadaniami, zgłoszone potrzeby i załączniki zleceń.
 * Migracja: netlify/database/migrations/20260926150000_mechanic-work.
 */
import { relations, sql } from 'drizzle-orm'
import { boolean, index, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { organization, user } from './auth'
import { fileObject } from './platform'
import { task, workOrder } from './workshop'
import { WORK_REQUEST_KINDS, WORK_REQUEST_STATUSES, WORK_REQUEST_URGENCIES } from '../../../shared/workshop'

export const timeEntry = pgTable('time_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').notNull(),
  /** Uzupełnia wyzwalacz na podstawie zadania – przy wstawianiu wystarczy dowolna wartość. */
  workOrderId: uuid('work_order_id').notNull(),
  userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex('time_entry_org_id_uq').on(t.orgId, t.id),
  uniqueIndex('time_entry_one_running_uq').on(t.orgId, t.userId).where(sql`${t.endedAt} is null`),
  index('time_entry_org_task_idx').on(t.orgId, t.taskId),
  index('time_entry_org_work_order_idx').on(t.orgId, t.workOrderId),
  index('time_entry_org_user_started_idx').on(t.orgId, t.userId, t.startedAt),
])

export const workRequest = pgTable('work_request', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  workOrderId: uuid('work_order_id').notNull(),
  taskId: uuid('task_id'),
  kind: text('kind', { enum: WORK_REQUEST_KINDS }).notNull().default('extra_work'),
  title: text('title').notNull(),
  description: text('description'),
  urgency: text('urgency', { enum: WORK_REQUEST_URGENCIES }).notNull().default('recommended'),
  status: text('status', { enum: WORK_REQUEST_STATUSES }).notNull().default('open'),
  partsNet: numeric('parts_net', { precision: 12, scale: 2 }),
  laborNet: numeric('labor_net', { precision: 12, scale: 2 }),
  vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).notNull().default('23'),
  officeNote: text('office_note'),
  decisionNote: text('decision_note'),
  reportedBy: uuid('reported_by').references(() => user.id, { onDelete: 'set null' }),
  quotedBy: uuid('quoted_by').references(() => user.id, { onDelete: 'set null' }),
  quotedAt: timestamp('quoted_at', { withTimezone: true }),
  decidedBy: uuid('decided_by').references(() => user.id, { onDelete: 'set null' }),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdTaskId: uuid('created_task_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex('work_request_org_id_uq').on(t.orgId, t.id),
  index('work_request_org_work_order_idx').on(t.orgId, t.workOrderId),
  index('work_request_org_status_idx').on(t.orgId, t.status),
])

export const workOrderAttachment = pgTable('work_order_attachment', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  workOrderId: uuid('work_order_id').notNull(),
  taskId: uuid('task_id'),
  workRequestId: uuid('work_request_id'),
  fileId: uuid('file_id').notNull().unique('work_order_attachment_file_uq'),
  caption: text('caption'),
  customerVisible: boolean('customer_visible').notNull().default(false),
  createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex('work_order_attachment_org_id_uq').on(t.orgId, t.id),
  index('work_order_attachment_org_work_order_idx').on(t.orgId, t.workOrderId),
])

export const timeEntryRelations = relations(timeEntry, ({ one }) => ({
  task: one(task, { fields: [timeEntry.taskId], references: [task.id] }),
  workOrder: one(workOrder, { fields: [timeEntry.workOrderId], references: [workOrder.id] }),
  user: one(user, { fields: [timeEntry.userId], references: [user.id] }),
}))

export const workRequestRelations = relations(workRequest, ({ one }) => ({
  workOrder: one(workOrder, { fields: [workRequest.workOrderId], references: [workOrder.id] }),
  task: one(task, { fields: [workRequest.taskId], references: [task.id] }),
}))

export const workOrderAttachmentRelations = relations(workOrderAttachment, ({ one }) => ({
  workOrder: one(workOrder, { fields: [workOrderAttachment.workOrderId], references: [workOrder.id] }),
  file: one(fileObject, { fields: [workOrderAttachment.fileId], references: [fileObject.id] }),
}))

// ── akceptacje klienta (migracja 20260926170000_customer-approvals) ──

export const APPROVAL_STATUSES = ['pending', 'answered', 'cancelled'] as const
export const APPROVAL_CHANNELS = ['link', 'email', 'sms'] as const
export const APPROVAL_DECISIONS = ['approved', 'rejected'] as const
/** work_requests – zgoda na wycenione prace dodatkowe (decyzja przy każdej pozycji), estimate – akceptacja kosztorysu (jedna decyzja). */
export const APPROVAL_KINDS = ['work_requests', 'estimate'] as const

/** Treść pokazana klientowi – zapisana w chwili wysyłki (dowód, na co klient się zgodził). */
export interface ApprovalSnapshot {
  version: 1
  /** brak pola w prośbach sprzed etapu E4 */
  kind?: 'work_requests'
  organization: { name: string }
  order: { number: string }
  vehicle: { type: string, make: string | null, model: string | null, registrationNumber: string | null }
  message: string | null
  currency: 'PLN'
  items: {
    requestId: string
    title: string
    description: string | null
    kind: string
    urgency: string
    partsNet: string | null
    laborNet: string | null
    vatRate: string
    grossCents: number
    attachmentIds: string[]
  }[]
  totalGrossCents: number
  createdAt: string
}

/** Pozycja kosztorysu w treści pokazanej klientowi (kwoty w groszach, policzone przy wysyłce). */
export interface EstimateSnapshotLine {
  id: string
  kind: 'labor' | 'part' | 'other'
  name: string
  quantity: string
  unit: string
  unitPriceNet: string
  discountPercent: string
  vatRate: string
  netCents: number
  vatCents: number
  grossCents: number
}

/** Kosztorys wysłany klientowi do akceptacji. */
export interface EstimateSnapshot {
  version: 1
  kind: 'estimate'
  organization: {
    name: string
    legalName: string | null
    taxId: string | null
    address: string | null
    phone: string | null
    email: string | null
  }
  order: { number: string }
  vehicle: { type: string, make: string | null, model: string | null, registrationNumber: string | null }
  message: string | null
  currency: 'PLN'
  lines: EstimateSnapshotLine[]
  totals: {
    netCents: number
    vatCents: number
    grossCents: number
    byRate: { vatRate: string, netCents: number, vatCents: number, grossCents: number }[]
  }
  /** ten sam kształt co w prośbach o prace dodatkowe – lista zleceń pokazuje kwotę bez rozróżniania rodzaju */
  totalGrossCents: number
  /** skrót pozycji kosztorysu – po zmianie kosztorysu widać, że zaakceptowana wersja jest nieaktualna */
  estimateHash: string
  footer: string | null
  createdAt: string
}

export type AnyApprovalSnapshot = ApprovalSnapshot | EstimateSnapshot

export function isEstimateSnapshot(snapshot: AnyApprovalSnapshot): snapshot is EstimateSnapshot {
  return snapshot.kind === 'estimate'
}

export const approvalRequest = pgTable('approval_request', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  workOrderId: uuid('work_order_id').notNull(),
  tokenHash: text('token_hash').notNull().unique('approval_request_token_hash_uq'),
  kind: text('kind', { enum: APPROVAL_KINDS }).notNull().default('work_requests'),
  status: text('status', { enum: APPROVAL_STATUSES }).notNull().default('pending'),
  /** tylko kosztorys: decyzja klienta o całości */
  decision: text('decision', { enum: APPROVAL_DECISIONS }),
  channel: text('channel', { enum: APPROVAL_CHANNELS }).notNull(),
  recipient: text('recipient'),
  snapshot: jsonb('snapshot').$type<AnyApprovalSnapshot>().notNull(),
  snapshotHash: text('snapshot_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  sentBy: uuid('sent_by').references(() => user.id, { onDelete: 'set null' }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  answerIp: text('answer_ip'),
  answerUserAgent: text('answer_user_agent'),
  customerNote: text('customer_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex('approval_request_org_id_uq').on(t.orgId, t.id),
  index('approval_request_org_work_order_idx').on(t.orgId, t.workOrderId),
])

export const approvalItem = pgTable('approval_item', {
  orgId: uuid('org_id').notNull(),
  approvalId: uuid('approval_id').notNull(),
  workRequestId: uuid('work_request_id').notNull(),
  decision: text('decision', { enum: APPROVAL_DECISIONS }),
}, t => [
  primaryKey({ columns: [t.approvalId, t.workRequestId] }),
  index('approval_item_org_request_idx').on(t.orgId, t.workRequestId),
])
