/**
 * Bieżący czas odświeżany co sekundę (liczniki pracy) z poprawką na zegar serwera –
 * telefon mechanika może mieć źle ustawioną godzinę.
 */
export function useNow(serverTime?: Ref<string | Date | null | undefined>) {
  const now = ref(Date.now())
  const offset = ref(0)
  let timer: ReturnType<typeof setInterval> | undefined

  if (serverTime) {
    watch(serverTime, (value) => {
      if (value) offset.value = new Date(value).getTime() - Date.now()
    }, { immediate: true })
  }

  onMounted(() => {
    timer = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  })
  onScopeDispose(() => clearInterval(timer))

  return computed(() => now.value + offset.value)
}
