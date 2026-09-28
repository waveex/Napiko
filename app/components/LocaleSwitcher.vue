<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()
const items = computed(() => locales.value.map(l => ({ label: l.name ?? l.code, value: l.code })))
</script>

<template>
  <USelect
    :model-value="locale"
    :items="items"
    icon="i-lucide-languages"
    size="sm"
    variant="ghost"
    class="w-32"
    :aria-label="$t('common.language')"
    @update:model-value="(value) => setLocale(value as typeof locale)"
  />
</template>
