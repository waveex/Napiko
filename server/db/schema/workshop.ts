/**
 * Rdzeń warsztatu: klienci, pojazdy, zlecenia, zadania i przypisania mechaników.
 * Migracja: netlify/database/migrations/20260926130000_workshop-core.
 * Klucze obce w bazie są złożone (org_id, id) – nie da się powiązać danych dwóch warsztatów.
 */
import { relations } from 'drizzle-orm'
import { boolean, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { organization, user } from './auth'
import { CUSTOMER_KINDS, METER_UNITS, TASK_STATUSES, VEHICLE_TYPES, WORK_ORDER_STATUSES } from '../../../shared/workshop'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const orgSequence = pgTable('org_sequence', {
  orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  period: integer('period').notNull(),
  value: integer('value').notNull(),
}, t => [primaryKey({ columns: [t.orgId, t.name, t.period] })])

export const customer = pgTable('customer', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: CUSTOMER_KINDS }).notNull().default('person'),
  name: text('name').notNull(),
  taxId: text('tax_id'),
  email: text('email'),
  phone: text('phone'),
  notes: text('notes'),
  /** Wiadomości o naprawie (transakcyjne): klient może zrezygnować z SMS-ów albo e-maili. */
  notifySms: boolean('notify_sms').notNull().default(true),
  notifyEmail: boolean('notify_email').notNull().default(true),
  clientUserId: uuid('client_user_id').references(() => user.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
  ...timestamps,
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, t => [
  uniqueIndex('customer_org_id_uq').on(t.orgId, t.id),
  index('customer_org_phone_idx').on(t.orgId, t.phone),
])

export const vehicle = pgTable('vehicle', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull(),
  type: text('type', { enum: VEHICLE_TYPES }).notNull().default('car'),
  make: text('make'),
  model: text('model'),
  year: integer('year'),
  registrationNumber: text('registration_number'),
  vin: text('vin'),
  serialNumber: text('serial_number'),
  meterUnit: text('meter_unit', { enum: METER_UNITS }).notNull().default('km'),
  meterValue: integer('meter_value'),
  attributes: jsonb('attributes').$type<Record<string, string>>().notNull().default({}),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
  ...timestamps,
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, t => [
  uniqueIndex('vehicle_org_id_uq').on(t.orgId, t.id),
  index('vehicle_org_customer_idx').on(t.orgId, t.customerId),
  index('vehicle_org_registration_idx').on(t.orgId, t.registrationNumber),
  index('vehicle_org_vin_idx').on(t.orgId, t.vin),
])

export const workOrder = pgTable('work_order', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  number: text('number').notNull(),
  customerId: uuid('customer_id').notNull(),
  vehicleId: uuid('vehicle_id').notNull(),
  status: text('status', { enum: WORK_ORDER_STATUSES }).notNull().default('received'),
  description: text('description'),
  meterValue: integer('meter_value'),
  promisedAt: timestamp('promised_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  /** Paragon z kasy fiskalnej (numer wpisany ręcznie – decyzja D4a; integracja z drukarką w v1.1). */
  receiptNumber: text('receipt_number'),
  receiptIssuedOn: date('receipt_issued_on', { mode: 'string' }),
  createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
  ...timestamps,
}, t => [
  uniqueIndex('work_order_org_id_uq').on(t.orgId, t.id),
  uniqueIndex('work_order_org_number_uq').on(t.orgId, t.number),
  index('work_order_org_status_idx').on(t.orgId, t.status),
  index('work_order_org_vehicle_idx').on(t.orgId, t.vehicleId),
  index('work_order_org_customer_idx').on(t.orgId, t.customerId),
])

export const task = pgTable('task', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  workOrderId: uuid('work_order_id').notNull(),
  parentId: uuid('parent_id'),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: TASK_STATUSES }).notNull().default('todo'),
  position: integer('position').notNull().default(0),
  estimatedMinutes: integer('estimated_minutes'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
  ...timestamps,
}, t => [
  uniqueIndex('task_org_id_uq').on(t.orgId, t.id),
  index('task_org_work_order_idx').on(t.orgId, t.workOrderId),
  index('task_parent_idx').on(t.parentId),
])

export const taskAssignment = pgTable('task_assignment', {
  orgId: uuid('org_id').notNull(),
  taskId: uuid('task_id').notNull(),
  userId: uuid('user_id').notNull(),
  assignedBy: uuid('assigned_by').references(() => user.id, { onDelete: 'set null' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.taskId, t.userId] }),
  index('task_assignment_org_user_idx').on(t.orgId, t.userId),
])

// ── relacje (do zapytań Drizzle; spójność pilnują złożone klucze obce w bazie) ──

export const customerRelations = relations(customer, ({ many }) => ({
  vehicles: many(vehicle),
  workOrders: many(workOrder),
}))

export const vehicleRelations = relations(vehicle, ({ one, many }) => ({
  customer: one(customer, { fields: [vehicle.customerId], references: [customer.id] }),
  workOrders: many(workOrder),
}))

export const workOrderRelations = relations(workOrder, ({ one, many }) => ({
  customer: one(customer, { fields: [workOrder.customerId], references: [customer.id] }),
  vehicle: one(vehicle, { fields: [workOrder.vehicleId], references: [vehicle.id] }),
  tasks: many(task),
}))

export const taskRelations = relations(task, ({ one, many }) => ({
  workOrder: one(workOrder, { fields: [task.workOrderId], references: [workOrder.id] }),
  parent: one(task, { fields: [task.parentId], references: [task.id], relationName: 'subtasks' }),
  subtasks: many(task, { relationName: 'subtasks' }),
  assignments: many(taskAssignment),
}))

export const taskAssignmentRelations = relations(taskAssignment, ({ one }) => ({
  task: one(task, { fields: [taskAssignment.taskId], references: [task.id] }),
  user: one(user, { fields: [taskAssignment.userId], references: [user.id] }),
}))
