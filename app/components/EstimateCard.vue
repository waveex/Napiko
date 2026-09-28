<script setup lang="ts">
import type { EstimateItemCreateInput, EstimateItemUpdateInput } from '#shared/schemas'
import type { EstimateItemKind } from '#shared/workshop'

interface EstimateLine {
  id: string
  kind: EstimateItemKind
  name: string
  quantity: string
  unit: string
  unitPriceNet: string
  discountPercent: string
  vatRate: string
  source: 'manual' | 'price_list' | 'work_request'
  netCents: number
  vatCents: number
  grossCents: number
}

interface Estimate {
  items: EstimateLine[]
  totals: {
    netCents: number
    vatCents: number
    grossCents: number
    byRate: { vatRate: string, netCents: number, vatCents: number, grossCents: number }[]
  }
  approval: {
    id: string
    status: 'pending' | 'answered' | 'cancelled'
    decision: 'approved' | 'rejected' | null
    answeredAt: string | null
    createdAt: string
    customerNote: string | null
    totalGrossCents: number
    expired: boolean
    outdated: boolean
  } | null
}

const props = defineProps<{
  workOrderId: string
  estimate: Estimate
  canEdit: boolean
  closed: boolean
  customerEmail: string | null
  customerPhone: string | null
}>()
const emit = defineEmits<{
  /** odpowiedź API z aktualnym zleceniem */
  updated: [order: unknown]
  refresh: []
}>()

const { t, n, d } = useI18n()
const toast = useToast()

const editable = computed(() => props.canEdit && !props.closed)
const busy = ref(false)

async function call<T>(request: () => Promise<T>, success: string) {
  busy.value = true
  try {
    emit('updated', await request())
    toast.add({ title: success, color: 'success', icon: 'i-lucide-check' })
    return true
  }
  catch (error) {
    toast.add({ title: apiErrorMessage(error, t('common.error')), color: 'error' })
    return false
  }
  finally {
    busy.value = false
  }
}

// ── pozycje ──
const formOpen = ref(false)
const editing = ref<EstimateLine | null>(null)

function openNew() {
  editing.value = null
  formOpen.value = true
}
function openEdit(item: EstimateLine) {
  editing.value = item
  formOpen.value = true
}
async function create(body: EstimateItemCreateInput) {
  if (await call(() => $fetch(`/api/work-orders/${props.workOrderId}/estimate-items`, { method: 'POST', body }), t('estimate.added'))) {
    formOpen.value = false
  }
}
async function update(body: EstimateItemUpdateInput) {
  if (!editing.value) return
  const id = editing.value.id
  if (await call(() => $fetch(`/api/estimate-items/${id}`, { method: 'PATCH', body }), t('estimate.updated'))) {
    formOpen.value = false
  }
}

const removing = ref<EstimateLine | null>(null)
async function remove() {
  if (!removing.value) return
  const id = removing.value.id
  if (await call(() => $fetch(`/api/estimate-items/${id}`, { method: 'DELETE' }), t('estimate.removed'))) {
    removing.value = null
  }
}

function lineMeta(item: EstimateLine) {
  const parts = [t('estimate.lineMeta', {
    quantity: n(Number(item.quantity), { maximumFractionDigits: 3 }),
    unit: item.unit,
    price: n(Number(item.unitPriceNet), 'currency'),
  })]
  if (Number(item.discountPercent)) parts.push(t('estimate.lineDiscount', { discount: n(Number(item.discountPercent), { maximumFractionDigits: 2 }) }))
  parts.push(t('estimate.lineVat', { rate: Number(item.vatRate) }))
  const origin = t(`estimate.origin.${item.source}`)
  if (origin) parts.push(origin)
  return parts.join(' · ')
}

const kindColor = { labor: 'info', part: 'neutral', other: 'neutral' } as const

// ── akceptacja klienta ──
const sendOpen = ref(false)
const approval = computed(() => props.estimate.approval)
const pendingApproval = computed(() => approval.value?.status === 'pending' && !approval.value.expired)
const canSend = computed(() => editable.value && props.estimate.items.length > 0 && !pendingApproval.value)

async function cancelApproval() {
  if (!approval.value) return
  busy.value = true
  try {
    await $fetch(`/api/approvals/${approval.value.id}/cancel`, { method: 'POST' })
    emit('refresh')
    toast.add({ title: t('approvals.cancelled'), color: 'success', icon: 'i-lucide-ban' })
  }
  catch (error) {
    toast.add({ title: apiErrorMessage(error, t('common.error')), color: 'error' })
  }
  finally {
    busy.value = false
  }
}

