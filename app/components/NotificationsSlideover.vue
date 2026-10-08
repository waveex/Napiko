<script setup lang="ts">
const { summary, panelOpen, markAllRead } = useNotificationCenter()
const { t } = useI18n()
const toast = useToast()
const busy = ref(false)

async function readAll() {
  busy.value = true
  try {
    await markAllRead()
  }
  catch (error) {
    toast.add({ title: apiErrorMessage(error, t('common.error')), color: 'error' })
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <USlideover
    v-model:open="panelOpen"
    :title="$t('notifications.title')"
    :description="summary.unreadCount ? $t('notifications.unreadCount', { count: summary.unreadCount }) : $t('notifications.allRead')"
    :ui="{
      overlay: 'z-40',
      content: 'z-50 max-w-md pt-[env(safe-area-inset-top)] pb-[var(--napiko-safe-bottom)]',
      header: 'pe-16 sm:pe-16',
      body: 'p-3 sm:p-4',
      footer: 'gap-2',
    }"
  >
    <template #body>
      <div class="space-y-4">
        <UButton
          v-if="summary.unreadCount"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-check-check"
          :loading="busy"
          :label="$t('notifications.markAllRead')"
          @click="readAll"
        />
        <UAlert
          v-if="summary.unreadElsewhere"
          color="info"
          variant="subtle"
          icon="i-lucide-warehouse"
          :title="$t('notifications.elsewhere', { count: summary.unreadElsewhere })"
          :description="$t('notifications.elsewhereHint')"
        />
        <NotificationList
          v-if="panelOpen"
          :limit="15"
        />
      </div>
    </template>
    <template #footer>
      <UButton
        to="/app/notifications"
        color="neutral"
        variant="outline"
        icon="i-lucide-list"
        class="flex-1 justify-center"
        :label="$t('notifications.showAll')"
        @click="panelOpen = false"
      />
      <UTooltip :text="$t('notifications.settings')">
        <UButton
          to="/app/notifications?tab=settings"
          color="neutral"
          variant="outline"
          icon="i-lucide-settings-2"
          :aria-label="$t('notifications.settings')"
          @click="panelOpen = false"
        />
      </UTooltip>
    </template>
  </USlideover>
</template>
