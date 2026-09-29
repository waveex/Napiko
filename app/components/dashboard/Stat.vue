<script setup lang="ts">
/**
 * Kafelek z liczbą: etykieta, wartość, opcjonalna zmiana względem wskazanego okresu i podpowiedź.
 * Kolor mówi tylko o kierunku zmiany (z ikoną i tekstem) – sama wartość zostaje w kolorze tekstu.
 */
const props = defineProps<{
  label: string
  value: string
  hint?: string
  icon?: string
  tone?: 'primary' | 'success' | 'warning' | 'error' | 'neutral'
  to?: string
  delta?: { label: string, direction: 'up' | 'down' | 'flat', good: boolean }
}>()

const NuxtLink = resolveComponent('NuxtLink')

const iconClass = computed(() => ({
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  neutral: 'text-muted',
})[props.tone ?? 'neutral'])

const deltaColor = computed(() => {
  if (!props.delta || props.delta.direction === 'flat') return 'neutral' as const
  return props.delta.good ? 'success' as const : 'error' as const
})
const deltaIcon = computed(() => ({
  up: 'i-lucide-trending-up',
  down: 'i-lucide-trending-down',
  flat: 'i-lucide-minus',
})[props.delta?.direction ?? 'flat'])
</script>

<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to="to"
    class="oxy-surface flex min-w-0 flex-col gap-1 p-4"
    :class="{ 'oxy-surface-link': to }"
  >
    <span class="flex items-center gap-2 text-sm text-muted">
      <UIcon
        v-if="icon"
        :name="icon"
        class="size-4 shrink-0"
        :class="iconClass"
      />
      <span class="min-w-0">{{ label }}</span>
    </span>
    <span class="text-2xl font-semibold tracking-tight break-words">{{ value }}</span>
    <UBadge
      v-if="delta"
      :color="deltaColor"
      variant="subtle"
      size="md"
      :icon="deltaIcon"
      :label="delta.label"
      class="self-start"
    />
    <span
      v-if="hint"
      class="text-sm text-muted"
    >{{ hint }}</span>
    <slot />
  </component>
</template>
