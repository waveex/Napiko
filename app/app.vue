<script setup lang="ts">
import { en, pl } from '@nuxt/ui/locale'

const { locale } = useI18n()
const route = useRoute()
const uiLocale = computed(() => (locale.value === 'en' ? en : pl))

useHead({ htmlAttrs: { 'lang': () => locale.value, 'data-oxy-theme': () => resolveThemeContext(route.meta.themeContext) } })

// VisualViewport follows the actual keyboard-reduced space, also in a webview.
onMounted(() => {
  const viewport = window.visualViewport
  function syncViewport() {
    document.documentElement.style.setProperty('--oxy-viewport-height', `${viewport?.height ?? window.innerHeight}px`)
    document.documentElement.style.setProperty('--oxy-viewport-top', `${viewport?.offsetTop ?? 0}px`)
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
