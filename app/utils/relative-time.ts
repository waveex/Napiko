const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

/** Czas względny w języku interfejsu: „2 godz. temu”, „za 3 dni”, „wczoraj”. */
export function formatRelative(date: string | Date, now: number, locale: string) {
  const diff = new Date(date).getTime() - now
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
  const [unit, ms] = UNITS.find(([, size]) => Math.abs(diff) >= size) ?? UNITS[UNITS.length - 1]!
  return rtf.format(Math.round(diff / ms), unit)
}

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
