/**
 * Wysyłka SMS (np. link do akceptacji prac dodatkowych).
 * Dostawcy: "log" – tylko wpis w logach (lokalnie, testy), "smsapi" – SMSAPI.pl (bramka z siedzibą w PL/UE).
 * Wiadomości wysyłamy z kolejki zadań, więc awaria bramki nie blokuje pracy warsztatu (ponowienia).
 */
import type { Env } from './env'

export interface OutgoingSms {
  /** Numer w formacie międzynarodowym, np. +48600100200. */
  to: string
  message: string
  /** Zarejestrowana nazwa nadawcy (maks. 11 znaków). */
  from?: string | null
}

/** Do logów: bez pełnego numeru i bez tokenów z linków. */
function redact(sms: OutgoingSms) {
  const to = sms.to.replace(/\d(?=\d{3})/g, '•')
  const message = sms.message.replace(/(\/approve\/)[\w-]+/g, '$1…')
  return `${to}: ${message}`
}

export function createSmsSender(env: Env) {
  if (env.SMS_PROVIDER === 'smsapi') {
    if (!env.SMSAPI_TOKEN) throw new Error('SMS_PROVIDER=smsapi wymaga SMSAPI_TOKEN.')
    const token = env.SMSAPI_TOKEN
    return {
      async send(sms: OutgoingSms) {
        const body = new URLSearchParams({
          to: sms.to.replace(/^\+/, ''),
          message: sms.message,
          format: 'json',
          encoding: 'utf-8',
        })
        if (sms.from) body.set('from', sms.from)
        const response = await fetch('https://api.smsapi.pl/sms.do', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body,
        })
        const data = await response.json().catch(() => null) as { error?: number, message?: string } | null
        if (!response.ok || data?.error) {
          throw new Error(`SMSAPI: ${data?.message ?? `HTTP ${response.status}`}`)
        }
      },
    }
  }
  return {
    async send(sms: OutgoingSms) {
      console.info(`[sms:log] ${redact(sms)}`)
    },
  }
}

export type SmsSender = ReturnType<typeof createSmsSender>
