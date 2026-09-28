<script setup lang="ts">
import type { EstimateItemCreateInput, EstimateItemUpdateInput } from '#shared/schemas'
import { ESTIMATE_UNITS, estimateLine, multiplyDecimals, VAT_RATES, type EstimateItemKind } from '#shared/workshop'

interface ExistingItem {
  kind: EstimateItemKind
  name: string
  quantity: string
  unit: string
  unitPriceNet: string
  discountPercent: string
  vatRate: string
}

const props = defineProps<{
  /** pozycja do edycji; brak = nowa pozycja */
  item?: ExistingItem | null
  defaultVatRate?: number
  loading?: boolean
}>()
const emit = defineEmits<{
  create: [data: EstimateItemCreateInput]
  update: [data: EstimateItemUpdateInput]
  cancel: []
}>()

const { t, n } = useI18n()
const editing = computed(() => !!props.item)

type Tab = 'price_list' | EstimateItemKind
const tab = ref<Tab>(props.item ? props.item.kind : 'price_list')
const tabs = computed(() => [
  { value: 'price_list', label: t('estimate.source.price_list'), icon: 'i-lucide-tags' },
  { value: 'part', label: t('estimate.source.part'), icon: 'i-lucide-package' },
  { value: 'labor', label: t('estimate.source.labor'), icon: 'i-lucide-wrench' },
  { value: 'other', label: t('estimate.source.other'), icon: 'i-lucide-ellipsis' },
])

// ── z cennika ──
const { data: priceList, status: priceStatus } = useFetch('/api/price-list', { server: false, lazy: true, immediate: !props.item })
const serviceId = ref<string | undefined>()
const count = ref<number>(1)
const serviceItems = computed(() => (priceList.value?.items ?? []).map(s => ({
  value: s.id,
  label: s.name,
  description: s.grossCents === null ? t('estimate.noRate') : `${n(s.grossCents / 100, 'currency')} ${t('approve.gross')}`,
  disabled: s.grossCents === null,
})))
const service = computed(() => priceList.value?.items.find(s => s.id === serviceId.value) ?? null)
const servicePreview = computed(() => {
  const s = service.value
  if (!s || !count.value) return null
  if (s.pricing === 'fixed') {
    return { quantity: String(count.value), unit: 'usł.', price: s.priceNet!, ...estimateLine({ quantity: count.value, unitPriceNet: s.priceNet!, discountPercent: 0, vatRate: s.vatRate }) }
  }
  const rate = priceList.value?.laborRateNet
  if (!rate) return null
  const quantity = multiplyDecimals(s.laborHours!, count.value, 3)
  return { quantity, unit: 'h', price: rate, ...estimateLine({ quantity, unitPriceNet: rate, discountPercent: 0, vatRate: s.vatRate }) }
})

// ── pozycja wpisana ręcznie ──
const name = ref(props.item?.name ?? '')
const quantity = ref<number | null>(props.item ? Number(props.item.quantity) : 1)
const unit = ref(props.item?.unit ?? 'szt.')
const unitPriceNet = ref<number | null>(props.item ? Number(props.item.unitPriceNet) : null)
const discountPercent = ref<number | null>(props.item ? Number(props.item.discountPercent) : 0)
const vatRate = ref<number>(props.item ? Number(props.item.vatRate) : (props.defaultVatRate ?? 23))

// Domyślna jednostka zależy od rodzaju pozycji (dopóki użytkownik sam jej nie zmienił)
const DEFAULT_UNIT: Record<EstimateItemKind, string> = { part: 'szt.', labor: 'h', other: 'usł.' }
const unitTouched = ref(!!props.item)
watch(tab, (next) => {
  if (!unitTouched.value && next !== 'price_list') unit.value = DEFAULT_UNIT[next]
}, { immediate: true })

const manualPreview = computed(() => {
  if (!quantity.value || unitPriceNet.value === null) return null
  return estimateLine({ quantity: quantity.value, unitPriceNet: unitPriceNet.value, discountPercent: discountPercent.value ?? 0, vatRate: vatRate.value })
})

const vatItems = VAT_RATES.map(rate => ({ value: rate as number, label: `${rate}%` }))
const money = { minimumFractionDigits: 2, maximumFractionDigits: 2 }
const qtyFormat = { maximumFractionDigits: 3 }

const valid = computed(() => {
  if (tab.value === 'price_list') return !!servicePreview.value
  return !!name.value.trim() && !!quantity.value && quantity.value > 0 && unitPriceNet.value !== null && !!unit.value.trim()
})

