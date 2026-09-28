<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { z } from 'zod'
import type { servicePriceSchema } from '#shared/schemas'

const { t, n } = useI18n()
const toast = useToast()
const { data: me } = await useMe()

const canRead = computed(() => !!me.value?.activeOrganization?.can.readBilling)
const canEdit = computed(() => !!me.value?.activeOrganization?.can.updateBilling)

const search = ref('')
const query = useDebounced(search, 250)
const { data, refresh, status } = await useFetch('/api/price-list', {
  query: computed(() => ({ q: query.value || undefined })),
})

type Item = NonNullable<typeof data.value>['items'][number]

const categories = computed(() => [...new Set((data.value?.items ?? []).map(i => i.category).filter((c): c is string => !!c))])

function formatHours(value: string | null) {
  return value === null ? '' : n(Number(value), { maximumFractionDigits: 2 })
}

const columns = computed<TableColumn<Item>[]>(() => [
  { accessorKey: 'name', header: t('priceList.service') },
  { id: 'calculation', header: t('priceList.calculation') },
  { id: 'net', header: t('priceList.net'), meta: { class: { th: 'text-end', td: 'text-end' } } },
  { accessorKey: 'vatRate', header: t('priceList.vat'), meta: { class: { th: 'text-end', td: 'text-end' } } },
  { id: 'gross', header: t('priceList.gross'), meta: { class: { th: 'text-end', td: 'text-end' } } },
  // pusty nagłówek psuje hydratację tabeli (SSR nie tworzy pustego węzła tekstu) – stąd „Akcje”
  ...(canEdit.value ? [{ id: 'actions', header: t('common.actions'), meta: { class: { th: 'text-end', td: 'text-end' } } }] : []),
])

// ── formularz ──
const formOpen = ref(false)
const editing = ref<Item | null>(null)
const saving = ref(false)

function openNew() {
  editing.value = null
  formOpen.value = true
}
function openEdit(item: Item) {
  editing.value = item
  formOpen.value = true
}

async function save(body: z.output<typeof servicePriceSchema>) {
  saving.value = true
  try {
    if (editing.value) await $fetch(`/api/price-list/${editing.value.id}`, { method: 'PUT', body })
    else await $fetch('/api/price-list', { method: 'POST', body })
    formOpen.value = false
    await refresh()
    toast.add({ title: t('priceList.saved'), color: 'success', icon: 'i-lucide-check' })
  }
  catch (error) {
    toast.add({ title: apiErrorMessage(error, t('common.error')), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

// ── usuwanie (archiwizacja) ──
const archiving = ref<Item | null>(null)
async function archive() {
  if (!archiving.value) return
  try {
    await $fetch(`/api/price-list/${archiving.value.id}`, { method: 'DELETE' })
    archiving.value = null
    await refresh()
    toast.add({ title: t('priceList.archived'), color: 'success', icon: 'i-lucide-trash-2' })
  }
  catch (error) {
    toast.add({ title: apiErrorMessage(error, t('common.error')), color: 'error' })
  }
}

useHead({ title: () => t('priceList.title') })
</script>

<template>
  <UDashboardPanel id="price-list">
    <template #header>
      <UDashboardNavbar :title="$t('priceList.title')">
        <template #right>
          <UButton
            v-if="canEdit"
            icon="i-lucide-plus"
            :label="$t('priceList.add')"
            @click="openNew"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="!canRead"
        color="neutral"
        variant="subtle"
        icon="i-lucide-lock"
        :title="$t('common.noAccess')"
      />
      <template v-else>
        <p class="text-sm text-muted">
          {{ $t('priceList.description') }}
        </p>

        <UAlert
          v-if="data && !data.laborRateNet"
          color="warning"
          variant="subtle"
          icon="i-lucide-clock-alert"
          :title="$t('priceList.rateMissing')"
          :actions="[{ label: $t('priceList.rateLink'), to: '/app/settings', color: 'warning', variant: 'outline' }]"
        />
        <p
          v-else-if="data?.laborRateNet"
          class="text-sm"
        >
          {{ $t('priceList.rate', { rate: n(Number(data.laborRateNet), 'currency') }) }}
          <ULink
            to="/app/settings"
            class="text-primary"
          >
            {{ $t('common.edit') }}
          </ULink>
        </p>

        <UInput
          v-model="search"
          icon="i-lucide-search"
          :placeholder="$t('priceList.search')"
          class="w-full sm:max-w-sm"
        />

        <UTable
          :data="data?.items ?? []"
          :columns="columns"
          :loading="status === 'pending'"
          :empty="search ? $t('priceList.emptySearch') : $t('priceList.empty')"
          class="rounded-md border border-default"
        >
          <template #name-cell="{ row }">
            <div class="min-w-48 whitespace-normal">
              <p class="font-medium text-highlighted">
                {{ row.original.name }}
              </p>
              <p
                v-if="row.original.category || row.original.description"
                class="text-xs text-muted"
              >
                <span v-if="row.original.category">{{ row.original.category }}</span>
                <span v-if="row.original.category && row.original.description"> · </span>
                <span v-if="row.original.description">{{ row.original.description }}</span>
              </p>
            </div>
          </template>
          <template #calculation-cell="{ row }">
            <span class="text-sm text-muted">
              {{ row.original.pricing === 'hourly'
                ? $t('priceList.hours', { hours: formatHours(row.original.laborHours) })
                : $t('priceList.fixed') }}
            </span>
          </template>
          <template #net-cell="{ row }">
            <span class="block text-end tabular-nums">
              {{ row.original.netCents === null ? '—' : n(row.original.netCents / 100, 'currency') }}
            </span>
          </template>
          <template #vatRate-cell="{ row }">
            <span class="block text-end tabular-nums">{{ Number(row.original.vatRate) }}%</span>
          </template>
          <template #gross-cell="{ row }">
            <span class="block text-end font-medium tabular-nums">
              {{ row.original.grossCents === null ? '—' : n(row.original.grossCents / 100, 'currency') }}
            </span>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="$t('common.edit')"
                @click="openEdit(row.original)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="$t('common.delete')"
                @click="archiving = row.original"
              />
            </div>
          </template>
        </UTable>
      </template>

      <UModal
        v-model:open="formOpen"
        :title="editing ? $t('priceList.edit') : $t('priceList.add')"
      >
        <template #body>
          <ServicePriceForm
            :initial="editing"
            :labor-rate-net="data?.laborRateNet ?? null"
            :default-vat-rate="data?.defaultVatRate ?? '23'"
            :categories="categories"
            :loading="saving"
            @submit="save"
            @cancel="formOpen = false"
          />
        </template>
      </UModal>

      <UModal
        :open="!!archiving"
        :title="$t('priceList.archiveTitle')"
        :description="archiving ? $t('priceList.archiveConfirm', { name: archiving.name }) : undefined"
        @update:open="(open: boolean) => { if (!open) archiving = null }"
      >
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              :label="$t('common.cancel')"
              @click="archiving = null"
            />
            <UButton
              color="error"
              icon="i-lucide-trash-2"
              :label="$t('common.delete')"
              @click="archive"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
