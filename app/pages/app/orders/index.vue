<script setup lang="ts">
import type { TableColumn, TabsItem } from '@nuxt/ui'
import { BOARD_STATUSES } from '#shared/workshop'

const route = useRoute()
const router = useRouter()
const { t, d } = useI18n()
const { data: me } = await useMe()

const view = ref<'active' | 'archive'>(route.query.view === 'archive' ? 'archive' : 'active')
const mine = ref(route.query.mine === '1')
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const q = useDebounced(search)

watch([view, mine, q], () => {
  router.replace({
    query: {
      view: view.value === 'archive' ? 'archive' : undefined,
      mine: mine.value ? '1' : undefined,
      q: q.value || undefined,
    },
  })
})

const { data, status, error, refresh } = await useFetch('/api/work-orders', {
  query: computed(() => ({ view: view.value, mine: mine.value ? '1' : '0', q: q.value || undefined })),
})

type BoardStatus = (typeof BOARD_STATUSES)[number]
const toast = useToast()
const draggedId = ref<string | null>(null)
const dropTarget = ref<BoardStatus | null>(null)
const pendingMove = ref<{ id: string, status: BoardStatus } | null>(null)
const canDrag = computed(() => !!data.value?.can.update && !pendingMove.value && status.value !== 'pending')
const orders = computed(() => (data.value?.orders ?? []).map(order =>
  pendingMove.value?.id === order.id ? { ...order, status: pendingMove.value.status } : order,
))
const columns = computed(() => BOARD_STATUSES.map(s => ({ status: s, orders: orders.value.filter(o => o.status === s) })))
const mobileStatus = ref('all')
const mobileStatuses = computed(() => [
  { value: 'all', label: t('ui.allStatuses') },
  ...BOARD_STATUSES.map(value => ({ value, label: t(`workOrderStatus.${value}`) })),
])
const mobileOrders = computed(() => mobileStatus.value === 'all' ? orders.value : orders.value.filter(order => order.status === mobileStatus.value))
function clearFilters() {
  search.value = ''
  mine.value = false
  mobileStatus.value = 'all'
}

function endDrag() {
  draggedId.value = null
  dropTarget.value = null
}

function startDrag(event: DragEvent, id: string) {
  if (!canDrag.value || !event.dataTransfer) {
    event.preventDefault()
    return
  }
  draggedId.value = id
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', id)
}

function dragOver(event: DragEvent, target: BoardStatus) {
  if (!canDrag.value || !draggedId.value) return
  event.preventDefault()
  const order = orders.value.find(order => order.id === draggedId.value)
  const allowed = !!order && order.status !== target
  if (event.dataTransfer) event.dataTransfer.dropEffect = allowed ? 'move' : 'none'
  dropTarget.value = allowed ? target : null
}

function dragLeave(event: DragEvent) {
  const section = event.currentTarget as HTMLElement
  if (event.relatedTarget instanceof Node && section.contains(event.relatedTarget)) return
  dropTarget.value = null
}

