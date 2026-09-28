<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const view = ref<'open' | 'closed'>(route.query.view === 'closed' ? 'closed' : 'open')
watch(view, value => router.replace({ query: value === 'closed' ? { view: 'closed' } : {} }))

const { data, status, refresh, error } = await useFetch('/api/requests', { query: { view } })

const tabs = computed<TabsItem[]>(() => [
  { label: t('requests.viewOpen'), value: 'open', icon: 'i-lucide-inbox' },
  { label: t('requests.viewClosed'), value: 'closed', icon: 'i-lucide-archive' },
])
</script>

<template>
  <UDashboardPanel id="requests">
    <template #header>
      <UDashboardNavbar :title="$t('requests.title')" />
      <UDashboardToolbar>
        <template #left>
          <UTabs
            v-model="view"
            :items="tabs"
            :content="false"
            size="sm"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        icon="i-lucide-lock"
        :title="apiErrorMessage(error, $t('common.noAccess'))"
      />
      <div
        v-else
        class="grid w-full gap-4 xl:grid-cols-2"
      >
        <p class="text-base text-muted xl:col-span-2">
          {{ $t('requests.sectionHint') }}
        </p>
        <UEmpty
          v-if="data && !data.requests.length && status !== 'pending'"
          icon="i-lucide-check-check"
          :title="view === 'open' ? $t('requests.emptyOpen') : $t('requests.empty')"
        />
        <WorkRequestCard
          v-for="r in data?.requests ?? []"
          :key="r.id"
          :request="r"
          :permissions="data!.can"
          :attachments="r.attachments"
          @changed="refresh"
        >
          <template #context>
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-sm">
              <VehicleLabel :vehicle="r.vehicle" />
              <span class="text-muted">·</span>
              <ULink
                :to="`/app/orders/${r.order.id}`"
                class="font-mono text-xs"
              >
                {{ r.order.number }}
              </ULink>
              <span class="text-xs text-muted">· {{ r.customerName }}</span>
            </div>
          </template>
        </WorkRequestCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
