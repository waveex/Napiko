<script setup lang="ts">
/** Ramka okna przeglądarki (panel biura / właściciela) na scenach marketingowych. */
defineProps<{ url: string }>()
</script>

<template>
  <div
    class="mk-window mk-screen"
    data-ctx="workshop"
  >
    <div class="mk-window-bar">
      <span class="mk-window-dots"><i /><i /><i /></span>
      <span class="mk-window-url">
        <UIcon
          name="i-lucide-lock"
          class="size-3"
        />
        {{ url }}
      </span>
      <span class="ms-auto flex items-center gap-1.5">
        <slot name="bar" />
      </span>
    </div>
    <div class="mk-window-body">
      <slot />
    </div>
  </div>
</template>
