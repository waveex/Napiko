/**
 * Konfiguracja logowania (Better Auth): e-mail + hasło, weryfikacja e-maila,
 * organizacje (warsztaty) z rolami, zaproszenia i limit prób logowania.
 *
 * Fabryka nie zależy od Nuxta: to samo ustawienie używa serwer, CLI Better Auth i testy.
 */
import { betterAuth } from 'better-auth'
import { organization } from 'better-auth/plugins'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import type { Db } from '../db/client'
import * as schema from '../db/schema'
import { ac, roles } from '../../shared/permissions'
import type { Env } from './env'
import type { OutgoingEmail } from './mail-types'

export interface AuthDeps {
  db: Db
  env: Env
  /** Wstawia e-mail do kolejki zadań (wysyłka poza żądaniem użytkownika). */
  sendEmail: (email: OutgoingEmail) => Promise<void>
  onOrganizationCreated?: (data: { organizationId: string, userId: string }) => Promise<void>
  onInvitationCreated?: (data: { organizationId: string, invitationId: string, inviterId: string, role: string }) => Promise<void>
  onInvitationAccepted?: (data: { organizationId: string, userId: string, role: string }) => Promise<void>
  /** Organizacja ustawiana jako aktywna przy logowaniu (np. pierwsza, do której należy użytkownik). */
  defaultOrganizationId?: (userId: string) => Promise<string | null>
}

export function createAuth(deps: AuthDeps) {
  const { env } = deps
  const trustedOrigins = [
    env.appUrl,
    ...(env.AUTH_TRUSTED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) ?? []),
  ]

  return betterAuth({
    appName: 'OXY',
    baseURL: env.appUrl,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins,
    database: drizzleAdapter(deps.db, { provider: 'pg', schema }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: env.AUTH_REQUIRE_EMAIL_VERIFICATION,
      minPasswordLength: 10,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await deps.sendEmail({ to: user.email, template: 'reset-password', data: { name: user.name, url } })
      },
    },

    emailVerification: {
      sendOnSignUp: env.AUTH_REQUIRE_EMAIL_VERIFICATION,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await deps.sendEmail({ to: user.email, template: 'verify-email', data: { name: user.name, url } })
      },
    },

    // W środowisku serverless pamięć nie jest współdzielona, dlatego limity trzymamy w bazie.
    rateLimit: {
      enabled: env.NODE_ENV === 'production',
      storage: 'database',
      window: 60,
      max: 100,
    },

    advanced: {
      database: { generateId: 'uuid' },
    },

    databaseHooks: {
      session: {
        create: {
          // Nowa sesja od razu wskazuje organizację – panel nie musi jej wybierać po zalogowaniu.
          before: async (session) => {
            const activeOrganizationId = await deps.defaultOrganizationId?.(session.userId)
            return activeOrganizationId ? { data: { ...session, activeOrganizationId } } : undefined
          },
        },
      },
    },

    plugins: [
      organization({
        ac,
        roles,
        creatorRole: 'owner',
        invitationExpiresIn: 60 * 60 * 24 * 7,
        cancelPendingInvitationsOnReInvite: true,
        requireEmailVerificationOnInvitation: true,
        schema: {
          organization: {
            additionalFields: {
              // "workshop" – warsztat, "solo" – samodzielny mechanik działający jako mikroorganizacja
              kind: { type: 'string', required: false, defaultValue: 'workshop', input: true },
            },
          },
        },
        // Usuwanie warsztatu (wraz z danymi klientów) będzie osobną procedurą z retencją – nie przyciskiem.
        disableOrganizationDeletion: true,
        sendInvitationEmail: async (data) => {
          await deps.onInvitationCreated?.({
            organizationId: data.organization.id,
            invitationId: data.id,
            inviterId: data.inviter.user.id,
            role: data.role,
          })
          await deps.sendEmail({
            to: data.email,
            template: 'org-invitation',
            data: {
              organizationName: data.organization.name,
              inviterName: data.inviter.user.name,
              role: data.role,
              url: `${env.appUrl}/invite/${data.id}`,
            },
          })
        },
        organizationHooks: {
          afterCreateOrganization: async ({ organization, user }) => {
            await deps.onOrganizationCreated?.({ organizationId: organization.id, userId: user.id })
          },
          afterAcceptInvitation: async ({ organization, user, member }) => {
            await deps.onInvitationAccepted?.({ organizationId: organization.id, userId: user.id, role: member.role })
          },
        },
      }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
