import type { MaybeRefOrGetter, Ref } from 'vue'

/**
 * Postęp przewijania sekcji z „przyklejoną” sceną: `track` jest wysoką sekcją, a `sticky` (jej dziecko,
 * `position: sticky`) zostaje na ekranie, gdy użytkownik przewija `track`. Z położenia sekcji liczymy
 * postęp 0–1, numer aktywnego kroku i postęp wewnątrz kroku (do animacji sterowanych przewijaniem).
 * Nasłuch scroll działa tylko, gdy sekcja jest blisko ekranu. Po stronie serwera zostaje krok 0.
 */
export function useScrollStory(track: Ref<HTMLElement | null>, sticky: Ref<HTMLElement | null>, count: MaybeRefOrGetter<number>) {
  const progress = ref(0)
  const index = ref(0)
  const local = ref(0)

  let frame = 0
  let observer: IntersectionObserver | undefined
  let listening = false

  /** Odległość przewijania (px) od początku do końca przyklejenia. */
  function scrollable() {
    const t = track.value
    const s = sticky.value
    return t && s ? t.offsetHeight - s.offsetHeight : 0
  }

  function stickyTop() {
    const s = sticky.value
    return s ? Number.parseFloat(getComputedStyle(s).top) || 0 : 0
  }

  function measure() {
    frame = 0
    const t = track.value
    const total = scrollable()
    const steps = toValue(count)
    if (!t || total <= 0 || steps < 1) return
    const p = Math.min(1, Math.max(0, (stickyTop() - t.getBoundingClientRect().top) / total))
    const scaled = p * steps
    const i = Math.min(steps - 1, Math.floor(scaled))
    progress.value = p
    index.value = i
    local.value = Math.min(1, Math.max(0, scaled - i))
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(measure)
  }

  function listen(on: boolean) {
    if (on === listening) return
    listening = on
    const toggle = on ? 'addEventListener' : 'removeEventListener'
    window[toggle]('scroll', schedule, { passive: true })
    window[toggle]('resize', schedule)
    if (on) schedule()
  }

  /** Przewija do środka wskazanego kroku (przyciski listy kroków, nawigacja klawiaturą). */
  function scrollToStep(target: number) {
    const t = track.value
    const steps = toValue(count)
    if (!t || steps < 1) return
    const top = window.scrollY + t.getBoundingClientRect().top - stickyTop()
    const y = top + ((target + 0.6) / steps) * scrollable()
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: y, behavior: calm ? 'auto' : 'smooth' })
  }

  onMounted(() => {
    if (!track.value) return
    observer = new IntersectionObserver(([entry]) => listen(!!entry?.isIntersecting), { rootMargin: '30% 0px' })
    observer.observe(track.value)
    measure()
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    listen(false)
    if (frame) cancelAnimationFrame(frame)
  })

  return { progress, index, local, scrollToStep }
}
