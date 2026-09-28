/**
 * Wysyłka e-maili przez SMTP (lokalnie Mailpit, produkcyjnie dostawca z serwerami w UE).
 */
import nodemailer from 'nodemailer'
import type { Env } from './env'
import type { OutgoingEmail } from './mail-types'
import { renderEmail } from './email-templates'

export function createMailer(env: Env) {
  const transport = nodemailer.createTransport(env.SMTP_URL)
  return {
    async send(email: OutgoingEmail) {
      const { subject, text, html } = renderEmail(email)
      await transport.sendMail({ from: env.MAIL_FROM, to: email.to, subject, text, html })
    },
  }
}

export type Mailer = ReturnType<typeof createMailer>
