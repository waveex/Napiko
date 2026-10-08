<script setup lang="ts">
const { summary, panelOpen } = useNotificationCenter()
const { t } = useI18n()
const count = computed(() => summary.value.unreadCount)
const label = computed(() => (count.value ? t('notifications.bellUnread', { count: count.value }) : t('notifications.title')))
</script>

<template>
  <UButton
    color="neutral"
    variant="ghost"
    square
    class="relative"
    :aria-label="label"
    :title="label"
    @click="panelOpen = true"
  >
    <UIcon
      :name="count ? 'i-lucide-bell-dot' : 'i-lucide-bell'"
      class="size-6"
    />
    <span
      v-if="count"
      class="napiko-bell-count"
      aria-hidden="true"
    >{{ count > 99 ? '99+' : count }}</span>
  </UButton>
</template>
