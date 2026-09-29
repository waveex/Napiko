/**
 * Czas względny do list (powiadomienia): „przed chwilą”, „5 min temu”, „wczoraj”, a starsze – data.
 * Intl.RelativeTimeFormat odmienia jednostki poprawnie w każdym języku (np. „2 godziny temu”, „5 godzin temu”).
 */
export function relativeTime(value: string | Date, locale: string, now = Date.now()) {
  const date = new Date(value)
  const seconds = Math.round((date.getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
  if (abs < 45) return rtf.format(0, 'second')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 24 * 3600) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 7 * 24 * 3600) return rtf.format(Math.round(seconds / (24 * 3600)), 'day')
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: date.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' })
}
