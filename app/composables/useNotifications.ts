/**
 * Powiadomienia zespołu w aplikacji: licznik w dzwonku, lista, oznaczanie jako przeczytane,
 * wyskakujące powiadomienia (toast) o nowych zdarzeniach, gdy aplikacja jest otwarta.
 *
 * Licznik sprawdzamy co 30 s (tylko przy widocznej karcie), po powrocie do karty i od razu po powiadomieniu push
 * (service worker wysyła wiadomość do otwartych okien). Aktualizacje na żywo przez WebSocket – w kolejnym etapie.
 */
import {
  isTeamNotificationType, TEAM_NOTIFICATIONS, teamNotificationParams, teamNotificationVariant, type TeamNotificationData,
} from '#shared/notifications'
import type { BadgeColor } from '#shared/workshop'

export interface NotificationRow {
  id: string
  type: string
  data: TeamNotificationData
  link: string | null
  workOrderId: string | null
  readAt: string | Date | null
  createdAt: string | Date
  actorName: string | null
}

interface Summary {
  unreadCount: number
  unreadElsewhere: number
  latestAt: string | Date | null
}

/** Tytuł, treść, ikona i kolor powiadomienia w języku interfejsu (te same teksty co w push i e-mailu). */
export function useNotificationText() {
  const { t } = useI18n()
  return (n: Pick<NotificationRow, 'type' | 'data'>): { title: string, body: string, icon: string, color: BadgeColor } => {
    if (!isTeamNotificationType(n.type)) return { title: t('notifications.title'), body: '', icon: 'i-lucide-bell', color: 'neutral' }
    const variant = teamNotificationVariant(n.type, n.data)
    const params = teamNotificationParams(n.data, key => t(key))
    return {
      title: t(`notifications.text.${variant}.title`, params),
      body: t(`notifications.text.${variant}.body`, params).trim(),
      icon: TEAM_NOTIFICATIONS[n.type].icon,
      color: TEAM_NOTIFICATIONS[n.type].color,
    }
  }
}

const POLL_MS = 30_000

export function useNotificationCenter() {
  const { t } = useI18n()
  const toast = useToast()
  const text = useNotificationText()
  const summary = useState<Summary>('notifications-summary', () => ({ unreadCount: 0, unreadElsewhere: 0, latestAt: null }))
  const panelOpen = useState('notifications-open', () => false)
  /** od kiedy pokazujemy nowe powiadomienia jako toast (przy pierwszym sprawdzeniu – bez zaległych) */
  const since = useState<string | null>('notifications-since', () => null)
  /** zmienia się po każdej zmianie (nowe, przeczytane) – listy odświeżają się same */
  const version = useState('notifications-version', () => 0)

  async function refresh(options: { toast?: boolean } = {}) {
    try {
      const result = await $fetch('/api/notifications/summary', { query: since.value ? { since: since.value } : {} })
      const changed = result.unreadCount !== summary.value.unreadCount
        || String(result.latestAt ?? '') !== String(summary.value.latestAt ?? '')
      summary.value = { unreadCount: result.unreadCount, unreadElsewhere: result.unreadElsewhere, latestAt: result.latestAt }
      if (since.value && options.toast !== false && !panelOpen.value) {
        for (const n of [...result.fresh].reverse().slice(-2)) showToast(n as NotificationRow)
      }
      const newest = result.fresh[0]?.createdAt ?? result.latestAt
      if (newest) since.value = new Date(newest).toISOString()
      else since.value ??= new Date().toISOString()
      if (changed) version.value++
    }
    catch {
      // brak sieci albo wylogowanie – spróbujemy przy kolejnym sprawdzeniu
    }
  }

  function showToast(n: NotificationRow) {
    const content = text(n)
    toast.add({
      title: content.title,
      description: content.body,
      icon: content.icon,
      color: content.color,
      actions: [{ label: t('notifications.open'), color: 'neutral', variant: 'outline', onClick: () => open(n) }],
    })
  }

  async function markRead(ids: string[]) {
    if (!ids.length) return
    const result = await $fetch('/api/notifications/read', { method: 'POST', body: { ids } })
    summary.value = { ...summary.value, unreadCount: result.unreadCount }
    version.value++
  }

  async function markAllRead() {
    const result = await $fetch('/api/notifications/read', { method: 'POST', body: { all: true } })
    summary.value = { ...summary.value, unreadCount: result.unreadCount }
    version.value++
  }

  /** Otwiera powiadomienie: oznacza jako przeczytane i przechodzi do jego miejsca w aplikacji. */
  async function open(n: Pick<NotificationRow, 'id' | 'link' | 'readAt'>) {
    panelOpen.value = false
    if (!n.readAt) await markRead([n.id]).catch(() => undefined)
    await navigateTo(n.link ?? '/app/notifications')
  }

  return { summary, panelOpen, version, refresh, markRead, markAllRead, open }
}

/**
 * Sprawdzanie w tle – uruchamiane raz, w układzie panelu (onMounted), z obiektem z useNotificationCenter()
 * utworzonym w setup (kompozycje Nuxt i i18n działają tylko tam). Zwraca funkcję zatrzymującą.
 */
export function startNotificationPolling(center: ReturnType<typeof useNotificationCenter>) {
  let timer: ReturnType<typeof setInterval> | undefined

  const tick = () => {
    if (document.visibilityState === 'visible') center.refresh()
  }
  const onVisibility = () => {
    if (document.visibilityState === 'visible') center.refresh()
  }
  const onMessage = (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === 'oxy:push') center.refresh({ toast: false })
  }

  center.refresh({ toast: false })
  timer = setInterval(tick, POLL_MS)
  document.addEventListener('visibilitychange', onVisibility)
  navigator.serviceWorker?.addEventListener('message', onMessage)

  return () => {
    clearInterval(timer)
    timer = undefined
    document.removeEventListener('visibilitychange', onVisibility)
    navigator.serviceWorker?.removeEventListener('message', onMessage)
  }
}
