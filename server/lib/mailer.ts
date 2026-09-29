/**
 * Wysyłka e-maili przez SMTP (lokalnie Mailpit, produkcyjnie dostawca z serwerami w UE).
 */
import nodemailer from 'nodemailer'
import type { Env } from './env'
import type { OutgoingEmail } from './mail-types'
import { renderEmail } from './email-templates'

/** Stały Message-ID z klucza idempotencji, w domenie nadawcy (RFC 5322). */
export function messageIdFor(key: string, mailFrom: string) {
  const domain = /@([\w.-]+)/.exec(mailFrom)?.[1] ?? 'oxy.local'
  return `<oxy-${key.replace(/[^\w.-]/g, '')}@${domain}>`
}

export function createMailer(env: Env) {
  // Krótkie limity czasu: wysyłka odbywa się także w trakcie żądań (powiadomienia), a kolejka ponawia błędy
  const transport = nodemailer.createTransport({
    url: env.SMTP_URL,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
  return {
    async send(email: OutgoingEmail) {
      const { subject, text, html, headers } = renderEmail(email)
      await transport.sendMail({
        from: env.MAIL_FROM,
        to: email.to,
        subject,
        text,
        html,
        ...(headers ? { headers } : {}),
        ...(email.idempotencyKey ? { messageId: messageIdFor(email.idempotencyKey, env.MAIL_FROM) } : {}),
      })
    },
  }
}

export type Mailer = ReturnType<typeof createMailer>
