<script setup lang="ts">
const { t } = useI18n()
const colorMode = useColorMode()
const items = computed(() => [
  { label: t('theme.light'), value: 'light', icon: 'i-lucide-sun' },
  { label: t('theme.dark'), value: 'dark', icon: 'i-lucide-moon' },
  { label: t('theme.system'), value: 'system', icon: 'i-lucide-monitor' },
])
</script>

<template>
  <ClientOnly>
    <USelect
      v-model="colorMode.preference"
      :items="items"
      :aria-label="t('theme.title')"
      class="min-w-32"
    />
    <template #fallback>
      <div class="h-12 w-32 rounded-lg bg-muted" />
    </template>
  </ClientOnly>
</template>