const approvalAlert = computed(() => {
  const a = approval.value
  if (!a) return null
  if (a.status === 'pending' && a.expired) {
    return { color: 'neutral' as const, icon: 'i-lucide-clock-alert', title: t('estimate.state.expired'), description: undefined }
  }
  if (a.status === 'pending') {
    return {
      color: 'warning' as const,
      icon: 'i-lucide-hourglass',
      title: t('estimate.state.pending', { date: d(new Date(a.createdAt), 'long') }),
      description: a.outdated ? t('estimate.outdatedPending') : undefined,
    }
  }
  if (a.decision === 'approved') {
    return {
      color: a.outdated ? 'warning' as const : 'success' as const,
      icon: 'i-lucide-circle-check',
      title: t('estimate.state.approved', { date: d(new Date(a.answeredAt!), 'long') }),
      description: a.outdated
        ? `${t('estimate.outdatedApproved')} ${t('estimate.acceptedTotal', { total: n(a.totalGrossCents / 100, 'currency') })}`
        : undefined,
    }
  }
  return {
    color: 'error' as const,
    icon: 'i-lucide-circle-x',
    title: t('estimate.state.rejected', { date: d(new Date(a.answeredAt!), 'long') }),
    description: a.customerNote ? t('approvals.customerNote', { note: a.customerNote }) : undefined,
  }
})
</script>

<template>
  <UPageCard
    :title="$t('estimate.title')"
    :description="$t('estimate.description')"
  >
    <UAlert
      v-if="approvalAlert"
      :color="approvalAlert.color"
      variant="subtle"
      :icon="approvalAlert.icon"
      :title="approvalAlert.title"
      :description="approvalAlert.description"
      :actions="pendingApproval && editable
        ? [{ label: $t('approvals.cancel'), icon: 'i-lucide-ban', color: 'neutral', variant: 'outline', size: 'xs', loading: busy, onClick: cancelApproval }]
        : undefined"
    />

    <p
      v-if="!estimate.items.length"
      class="text-sm text-muted"
    >
      {{ $t('estimate.empty') }}
    </p>
    <ul
      v-else
      class="divide-y divide-default"
    >
      <li
        v-for="item in estimate.items"
        :key="item.id"
        class="flex items-start gap-3 py-3 first:pt-0"
      >
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              :color="kindColor[item.kind]"
              variant="subtle"
              size="sm"
              :label="$t(`estimate.kind.${item.kind}`)"
            />
            <span class="font-medium">{{ item.name }}</span>
          </div>
          <p class="text-xs text-muted">
            {{ lineMeta(item) }}
          </p>
        </div>
        <div class="shrink-0 text-end">
          <p class="font-medium tabular-nums">
            {{ n(item.grossCents / 100, 'currency') }}
          </p>
          <p class="text-xs text-muted tabular-nums">
            {{ $t('estimate.netShort', { value: n(item.netCents / 100, 'currency') }) }}
          </p>
        </div>
        <div
          v-if="editable"
          class="flex shrink-0 gap-1"
        >
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="$t('common.edit')"
            :disabled="busy"
            @click="openEdit(item)"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="$t('common.delete')"
            :disabled="busy"
            @click="removing = item"
          />
        </div>
      </li>
    </ul>

    <dl
      v-if="estimate.items.length"
      class="ms-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm"
    >
      <dt class="text-muted">
        {{ $t('estimate.netTotal') }}
      </dt>
      <dd class="text-end tabular-nums">
        {{ n(estimate.totals.netCents / 100, 'currency') }}
      </dd>
      <template
        v-for="row in estimate.totals.byRate"
        :key="row.vatRate"
      >
        <dt class="text-muted">
          {{ estimate.totals.byRate.length > 1 ? $t('estimate.vatByRate', { rate: row.vatRate }) : $t('estimate.vatTotal') }}
        </dt>
        <dd class="text-end tabular-nums">
          {{ n(row.vatCents / 100, 'currency') }}
        </dd>
      </template>
      <div class="col-span-2 my-1 border-t border-default" />
      <dt class="font-semibold">
        {{ $t('estimate.grossTotal') }}
      </dt>
      <dd class="text-end font-semibold tabular-nums">
        {{ n(estimate.totals.grossCents / 100, 'currency') }}
      </dd>
    </dl>

    <div
      v-if="editable"
      class="flex flex-wrap gap-2"
    >
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        :label="$t('estimate.add')"
        :disabled="busy"
        @click="openNew"
      />
      <UButton
        icon="i-lucide-send"
        :label="$t('estimate.send')"
        :disabled="!canSend || busy"
        @click="sendOpen = true"
      />
    </div>

    <UModal
      v-model:open="formOpen"
      :title="editing ? $t('estimate.editTitle') : $t('estimate.addTitle')"
    >
      <template #body>
        <EstimateItemForm
          :item="editing"
          :loading="busy"
          @create="create"
          @update="update"
          @cancel="formOpen = false"
        />
      </template>
    </UModal>

    <UModal
      :open="!!removing"
      :title="removing ? $t('estimate.removeConfirm', { name: removing.name }) : ''"
      @update:open="(open: boolean) => { if (!open) removing = null }"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('common.cancel')"
            @click="removing = null"
          />
          <UButton
            color="error"
            icon="i-lucide-trash-2"
            :loading="busy"
            :label="$t('common.delete')"
            @click="remove"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="sendOpen"
      :title="$t('estimate.sendTitle')"
    >
      <template #body>
        <ApprovalSendForm
          mode="estimate"
          :work-order-id="workOrderId"
          :requests="[]"
          :estimate-summary="{ count: estimate.items.length, totalGrossCents: estimate.totals.grossCents }"
          :customer-email="customerEmail"
          :customer-phone="customerPhone"
          @sent="emit('refresh')"
          @close="sendOpen = false"
        />
      </template>
    </UModal>
  </UPageCard>
</template>
