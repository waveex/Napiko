<script setup lang="ts">
/** Karta „wymaga uwagi”: czego dotyczy, ile tego jest, kilka najpilniejszych pozycji i przejście do pełnej listy. */
const props = defineProps<{
  icon: string
  title: string
  count: number
  tone: 'error' | 'warning' | 'info' | 'success' | 'neutral'
  description?: string
  to?: string
  linkLabel?: string
}>()

const toneClass = computed(() => ({
  error: 'bg-error/10 text-error',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  neutral: 'bg-elevated text-muted',
})[props.tone])
</script>

<template>
  <article class="napiko-surface flex min-w-0 flex-col p-4">
    <header class="flex items-start gap-3">
      <span
        class="grid size-10 shrink-0 place-items-center rounded-xl"
        :class="toneClass"
      >
        <UIcon
          :name="icon"
          class="size-5"
        />
      </span>
      <div class="min-w-0 flex-1">
        <h3 class="font-semibold leading-snug">
          {{ title }}
        </h3>
        <p
          v-if="description"
          class="text-sm text-muted"
        >
          {{ description }}
        </p>
      </div>
      <span class="text-2xl font-semibold leading-none">{{ count }}</span>
    </header>
    <ul
      v-if="$slots.default"
      class="mt-3 divide-y divide-default"
    >
      <slot />
    </ul>
    <div
      v-if="to && linkLabel"
      class="mt-auto pt-2"
    >
      <UButton
        :to="to"
        variant="link"
        trailing-icon="i-lucide-arrow-right"
        :label="linkLabel"
        class="px-0"
      />
    </div>
  </article>
</template>
