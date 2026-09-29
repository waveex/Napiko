/**
 * Treść powiadomień zespołu dla e-maili i push – z tych samych tłumaczeń co dzwonek w aplikacji
 * (i18n/locales, klucz notifications.text.<wariant>), więc wszędzie brzmi tak samo.
 */
import pl from '../../i18n/locales/pl.json'
import en from '../../i18n/locales/en.json'
import {
  interpolate, teamNotificationParams, teamNotificationVariant, type TeamNotificationData, type TeamNotificationType,
} from '../../shared/notifications'

interface Texts { title: string, body: string }

const LOCALES: Record<string, unknown> = { pl, en }

/** Tekst z pliku tłumaczeń po ścieżce „a.b.c”; brak – wersja polska, a na końcu sam klucz. */
function lookup(locale: string, key: string): string {
  for (const messages of [LOCALES[locale], LOCALES.pl]) {
    const value = key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), messages)
    if (typeof value === 'string') return value
  }
  return key
}

export function renderTeamNotification(type: TeamNotificationType, data: TeamNotificationData, locale = 'pl'): Texts {
  const variant = teamNotificationVariant(type, data)
  const params = teamNotificationParams(data, key => lookup(locale, key))
  return {
    title: interpolate(lookup(locale, `notifications.text.${variant}.title`), params),
    body: interpolate(lookup(locale, `notifications.text.${variant}.body`), params),
  }
}
