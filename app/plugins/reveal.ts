/**
 * Dyrektywa `v-reveal` – element pojawia się (przesunięcie + rozjaśnienie), gdy wchodzi na ekran.
 * Nic nie ukrywa po stronie serwera ani przy `prefers-reduced-motion`; elementy widoczne od razu po
 * załadowaniu strony zostają nietknięte, więc nie ma błysku. Opóźnienie kaskady: `v-reveal="{ delay: 120 }"`.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive<HTMLElement, { delay?: number } | undefined>('reveal', {
    getSSRProps: () => ({}),
    mounted(el, binding) {
      if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const box = el.getBoundingClientRect()
      if (box.top < window.innerHeight * 0.9 && box.bottom > 0) return
      el.classList.add('mk-reveal')
      el.style.setProperty('--mk-delay', `${binding.value?.delay ?? 0}ms`)
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry?.isIntersecting) return
        el.classList.add('is-in')
        observer.disconnect()
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
      observer.observe(el)
    },
  })
})
