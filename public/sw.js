/*
 * OXY – service worker: wyłącznie powiadomienia push (zespół warsztatu i klienci na stronie statusu naprawy).
 * Nie przechowuje stron ani danych w pamięci podręcznej – aplikacja zawsze działa z sieci.
 *
 * Treść wiadomości (JSON) przygotowuje serwer: server/lib/push.ts (PushMessage: title, body, url, tag, lang).
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/** Tylko adresy tej aplikacji – powiadomienie nie może otworzyć obcej strony. */
function safeUrl(value) {
  try {
    const url = new URL(value || '/app', self.location.origin)
    return url.origin === self.location.origin ? url.href : new URL('/app', self.location.origin).href
  }
  catch {
    return new URL('/app', self.location.origin).href
  }
}

self.addEventListener('push', (event) => {
  let message = {}
  try {
    message = event.data ? event.data.json() : {}
  }
  catch {
    message = { body: event.data ? event.data.text() : '' }
  }
  const url = safeUrl(message.url)
  const customer = new URL(url).pathname.startsWith('/s/')
  const title = message.title || 'OXY'
  const options = {
    body: message.body || '',
    lang: message.lang || 'pl',
    icon: customer ? '/icons/customer-192.png' : '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    data: { url },
    timestamp: Date.now(),
    ...(message.tag ? { tag: message.tag, renotify: true } : {}),
  }
  event.waitUntil((async () => {
    await self.registration.showNotification(title, options)
    // Otwarta aplikacja odświeża licznik w dzwonku bez czekania na kolejne sprawdzenie
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) client.postMessage({ type: 'oxy:push', url })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = safeUrl(event.notification.data && event.notification.data.url)
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Najpierw okno już otwarte na tej stronie, potem dowolne okno aplikacji, na końcu nowe okno
    const exact = windows.find(client => client.url === url)
    if (exact) return exact.focus()
    for (const client of windows) {
      if (!('focus' in client)) continue
      const focused = await client.focus()
      if ('navigate' in focused) {
        try {
          return await focused.navigate(url)
        }
        catch {
          // okno spoza kontroli service workera – otwieramy nowe
        }
      }
      break
    }
    return self.clients.openWindow(url)
  })())
})