function submit() {
  if (!valid.value) return
  if (tab.value === 'price_list') {
    emit('create', { source: 'price_list', servicePriceId: serviceId.value!, count: count.value })
    return
  }
  const fields = {
    kind: tab.value,
    name: name.value.trim(),
    quantity: quantity.value!,
    unit: unit.value.trim(),
    unitPriceNet: unitPriceNet.value!,
    discountPercent: discountPercent.value ?? 0,
    vatRate: vatRate.value,
  }
  if (editing.value) emit('update', fields)
  else emit('create', { source: 'manual', ...fields })
}
</script>

<template>
  <form
    class="space-y-4"
    @submit.prevent="submit"
  >
    <UTabs
      v-if="!editing"
      v-model="tab"
      :items="tabs"
      :content="false"
      size="sm"
      class="w-full"
    />
    <UFormField
      v-else
      :label="$t('estimate.kindLabel')"
    >
      <USelect
        v-model="tab"
        :items="tabs.filter(x => x.value !== 'price_list')"
        class="w-48"
      />
    </UFormField>

    <!-- z cennika -->
    <template v-if="tab === 'price_list'">
      <div
        v-if="priceStatus === 'success' && !serviceItems.length"
        class="space-y-2 text-sm text-muted"
      >
        <p>{{ $t('estimate.noServices') }}</p>
        <UButton
          to="/app/price-list"
          size="sm"
          color="neutral"
          variant="outline"
          icon="i-lucide-tags"
          :label="$t('estimate.priceListLink')"
        />
      </div>
      <template v-else>
        <UFormField
          :label="$t('estimate.service')"
          required
        >
          <USelectMenu
            v-model="serviceId"
            :items="serviceItems"
            value-key="value"
            :loading="priceStatus === 'pending'"
            :placeholder="$t('estimate.servicePlaceholder')"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="$t('estimate.count')">
          <UInputNumber
            v-model="count"
            :min="1"
            :step="1"
            class="w-32"
          />
        </UFormField>
        <p
          v-if="service && service.pricing === 'hourly' && !priceList?.laborRateNet"
          class="text-sm text-warning"
        >
          {{ $t('estimate.noRate') }}
        </p>
        <p
          v-if="servicePreview"
          class="rounded-md bg-elevated p-3 text-sm font-medium"
        >
          <template v-if="service?.pricing === 'hourly'">
            {{ $t('estimate.hourlyPreview', {
              hours: n(Number(servicePreview.quantity), qtyFormat),
              rate: n(Number(servicePreview.price), 'currency'),
              net: n(servicePreview.netCents / 100, 'currency'),
            }) }}
            ·
          </template>
          {{ $t('estimate.value', { net: n(servicePreview.netCents / 100, 'currency'), gross: n(servicePreview.grossCents / 100, 'currency') }) }}
        </p>
      </template>
    </template>

    <!-- wpisana ręcznie -->
    <template v-else>
      <UFormField
        :label="$t('estimate.name')"
        required
      >
        <UInput
          v-model="name"
          :placeholder="$t(`estimate.namePlaceholder.${tab}`)"
          class="w-full"
          autofocus
        />
      </UFormField>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <UFormField
          :label="$t('estimate.quantity')"
          required
        >
          <UInputNumber
            v-model="quantity"
            :min="0.001"
            :step="1"
            :format-options="qtyFormat"
            class="w-full"
          />
        </UFormField>
        <UFormField
          :label="$t('estimate.unit')"
          required
        >
          <UInput
            v-model="unit"
            list="estimate-units"
            maxlength="10"
            class="w-full"
            @input="unitTouched = true"
          />
          <datalist id="estimate-units">
            <option
              v-for="u in ESTIMATE_UNITS"
              :key="u"
              :value="u"
            />
          </datalist>
        </UFormField>
        <UFormField
          :label="$t('estimate.unitPriceNet')"
          required
          class="col-span-2"
        >
          <UInputNumber
            v-model="unitPriceNet"
            :min="0"
            :step="0.01"
            :format-options="money"
            :increment="false"
            :decrement="false"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <UFormField :label="$t('estimate.discount')">
          <UInputNumber
            v-model="discountPercent"
            :min="0"
            :max="100"
            :step="1"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="$t('estimate.vatRate')">
          <USelect
            v-model="vatRate"
            :items="vatItems"
            class="w-full"
          />
        </UFormField>
      </div>
      <p
        v-if="manualPreview"
        class="rounded-md bg-elevated p-3 text-sm font-medium"
      >
        {{ $t('estimate.value', { net: n(manualPreview.netCents / 100, 'currency'), gross: n(manualPreview.grossCents / 100, 'currency') }) }}
      </p>
    </template>

    <div class="flex justify-end gap-2">
      <UButton
        color="neutral"
        variant="ghost"
        :label="$t('common.cancel')"
        @click="emit('cancel')"
      />
      <UButton
        type="submit"
        :disabled="!valid"
        :loading="props.loading"
        :label="editing ? $t('common.save') : $t('common.add')"
      />
    </div>
  </form>
</template>
