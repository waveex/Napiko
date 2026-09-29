<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const { summary, markAllRead } = useNotificationCenter()

type Tab = 'list' | 'settings'
const tab = computed<Tab>({
  get: () => (route.query.tab === 'settings' ? 'settings' : 'list'),
  set: value => router.replace({ query: { ...route.query, tab: value === 'settings' ? 'settings' : undefined } }),
})
const filter = ref<'all' | 'unread'>('all')
const tabs = computed(() => [
  { value: 'list', label: t('notifications.tabs.list'), icon: 'i-lucide-bell' },
  { value: 'settings', label: t('notifications.tabs.settings'), icon: 'i-lucide-settings-2' },
])
const filters = computed(() => [
  { value: 'all', label: t('notifications.filterAll') },
  { value: 'unread', label: t('notifications.filterUnread') },
])

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

useHead({ title: () => t('notifications.title') })
</script>

<template>
  <UDashboardPanel id="notifications">
    <template #header>
      <UDashboardNavbar :title="$t('notifications.title')" />
    </template>

    <template #body>
      <div class="max-w-3xl space-y-6">
        <div class="oxy-intro">
          <h2>{{ $t('notifications.title') }}</h2>
          <p>{{ $t('notifications.intro') }}</p>
        </div>

        <UTabs
          v-model="tab"
          :items="tabs"
          :content="false"
          variant="link"
          class="w-full"
        />

        <section
          v-if="tab === 'list'"
          class="space-y-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <URadioGroup
              v-model="filter"
              :items="filters"
              orientation="horizontal"
              variant="table"
              :aria-label="$t('notifications.filterLabel')"
            />
            <UButton
              v-if="summary.unreadCount"
              color="neutral"
              variant="outline"
              icon="i-lucide-check-check"
              :loading="busy"
              :label="$t('notifications.markAllRead')"
              @click="readAll"
            />
          </div>
          <UAlert
            v-if="summary.unreadElsewhere"
            color="info"
            variant="subtle"
            icon="i-lucide-warehouse"
            :title="$t('notifications.elsewhere', { count: summary.unreadElsewhere })"
            :description="$t('notifications.elsewhereHint')"
          />
          <div class="oxy-surface p-2 sm:p-3">
            <NotificationList
              :filter="filter"
              :limit="30"
              paginate
            />
          </div>
        </section>

        <NotificationPreferences v-else />
      </div>
    </template>
  </UDashboardPanel>
</template>
