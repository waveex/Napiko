/**
 * Funkcja cykliczna Netlify: raz na dobę sprząta stare powiadomienia zespołu i wykonane zadania kolejki
 * (zob. cleanupNotifications w server/db/notifications.ts).
 *
 * Działa tylko na wdrożeniu produkcyjnym (Netlify nie uruchamia harmonogramów na podglądach).
 */
import type { Config } from '@netlify/functions'

export default async () => {
  const siteUrl = Netlify.env.get('URL')
  const key = Netlify.env.get('INTERNAL_API_KEY')
  if (!siteUrl || !key) {
    console.error('[housekeeping-cron] brak URL albo INTERNAL_API_KEY')
    return
  }
  const response = await fetch(`${siteUrl}/api/internal/housekeeping`, {
    method: 'POST',
    headers: { 'x-internal-key': key },
  })
  console.log(`[housekeeping-cron] ${response.status} ${await response.text()}`)
}

export const config: Config = {
  // 03:17 UTC – poza godzinami pracy warsztatów, nie o pełnej godzinie (mniejszy ruch)
  schedule: '17 3 * * *',
}
