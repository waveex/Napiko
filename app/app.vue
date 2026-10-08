<script setup lang="ts">
import { en, pl } from '@nuxt/ui/locale'
import { BRAND_COLORS } from '#shared/brand'

const { locale } = useI18n()
const route = useRoute()
const colorMode = useColorMode()
const uiLocale = computed(() => (locale.value === 'en' ? en : pl))
const themeContext = computed(() => resolveThemeContext(route.meta.themeContext))

// Kontekst (warsztat / klient) i jasność są niezależne; pasek przeglądarki podąża za obiema osiami
useHead({
  htmlAttrs: { 'lang': () => locale.value, 'data-napiko-theme': () => themeContext.value },
  meta: [{ name: 'theme-color', content: () => BRAND_COLORS[themeContext.value][colorMode.value === 'dark' ? 'themeColorDark' : 'themeColor'] }],
})

// VisualViewport follows the actual keyboard-reduced space, also in a webview.
onMounted(() => {
  const viewport = window.visualViewport
  function syncViewport() {
    document.documentElement.style.setProperty('--napiko-viewport-height', `${viewport?.height ?? window.innerHeight}px`)
    document.documentElement.style.setProperty('--napiko-viewport-top', `${viewport?.offsetTop ?? 0}px`)
  }
  syncViewport()
  viewport?.addEventListener('resize', syncViewport)
  viewport?.addEventListener('scroll', syncViewport)
  onBeforeUnmount(() => {
    viewport?.removeEventListener('resize', syncViewport)
    viewport?.removeEventListener('scroll', syncViewport)
  })
})
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
