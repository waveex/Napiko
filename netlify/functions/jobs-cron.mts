/**
 * Funkcja cykliczna Netlify: co 5 minut przetwarza zaległe zadania z kolejki
 * (ponowienia po błędach, zadania zaplanowane na później).
 * Bieżące zadania (np. e-mail po rejestracji) wysyłane są od razu w trakcie żądania.
 *
 * Działa tylko na wdrożeniu produkcyjnym (Netlify nie uruchamia harmonogramów na podglądach).
 */
import type { Config } from '@netlify/functions'

export default async () => {
  const siteUrl = Netlify.env.get('URL')
  const key = Netlify.env.get('INTERNAL_API_KEY')
  if (!siteUrl || !key) {
    console.error('[jobs-cron] brak URL albo INTERNAL_API_KEY')
    return
  }
  const response = await fetch(`${siteUrl}/api/internal/jobs/run`, {
    method: 'POST',
    headers: { 'x-internal-key': key },
  })
  console.log(`[jobs-cron] ${response.status} ${await response.text()}`)
}

export const config: Config = {
  schedule: '*/5 * * * *',
}
