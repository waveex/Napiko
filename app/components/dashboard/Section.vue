<script setup lang="ts">
defineProps<{ title: string, description?: string }>()
</script>

<template>
  <section class="space-y-3">
    <header class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold">
          {{ title }}
        </h2>
        <p
          v-if="description"
          class="text-sm text-muted"
        >
          {{ description }}
        </p>
      </div>
      <slot name="actions" />
    </header>
    <slot />
  </section>
</template>
