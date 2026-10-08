<script setup lang="ts">
import type { BadgeColor } from '#shared/workshop'
import type { NotificationRow } from '~/composables/useNotifications'

const props = defineProps<{ notification: NotificationRow }>()
defineEmits<{ open: [] }>()

const { locale, d, t } = useI18n()
const text = useNotificationText()
const content = computed(() => text(props.notification))
const unread = computed(() => !props.notification.readAt)
const note = computed(() => (typeof props.notification.data.note === 'string' ? props.notification.data.note : ''))
const created = computed(() => new Date(props.notification.createdAt))

/** stałe klasy (Tailwind nie widzi klas składanych dynamicznie) */
const tone: Record<BadgeColor, string> = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
  neutral: 'bg-elevated text-muted',
}
</script>

<template>
  <button
    type="button"
    class="napiko-notification"
    :class="{ 'napiko-notification-unread': unread }"
    :aria-label="`${content.title}. ${content.body}${unread ? ` (${t('notifications.unread')})` : ''}`"
    @click="$emit('open')"
  >
    <span
      class="grid size-10 shrink-0 place-items-center rounded-full"
      :class="tone[content.color]"
      aria-hidden="true"
    >
      <UIcon
        :name="content.icon"
        class="size-5"
      />
    </span>
    <span class="min-w-0 flex-1">
      <span class="flex items-start justify-between gap-3">
        <span class="font-semibold leading-snug">{{ content.title }}</span>
        <time
          class="shrink-0 pt-0.5 text-xs text-muted"
          :datetime="created.toISOString()"
          :title="d(created, 'long')"
        >{{ relativeTime(created, locale) }}</time>
      </span>
      <span class="mt-1 block text-sm text-muted break-words">{{ content.body }}</span>
      <span
        v-if="note"
        class="mt-1.5 block rounded-md border-s-4 border-default bg-elevated px-2 py-1 text-sm break-words"
      >{{ t('notifications.customerNote', { note }) }}</span>
    </span>
    <span
      v-if="unread"
      class="mt-2 size-2.5 shrink-0 rounded-full bg-primary"
      aria-hidden="true"
    />
  </button>
</template>
