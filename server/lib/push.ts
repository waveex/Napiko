/**
 * Powiadomienia push (Web Push z kluczami VAPID) – telefony i komputery zespołu oraz „zarejestrowane telefony” klientów.
 * Treść jest szyfrowana dla urządzenia (RFC 8291), więc usługa push przeglądarki (Google, Mozilla, Apple) jej nie widzi.
 *
 * Bez kluczy VAPID push jest wyłączony: zespół korzysta z dzwonka i e-maili, klient dostaje SMS-y.
 */
import webPush from 'web-push'
import type { Env } from './env'

export interface PushTarget {
  endpoint: string
  p256dh: string
  auth: string
}

/** Treść odczytywana przez service worker (public/sw.js). */
export interface PushMessage {
  title: string
  body: string
  /** adres otwierany po dotknięciu powiadomienia */
  url: string
  /** kolejne powiadomienie z tym samym znacznikiem zastępuje poprzednie (np. ponowienie wysyłki) */
  tag?: string
  lang?: string
}

export interface PushSendOptions {
  /** ile sekund usługa push przechowuje wiadomość dla urządzenia bez zasięgu */
  ttlSeconds?: number
  urgency?: 'very-low' | 'low' | 'normal' | 'high'
}

/**
 * ok – usługa przyjęła wiadomość; gone – urządzenie wyrejestrowane (subskrypcję trzeba usunąć);
 * Błędy przejściowe (sieć, 5xx, 429) są zgłaszane wyjątkiem, żeby kolejka ponowiła wysyłkę.
 */
export type PushResult = 'ok' | 'gone'

export interface PushSender {
  readonly enabled: boolean
  readonly publicKey: string | null
  send(target: PushTarget, message: PushMessage, options?: PushSendOptions): Promise<PushResult>
}

export function isPushConfigured(env: Env) {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)
}

export class PushDeliveryError extends Error {
  constructor(message: string, readonly statusCode: number | null) {
    super(message)
    this.name = 'PushDeliveryError'
  }
}

export function createPushSender(env: Env): PushSender {
  if (!isPushConfigured(env)) {
    return {
      enabled: false,
      publicKey: null,
      async send() {
        throw new PushDeliveryError('Push jest wyłączony: brak kluczy VAPID_PUBLIC_KEY i VAPID_PRIVATE_KEY.', null)
      },
    }
  }
  // Kontakt dla operatorów usług push: VAPID_SUBJECT albo adres nadawcy e-maili (MAIL_FROM)
  const mailFrom = /<([^>]+)>/.exec(env.MAIL_FROM)?.[1] ?? env.MAIL_FROM
  const vapidDetails = {
    subject: env.VAPID_SUBJECT ?? `mailto:${mailFrom.trim()}`,
    publicKey: env.VAPID_PUBLIC_KEY!,
    privateKey: env.VAPID_PRIVATE_KEY!,
  }
  return {
    enabled: true,
    publicKey: vapidDetails.publicKey,
    async send(target, message, options = {}) {
      try {
        await webPush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          JSON.stringify(message),
          {
            vapidDetails,
            TTL: options.ttlSeconds ?? 24 * 3600,
            urgency: options.urgency ?? 'normal',
            timeout: 10_000,
          },
        )
        return 'ok'
      }
      catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode ?? null
        // 404 / 410: subskrypcja wygasła albo użytkownik zablokował powiadomienia
        if (statusCode === 404 || statusCode === 410) return 'gone'
        // 400 / 403 / 413: zła subskrypcja (np. inne klucze VAPID) – ponowienie nic nie da
        if (statusCode === 400 || statusCode === 403 || statusCode === 413) {
          throw new PushDeliveryError(`Usługa push odrzuciła wiadomość (HTTP ${statusCode}).`, statusCode)
        }
        const reason = error instanceof Error ? error.message : String(error)
        throw new PushDeliveryError(`Push niedostępny: ${statusCode ? `HTTP ${statusCode}` : reason}`.slice(0, 500), statusCode)
      }
    },
  }
}

/** Czy błąd oznacza trwale złą subskrypcję (nie ponawiamy, traktujemy jak wyrejestrowaną). */
export function isPermanentPushError(error: unknown) {
  return error instanceof PushDeliveryError && (error.statusCode === 400 || error.statusCode === 403 || error.statusCode === 413)
}

/** Nowa para kluczy VAPID (skrypt `pnpm push:keys`). */
export function generateVapidKeys() {
  return webPush.generateVAPIDKeys()
}
