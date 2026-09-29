<script setup lang="ts">
import type { NotificationRow } from '~/composables/useNotifications'

const props = withDefaults(defineProps<{
  filter?: 'all' | 'unread'
  limit?: number
  /** przycisk „Pokaż starsze” (pełna lista na stronie powiadomień) */
  paginate?: boolean
}>(), { filter: 'all', limit: 20, paginate: false })

const { open, version } = useNotificationCenter()

const items = ref<NotificationRow[]>([])
const cursor = ref<string | null>(null)
const loading = ref(false)
const failed = ref(false)

async function load(more = false) {
  loading.value = true
  failed.value = false
  try {
    const page = await $fetch('/api/notifications', {
      query: { filter: props.filter, limit: props.limit, ...(more && cursor.value ? { before: cursor.value } : {}) },
    })
    items.value = more ? [...items.value, ...(page.items as NotificationRow[])] : page.items as NotificationRow[]
    cursor.value = page.nextCursor
  }
  catch {
    failed.value = true
  }
  finally {
    loading.value = false
  }
}

watch(() => [props.filter, version.value], () => load(), { immediate: true })
</script>

<template>
  <div class="space-y-3">
    <LoadState
      :error="failed ? true : undefined"
      :pending="loading && !items.length"
      @retry="load()"
    />
    <UEmpty
      v-if="!loading && !failed && !items.length"
      :icon="filter === 'unread' ? 'i-lucide-check-check' : 'i-lucide-bell'"
      :title="filter === 'unread' ? $t('notifications.emptyUnread') : $t('notifications.empty')"
      :description="filter === 'unread' ? $t('notifications.emptyUnreadHint') : $t('notifications.emptyHint')"
    />
    <ul
      v-if="items.length"
      class="space-y-1"
    >
      <li
        v-for="n in items"
        :key="n.id"
      >
        <NotificationItem
          :notification="n"
          @open="open(n)"
        />
      </li>
    </ul>
    <UButton
      v-if="paginate && cursor"
      color="neutral"
      variant="outline"
      block
      icon="i-lucide-chevrons-down"
      :loading="loading"
      :label="$t('notifications.loadMore')"
      @click="load(true)"
    />
  </div>
</template>
