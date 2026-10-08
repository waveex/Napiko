<script setup lang="ts">
/** Pytania i odpowiedzi: `prefix` wskazuje listę w tłumaczeniach, np. marketing.workshops.faq.items. */
const props = defineProps<{ prefix: string, keys: readonly string[] }>()
const { t } = useI18n()

const items = computed(() => props.keys.map(key => ({
  value: key,
  label: t(`${props.prefix}.${key}.q`),
  content: t(`${props.prefix}.${key}.a`),
})))
</script>

<template>
  <UAccordion
    v-reveal
    type="single"
    collapsible
    :items="items"
    class="mk-faq"
    :ui="{ label: 'text-base font-semibold', body: 'text-base text-muted', trigger: 'min-h-14 py-4' }"
  />
</template>
