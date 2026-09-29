/**
 * Push na tym urządzeniu dla członka zespołu: stan, włączenie, wyłączenie i próbne powiadomienie.
 * Subskrypcja należy do osoby (nie do warsztatu) – powiadomienia ze wszystkich jej warsztatów trafiają na to urządzenie.
 */
import { currentPushSubscription, pushSupport, PushPermissionError, subscribeToPush, unsubscribeFromPush, type PushSupport } from '~/utils/push'

export type TeamPushState = 'loading' | 'on' | 'off' | 'denied' | PushSupport

export function useTeamPush() {
  const state = useState<TeamPushState>('team-push-state', () => 'loading')
  const busy = ref(false)

  async function check() {
    const support = pushSupport()
    if (support !== 'supported') {
      state.value = support
      return
    }
    if (Notification.permission === 'denied') {
      state.value = 'denied'
      return
    }
    try {
      const subscription = await currentPushSubscription()
      if (!subscription) {
        state.value = 'off'
        return
      }
      // subskrypcja tej przeglądarki mogła należeć do innej osoby (wspólny telefon)
      const { mine } = await $fetch('/api/push/check', { method: 'POST', body: { endpoint: subscription.endpoint } })
      state.value = mine ? 'on' : 'off'
    }
    catch {
      state.value = 'off'
    }
  }

  async function enable(publicKey: string) {
    busy.value = true
    try {
      const subscription = await subscribeToPush(publicKey)
      await $fetch('/api/push/subscriptions', { method: 'POST', body: subscription.toJSON() })
      state.value = 'on'
    }
    catch (error) {
      if (error instanceof PushPermissionError && error.permission === 'denied') state.value = 'denied'
      throw error
    }
    finally {
      busy.value = false
    }
  }

  async function disable() {
    busy.value = true
    try {
      await disableTeamPushOnThisDevice()
      state.value = pushSupport() === 'supported' ? 'off' : pushSupport()
    }
    finally {
      busy.value = false
    }
  }

  return { state, busy, check, enable, disable }
}

/** Wyłącza push na tym urządzeniu (również przy wylogowaniu – następna osoba nie dostanie cudzych powiadomień). */
export async function disableTeamPushOnThisDevice() {
  if (pushSupport() !== 'supported') return
  const endpoint = await unsubscribeFromPush().catch(() => null)
  if (endpoint) await $fetch('/api/push/unsubscribe', { method: 'POST', body: { endpoint } }).catch(() => undefined)
}
