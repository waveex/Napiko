<script setup lang="ts">
import { en, pl } from '@nuxt/ui/locale'

const { locale } = useI18n()
const uiLocale = computed(() => (locale.value === 'en' ? en : pl))

useHead({ htmlAttrs: { lang: () => locale.value } })
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
