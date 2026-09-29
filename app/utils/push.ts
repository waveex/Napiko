/**
 * Powiadomienia push w przeglądarce (Web Push): rejestracja service workera (public/sw.js) i subskrypcja.
 * Wspólne dla zespołu (panel) i klienta (strona statusu naprawy).
 */

/**
 * supported – przeglądarka obsługuje push; ios-install – iPhone / iPad: push działa dopiero w aplikacji
 * dodanej do ekranu początkowego; unsupported – brak obsługi push (albo strona nie jest otwarta przez HTTPS).
 */
export type PushSupport = 'supported' | 'ios-install' | 'unsupported'

export function isIos() {
  if (typeof navigator === 'undefined') return false
  // iPadOS przedstawia się jak Mac z ekranem dotykowym
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Aplikacja uruchomiona z ekranu początkowego (PWA), a nie w karcie przeglądarki. */
export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined' || !window.isSecureContext) return 'unsupported'
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (supported) return 'supported'
  return isIos() && !isStandalone() ? 'ios-install' : 'unsupported'
}

let registration: Promise<ServiceWorkerRegistration> | null = null

/** Rejestruje service worker (raz na wczytanie strony) i sprawdza, czy jest nowsza wersja. */
export function registerServiceWorker() {
  registration ??= navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
    reg.update().catch(() => undefined)
    return reg
  }).catch((error) => {
    registration = null
    throw error
  })
  return registration
}

/** Obecna subskrypcja tej przeglądarki (bez pytania o zgodę). */
export async function currentPushSubscription() {
  if (pushSupport() !== 'supported') return null
  const reg = await navigator.serviceWorker.getRegistration('/')
  return (await reg?.pushManager.getSubscription()) ?? null
}

function keyToBytes(base64url: string) {
  const padded = `${base64url}${'='.repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, char => char.charCodeAt(0))
}

function sameKey(subscription: PushSubscription, publicKey: string) {
  const current = subscription.options?.applicationServerKey
  if (!current) return true
  const bytes = new Uint8Array(current)
  const expected = keyToBytes(publicKey)
  return bytes.length === expected.length && bytes.every((b, i) => b === expected[i])
}

export class PushPermissionError extends Error {
  constructor(readonly permission: NotificationPermission) {
    super(permission === 'denied' ? 'Powiadomienia są zablokowane w ustawieniach przeglądarki.' : 'Nie włączono powiadomień.')
    this.name = 'PushPermissionError'
  }
}

/**
 * Pyta o zgodę (musi być wywołane po kliknięciu) i tworzy subskrypcję dla klucza VAPID serwera.
 * Subskrypcję z innym kluczem (np. po zmianie kluczy na serwerze) zastępuje nową.
 */
export async function subscribeToPush(publicKey: string) {
  const reg = await registerServiceWorker()
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new PushPermissionError(permission)
  await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing && sameKey(existing, publicKey)) return existing
  if (existing) await existing.unsubscribe().catch(() => false)
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) })
}

/** Wyłącza push w tej przeglądarce; zwraca adres usuniętej subskrypcji (do usunięcia na serwerze). */
export async function unsubscribeFromPush() {
  const subscription = await currentPushSubscription()
  if (!subscription) return null
  const endpoint = subscription.endpoint
  await subscription.unsubscribe().catch(() => false)
  return endpoint
}
