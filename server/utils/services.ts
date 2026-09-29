/**
 * Pojedyncze instancje usług serwera (baza, logowanie, poczta, magazyn plików).
 * W funkcjach serverless żyją tyle, co instancja funkcji.
 */
import { getConnectionString } from '@netlify/database'
import { createAuth, type Auth } from '../lib/auth'
import { createDb, createPool, type Db } from '../db/client'
import { getEnv } from '../lib/env'
import { createMailer, type Mailer } from '../lib/mailer'
import { createStorage, type FileStorage } from '../lib/storage'
import { createSmsSender, type SmsSender } from '../lib/sms'
import { createPushSender, type PushSender } from '../lib/push'
import { enqueueJob } from '../db/jobs'
import { recordAudit } from '../db/audit'
import { withSystem } from '../db/tenant'
import { member, organizationSettings } from '../db/schema'
import { asc, eq } from 'drizzle-orm'

let db: Db | undefined
let auth: Auth | undefined
let mailer: Mailer | undefined
let storage: FileStorage | undefined
let sms: SmsSender | undefined
let push: PushSender | undefined

function resolveDatabaseUrl() {
  // Lokalnie i przy zewnętrznej bazie (np. Neon w UE): DATABASE_URL.
  // Na Netlify z Netlify Database adres dostarcza platforma (NETLIFY_DB_URL).
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    return getConnectionString()
  }
  catch {
    throw new Error('Brak połączenia z bazą: ustaw DATABASE_URL (lokalnie: skopiuj .env.example do .env).')
  }
}

export function useDb(): Db {
  db ??= createDb(createPool(resolveDatabaseUrl()))
  return db
}

export function useMailer(): Mailer {
  mailer ??= createMailer(getEnv())
  return mailer
}

export function useFileStorage(): FileStorage {
  storage ??= createStorage(getEnv())
  return storage
}

export function useSms(): SmsSender {
  sms ??= createSmsSender(getEnv())
  return sms
}

/** Web Push (klucze VAPID); bez kluczy `enabled: false` – powiadomienia idą innymi kanałami. */
export function usePush(): PushSender {
  push ??= createPushSender(getEnv())
  return push
}

export function useAuth(): Auth {
  if (auth) return auth
  const database = useDb()
  auth = createAuth({
    db: database,
    env: getEnv(),
    sendEmail: email => withSystem(database, tx => enqueueJob(tx, { type: 'email.send', payload: { ...email } })),
    onOrganizationCreated: ({ organizationId, userId }) => withSystem(database, async (tx) => {
      await tx.insert(organizationSettings).values({ orgId: organizationId }).onConflictDoNothing()
      await recordAudit(tx, {
        orgId: organizationId,
        actorUserId: userId,
        action: 'organization.created',
        entityType: 'organization',
        entityId: organizationId,
      })
    }),
    onInvitationCreated: ({ organizationId, invitationId, inviterId, role }) => withSystem(database, tx => recordAudit(tx, {
      orgId: organizationId,
      actorUserId: inviterId,
      action: 'member.invited',
      entityType: 'invitation',
      entityId: invitationId,
      data: { role },
    })),
    defaultOrganizationId: async (userId) => {
      const [first] = await database
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, userId))
        .orderBy(asc(member.createdAt))
        .limit(1)
      return first?.organizationId ?? null
    },
    onInvitationAccepted: ({ organizationId, userId, role }) => withSystem(database, tx => recordAudit(tx, {
      orgId: organizationId,
      actorUserId: userId,
      action: 'member.joined',
      entityType: 'member',
      entityId: userId,
      data: { role },
    })),
  })
  return auth
}
