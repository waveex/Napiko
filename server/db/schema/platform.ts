/**
 * Tabele platformy (wspólne dla wszystkich modułów):
 * ustawienia warsztatu, pliki, dziennik zdarzeń (audyt) i kolejka zadań.
 *
 * Każda tabela z org_id jest chroniona przez Row Level Security (RLS) – szczegóły
 * w migracji netlify/database/migrations/*_platform-core.sql i w docs/03-architektura-i-infrastruktura.md.
 * Tabele modułów biznesowych (klienci, pojazdy, zlecenia) dojdą po zatwierdzeniu SRS.
 */
import { sql } from 'drizzle-orm'
import { bigint, bigserial, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { organization, user } from './auth'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const ASSIGNMENT_POLICIES = ['office', 'self', 'mixed'] as const
export type AssignmentPolicy = (typeof ASSIGNMENT_POLICIES)[number]

/** Ustawienia organizacji (1:1 z organization). */
export const organizationSettings = pgTable('organization_settings', {
  orgId: uuid('org_id').primaryKey().references(() => organization.id, { onDelete: 'cascade' }),
  /** Kto przydziela zadania: biuro, sam mechanik czy oba tryby. */
  assignmentPolicy: text('assignment_policy', { enum: ASSIGNMENT_POLICIES }).notNull().default('office'),
  /** Nazwa nadawcy SMS (nadpis) – wymaga rejestracji w bramce SMS. */
  smsSenderName: text('sms_sender_name'),
  timezone: text('timezone').notNull().default('Europe/Warsaw'),
  locale: text('locale').notNull().default('pl'),
  logoFileId: uuid('logo_file_id'),
  ...timestamps,
})

export const FILE_PURPOSES = ['logo', 'attachment'] as const
export const FILE_STATUSES = ['pending', 'uploaded', 'deleted'] as const

/** Metadane plików w magazynie S3 (same pliki trafiają tam bezpośrednio z przeglądarki). */
export const fileObject = pgTable('file_object', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  uploadedBy: uuid('uploaded_by').references(() => user.id, { onDelete: 'set null' }),
  storageKey: text('storage_key').notNull().unique(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  purpose: text('purpose', { enum: FILE_PURPOSES }).notNull(),
  status: text('status', { enum: FILE_STATUSES }).notNull().default('pending'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
  ...timestamps,
}, t => [index('file_object_org_created_idx').on(t.orgId, t.createdAt)])

/**
 * Dziennik zdarzeń: tylko dopisywanie (UPDATE/DELETE blokuje wyzwalacz),
 * każdy wpis zawiera skrót poprzedniego (łańcuch hashy per organizacja).
 * Brak klucza obcego do organization celowo: wpisy przeżywają zmiany w organizacji,
 * a ich usuwanie odbywa się wyłącznie przez procedurę retencji.
 */
export const auditEvent = pgTable('audit_event', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  orgId: uuid('org_id').notNull(),
  /** Numer kolejny w obrębie organizacji – nadaje go wyzwalacz. */
  seq: bigint('seq', { mode: 'number' }).notNull().default(0),
  actorUserId: uuid('actor_user_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  prevHash: text('prev_hash'),
  hash: text('hash').notNull().default(''),
}, t => [uniqueIndex('audit_event_org_seq_uq').on(t.orgId, t.seq)])

export const JOB_STATUSES = ['pending', 'running', 'done', 'failed'] as const

/** Kolejka zadań w tle (wzorzec outbox) – działa bez długo żyjących procesów (Netlify). */
export const job = pgTable('job', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id'),
  type: text('type').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  status: text('status', { enum: JOB_STATUSES }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(8),
  runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lastError: text('last_error'),
  ...timestamps,
}, t => [index('job_pending_run_at_idx').on(t.runAt).where(sql`${t.status} = 'pending'`)])
