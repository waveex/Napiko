/**
 * Start / pauza / zakończenie pracy nad zadaniem (rejestrator czasu) z komunikatem o wyniku.
 * Po każdej próbie – także nieudanej – wywołuje `onDone`, żeby widok pobrał aktualny stan.
 */
export function useTaskWork(onDone: () => unknown) {
  const { t } = useI18n()
  const toast = useToast()
  /** Zadanie, dla którego trwa wywołanie (blokuje kolejne kliknięcia). */
  const busy = ref<string | null>(null)

  async function work(taskId: string, action: 'start' | 'pause' | 'finish') {
    if (busy.value) return
    busy.value = taskId
    try {
      await $fetch(`/api/tasks/${taskId}/work`, { method: 'POST', body: { action } })
      const title = action === 'start' ? t('myTasks.started') : action === 'pause' ? t('myTasks.paused') : t('myTasks.finished')
      toast.add({ title, color: 'success', icon: action === 'finish' ? 'i-lucide-circle-check' : 'i-lucide-timer' })
    }
    catch (error) {
      toast.add({ title: apiErrorMessage(error, t('common.error')), color: 'error' })
    }
    finally {
      busy.value = null
      await onDone()
    }
  }

  return { busy, work }
}
