<script setup lang="ts">
/** Wiersz listy na pulpicie – cały wiersz jest odnośnikiem (duży obszar dotyku na telefonie). */
defineProps<{ to?: string }>()
</script>

<template>
  <li>
    <NuxtLink
      v-if="to"
      :to="to"
      class="-mx-2 flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
    >
      <slot />
    </NuxtLink>
    <div
      v-else
      class="flex min-h-12 items-center gap-3 py-2"
    >
      <slot />
    </div>
  </li>
</template>
