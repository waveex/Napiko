/**
 * Wysyłka e-maili przez SMTP (lokalnie Mailpit, produkcyjnie dostawca z serwerami w UE).
 */
import nodemailer from 'nodemailer'
import type { Env } from './env'
import type { OutgoingEmail } from './mail-types'
import { renderEmail } from './email-templates'

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
      await transport.sendMail({ from: env.MAIL_FROM, to: email.to, subject, text, html, ...(headers ? { headers } : {}) })
    },
  }
}

export type Mailer = ReturnType<typeof createMailer>
