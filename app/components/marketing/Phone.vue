<script setup lang="ts">
/** Ramka telefonu na scenach marketingowych. Ekran zawsze jasny i w palecie kontekstu (warsztat / klient). */
withDefaults(defineProps<{ ctx?: 'workshop' | 'customer', time?: string }>(), { ctx: 'workshop', time: '9:41' })
</script>

<template>
  <div
    class="mk-phone mk-screen"
    :data-ctx="ctx"
  >
    <span class="mk-phone-notch" />
    <div class="mk-phone-status">
      <span>{{ time }}</span>
      <span class="flex items-center gap-1">
        <UIcon
          name="i-lucide-signal"
          class="size-3"
        />
        <UIcon
          name="i-lucide-wifi"
          class="size-3"
        />
        <UIcon
          name="i-lucide-battery-full"
          class="size-3.5"
        />
      </span>
    </div>
    <div class="mk-phone-body">
      <slot />
    </div>
  </div>
</template>
