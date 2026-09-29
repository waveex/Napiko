/**
 * Wysyłka SMS (link do akceptacji prac dodatkowych, przyjęcie pojazdu, gotowość do odbioru).
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

/** Do logów: bez pełnego numeru i bez tokenów z linków (akceptacja, status naprawy). */
export function redactSms(sms: OutgoingSms) {
  const to = sms.to.replace(/\d(?=\d{3})/g, '•')
  const message = sms.message.replace(/(\/(?:approve|s)\/)[\w-]+/g, '$1…')
  return `${to}: ${message}`
}

const SMS_CHARS: Record<string, string> = {
  'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
  'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
  '„': '"', '”': '"', '“': '"', '«': '"', '»': '"', '‘': '\'', '’': '\'', '–': '-', '—': '-', '…': '...', '\u00a0': ' ',
}

/**
 * Tekst SMS-a bez polskich znaków i typograficznych cudzysłowów: mieści się w alfabecie GSM-7,
 * więc jedna wiadomość ma 160 znaków zamiast 70 (koszt SMS-ów – decyzja D5).
 */
export function toSmsText(text: string) {
  return text
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ„”“«»‘’–—…\u00a0]/g, char => SMS_CHARS[char] ?? char)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
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
          signal: AbortSignal.timeout(15_000),
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
      console.info(`[sms:log] ${redactSms(sms)}`)
    },
  }
}

export type SmsSender = ReturnType<typeof createSmsSender>
