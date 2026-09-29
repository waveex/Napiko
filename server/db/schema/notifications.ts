/**
 * Powiadomienia (etap E6, push E8.5, status naprawy E5.6).
 * Migracja: netlify/database/migrations/20260929080000_notifications.
 *
 *  - notification – dzwonek w aplikacji (każdy widzi tylko swoje, powiadomić może każdy członek warsztatu),
 *  - notification_preference – e-mail / push dla typu zdarzenia (wiersz tylko, gdy ktoś zmienił ustawienie domyślne),
 *  - push_subscription – urządzenia członków zespołu z włączonym push (bez org_id: urządzenie należy do osoby),
 *  - customer_push_subscription – „zarejestrowany telefon” klienta: push zamiast SMS-a,
 *  - customer_notification – dziennik wiadomości do klienta (co, którym kanałem, z jakim skutkiem),
 *  - work_order_status_link – link do strony statusu naprawy (w bazie tylko skrót tokenu).
 */
import { relations, sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { organization, user } from './auth'
import { customer, workOrder } from './workshop'
import {
  CUSTOMER_CHANNELS, CUSTOMER_DELIVERIES, CUSTOMER_NOTIFICATION_EVENTS, CUSTOMER_NOTIFICATION_STATUSES, CUSTOMER_SKIP_REASONS,
  type TeamNotificationData,
} from '../../../shared/notifications'

export const notification = pgTable('notification', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  /** odbiorca – członek organizacji */
  userId: uuid('user_id').notNull(),
  type: text('type').notNull(),
  actorUserId: uuid('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
  workOrderId: uuid('work_order_id'),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  /** ścieżka w aplikacji, np. /app/orders/<id> */
  link: text('link'),
  data: jsonb('data').$type<TeamNotificationData>().notNull().default({}),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex('notification_org_id_uq').on(t.orgId, t.id),
  index('notification_recipient_idx').on(t.orgId, t.userId, t.createdAt),
  index('notification_unread_idx').on(t.orgId, t.userId).where(sql`${t.readAt} is null`),
  index('notification_entity_idx').on(t.entityId, t.type).where(sql`${t.entityId} is not null`),
  index('notification_created_idx').on(t.createdAt),
])

export const notificationPreference = pgTable('notification_preference', {
  orgId: uuid('org_id').notNull(),
  userId: uuid('user_id').notNull(),
  type: text('type').notNull(),
  email: boolean('email').notNull(),
  push: boolean('push').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.orgId, t.userId, t.type] })])

export const pushSubscription = pgTable('push_subscription', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique('push_subscription_endpoint_uq'),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, t => [index('push_subscription_user_idx').on(t.userId)])

export const customerPushSubscription = pgTable('customer_push_subscription', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull(),
  /** numer klienta w chwili włączenia – po zmianie numeru w karcie klienta wracamy do SMS-ów */
  phone: text('phone'),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, t => [
  uniqueIndex('customer_push_subscription_org_id_uq').on(t.orgId, t.id),
  uniqueIndex('customer_push_subscription_endpoint_uq').on(t.customerId, t.endpoint),
  index('customer_push_subscription_customer_idx').on(t.orgId, t.customerId),
])

export const customerNotification = pgTable('customer_notification', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  workOrderId: uuid('work_order_id').notNull(),
  customerId: uuid('customer_id').notNull(),
  approvalId: uuid('approval_id'),
  event: text('event', { enum: CUSTOMER_NOTIFICATION_EVENTS }).notNull(),
  /** kanał wybrany przez warsztat */
  channel: text('channel', { enum: CUSTOMER_CHANNELS }).notNull(),
  /** którędy faktycznie poszło (push, SMS, e-mail) */
  deliveredVia: text('delivered_via', { enum: CUSTOMER_DELIVERIES }),
  recipient: text('recipient'),
  status: text('status', { enum: CUSTOMER_NOTIFICATION_STATUSES }).notNull().default('queued'),
  skipReason: text('skip_reason', { enum: CUSTOMER_SKIP_REASONS }),
  trigger: text('trigger', { enum: ['auto', 'manual'] }).notNull(),
  sentBy: uuid('sent_by').references(() => user.id, { onDelete: 'set null' }),
  error: text('error'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  uniqueIndex('customer_notification_org_id_uq').on(t.orgId, t.id),
  index('customer_notification_order_idx').on(t.orgId, t.workOrderId, t.createdAt),
])

export const workOrderStatusLink = pgTable('work_order_status_link', {
  workOrderId: uuid('work_order_id').primaryKey(),
  orgId: uuid('org_id').notNull(),
  tokenHash: text('token_hash').notNull().unique('work_order_status_link_token_hash_uq'),
  /** zmiana wersji unieważnia poprzedni link */
  version: integer('version').notNull().default(1),
  firstViewedAt: timestamp('first_viewed_at', { withTimezone: true }),
  lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
  viewCount: integer('view_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const notificationRelations = relations(notification, ({ one }) => ({
  workOrder: one(workOrder, { fields: [notification.workOrderId], references: [workOrder.id] }),
  actor: one(user, { fields: [notification.actorUserId], references: [user.id] }),
}))

export const customerNotificationRelations = relations(customerNotification, ({ one }) => ({
  workOrder: one(workOrder, { fields: [customerNotification.workOrderId], references: [workOrder.id] }),
  customer: one(customer, { fields: [customerNotification.customerId], references: [customer.id] }),
}))