async function dropOrder(event: DragEvent, target: BoardStatus) {
  event.preventDefault()
  const id = draggedId.value
  endDrag()
  const order = orders.value.find(order => order.id === id)
  if (!canDrag.value || !order || order.status === target) return

  pendingMove.value = { id: order.id, status: target }
  try {
    await $fetch(`/api/work-orders/${order.id}`, { method: 'PATCH', body: { status: target } })
    // Commit only the changed status; preserve the current search results.
    if (data.value) {
      data.value = {
        ...data.value,
        orders: data.value.orders.map(row => row.id === order.id ? { ...row, status: target } : row),
      }
    }
    toast.add({ title: t('orders.statusChanged'), color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    pendingMove.value = null
  }
}

watch([view, mine, q], endDrag)

const viewItems = computed<TabsItem[]>(() => [
  { label: t('orders.board'), value: 'active', icon: 'i-lucide-kanban' },
  { label: t('orders.archive'), value: 'archive', icon: 'i-lucide-archive' },
])

type Row = (typeof orders.value)[number]
const archiveColumns = computed<TableColumn<Row>[]>(() => [
  { accessorKey: 'number', header: t('orders.number') },
  { id: 'vehicle', header: t('orders.vehicle') },
  { id: 'customer', header: t('orders.customer'), accessorFn: row => row.customer.name },
  { accessorKey: 'status', header: t('orders.status') },
  {
    accessorKey: 'closedAt',
    header: t('orders.closedAt'),
    cell: ({ row }) => (row.original.closedAt ? d(new Date(row.original.closedAt), 'short') : ''),
  },
])

const canWork = computed(() => !!me.value?.activeOrganization?.can.workOnTasks)
</script>

<template>
  <UDashboardPanel id="orders">
    <template #header>
      <UDashboardNavbar :title="$t('orders.title')">
        <template #right>
          <UButton
            v-if="data?.can.create"
            to="/app/orders/new"
            icon="i-lucide-plus"
            :label="$t('orders.new')"
          />
        </template>
      </UDashboardNavbar>

      <!-- Telefon: zakładki i przełącznik w pierwszym wierszu, wyszukiwarka pod nimi -->
      <UDashboardToolbar :ui="{ root: 'flex-wrap gap-2 py-2' }">
        <UTabs
          v-model="view"
          :items="viewItems"
          :content="false"
          size="sm"
          class="order-1"
        />
        <USwitch
          v-if="canWork"
          v-model="mine"
          :label="$t('orders.mine')"
          class="order-2 ms-auto sm:order-3"
        />
        <UInput
          v-model="search"
          icon="i-lucide-search"
          :placeholder="$t('orders.searchPlaceholder')"
          :loading="status === 'pending'"
          class="order-3 w-full sm:order-2 sm:w-72"
        />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="oxy-intro">
        <h2>{{ $t('orders.title') }}</h2><p>{{ $t('ui.ordersHint') }}</p>
      </div>
      <LoadState
        :error="error"
        :pending="status === 'pending' && !data"
        @retry="refresh()"
      />
      <div
        v-if="view === 'active' && data"
        class="space-y-4 md:hidden"
      >
        <USelect
          v-model="mobileStatus"
          :items="mobileStatuses"
          :aria-label="$t('orders.status')"
          class="w-full"
        />
        <UEmpty
          v-if="!mobileOrders.length"
          :title="$t('ui.noResults')"
          icon="i-lucide-search"
        >
          <template #actions>
            <UButton
              color="neutral"
              variant="outline"
              :label="$t('ui.clearFilters')"
              @click="clearFilters"
            />
          </template>
        </UEmpty>
        <div
          v-for="order in mobileOrders"
          :key="order.id"
          class="space-y-2"
        >
          <StatusBadge
            kind="order"
            :status="order.status"
          />
          <WorkOrderCard :order="order" />
        </div>
      </div>
      <div
        v-if="view === 'active' && data"
        class="hidden min-h-0 gap-4 overflow-x-auto pb-2 md:flex"
      >
        <section
          v-for="col in columns"
          :key="col.status"
          class="flex min-h-64 min-w-80 flex-1 shrink-0 flex-col gap-4 rounded-2xl bg-elevated/50 p-3 transition-colors"
          :class="dropTarget === col.status ? 'bg-primary/10 ring-2 ring-primary ring-inset' : ''"
          :aria-label="$t(`workOrderStatus.${col.status}`)"
          :aria-busy="pendingMove?.status === col.status"
          @dragover="dragOver($event, col.status)"
          @dragleave="dragLeave"
          @drop="dropOrder($event, col.status)"
        >
          <header class="flex items-center justify-between">
            <StatusBadge
              kind="order"
              :status="col.status"
            />
            <span class="text-sm text-muted">{{ col.orders.length }}</span>
          </header>
          <WorkOrderCard
            v-for="order in col.orders"
            :key="order.id"
            :order="order"
            :draggable="canDrag"
            :class="{
              'cursor-grab active:cursor-grabbing': canDrag,
              'opacity-40': draggedId === order.id,
              'animate-pulse': pendingMove?.id === order.id,
            }"
            @dragstart="startDrag($event, order.id)"
            @dragend="endDrag"
          />
          <p
            v-if="!col.orders.length"
            class="rounded-lg border border-dashed border-default p-4 text-center text-sm text-muted"
          >
            {{ $t('orders.emptyColumn') }}
          </p>
        </section>
      </div>

      <UTable
        v-else-if="view === 'archive' && data"
        :data="orders"
        :columns="archiveColumns"
        :loading="status === 'pending'"
        :empty="$t('orders.emptyArchive')"
      >
        <template #number-cell="{ row }">
          <ULink
            :to="`/app/orders/${row.original.id}`"
            class="font-mono"
          >
            {{ row.original.number }}
          </ULink>
        </template>
        <template #vehicle-cell="{ row }">
          <VehicleLabel :vehicle="row.original.vehicle" />
        </template>
        <template #status-cell="{ row }">
          <StatusBadge
            kind="order"
            :status="row.original.status"
          />
        </template>
      </UTable>
    </template>
  </UDashboardPanel>
</template>
