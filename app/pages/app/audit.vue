<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

const { t, d, te } = useI18n()

// Klucze tłumaczeń nie mogą zawierać kropek (vue-i18n traktuje je jako zagnieżdżenie).
function actionLabel(action: string) {
  const key = `audit.actions.${action.replace(/\./g, '_')}`
  return te(key) ? t(key) : action
}
const { data } = await useFetch('/api/audit', { query: { limit: 100 } })

type Row = NonNullable<typeof data.value>['events'][number]

const columns = computed<TableColumn<Row>[]>(() => [
  { accessorKey: 'seq', header: '#' },
  { accessorKey: 'createdAt', header: t('common.date'), cell: ({ row }) => d(new Date(row.original.createdAt), 'long') },
  {
    accessorKey: 'action',
    header: t('audit.event'),
    cell: ({ row }) => actionLabel(row.original.action),
  },
  { accessorKey: 'actorName', header: t('audit.actor'), cell: ({ row }) => row.original.actorName ?? t('audit.system') },
])
</script>

<template>
  <UDashboardPanel id="audit">
    <template #header>
      <UDashboardNavbar :title="$t('audit.title')">
        <template #right>
          <UBadge
            v-if="data"
            :color="data.chainIntact ? 'success' : 'error'"
            variant="subtle"
            :icon="data.chainIntact ? 'i-lucide-shield-check' : 'i-lucide-shield-alert'"
            :label="data.chainIntact ? $t('audit.chainOk') : $t('audit.chainBroken')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <p class="text-sm text-muted mb-4">
        {{ $t('audit.description') }}
      </p>
      <UTable
        :data="data?.events ?? []"
        :columns="columns"
        :empty="$t('audit.empty')"
      />
    </template>
  </UDashboardPanel>
</template>
