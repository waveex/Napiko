<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { z } from 'zod'
import type { customerSchema } from '#shared/schemas'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const { data: me } = await useMe()

const perms = computed(() => me.value?.activeOrganization?.can)

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const q = useDebounced(search)
watch(q, value => router.replace({ query: value ? { q: value } : {} }))

const { data: customers, status, error } = await useFetch('/api/customers', { query: { q }, default: () => [] })

type Row = (typeof customers.value)[number]
const columns = computed<TableColumn<Row>[]>(() => {
  const cols: TableColumn<Row>[] = [
    { accessorKey: 'name', header: t('customers.name') },
    { accessorKey: 'kind', header: t('customers.kind'), cell: ({ row }) => t(`customerKind.${row.original.kind}`) },
  ]
  if (perms.value?.readCustomerContact) {
    cols.push(
      { accessorKey: 'phone', header: t('customers.phone') },
      { accessorKey: 'email', header: t('customers.email') },
    )
  }
  cols.push({ accessorKey: 'vehicleCount', header: t('customers.vehicleCount') })
  return cols
})

const modal = ref(false)
const saving = ref(false)
async function create(data: z.output<typeof customerSchema>) {
  saving.value = true
  try {
    const created = await $fetch('/api/customers', { method: 'POST', body: data })
    modal.value = false
    toast.add({ title: t('customers.created'), color: 'success', icon: 'i-lucide-check' })
    await navigateTo(`/app/customers/${created.id}`)
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="customers">
    <template #header>
      <UDashboardNavbar :title="$t('customers.title')">
        <template #right>
          <UButton
            v-if="perms?.createCustomers"
            icon="i-lucide-user-plus"
            :label="$t('customers.new')"
            @click="modal = true"
          />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <template #left>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :loading="status === 'pending'"
            :placeholder="perms?.readCustomerContact ? $t('customers.searchPlaceholder') : $t('customers.searchPlaceholderLimited')"
            class="w-full sm:w-96"
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
      <UTable
        v-else
        :data="customers"
        :columns="columns"
        :loading="status === 'pending'"
        :empty="q ? $t('customers.noResults') : $t('customers.empty')"
        class="cursor-pointer"
        @select="(_event, row) => navigateTo(`/app/customers/${row.original.id}`)"
      >
        <template #name-cell="{ row }">
          <ULink
            :to="`/app/customers/${row.original.id}`"
            class="font-medium text-highlighted"
          >
            {{ row.original.name }}
          </ULink>
        </template>
      </UTable>

      <UModal
        v-model:open="modal"
        :title="$t('customers.new')"
      >
        <template #body>
          <CustomerForm
            :submit-label="$t('common.save')"
            :loading="saving"
            @submit="create"
            @cancel="modal = false"
          />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
