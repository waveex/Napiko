<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { z } from 'zod'
import { servicePriceSchema, type ServicePriceInput } from '#shared/schemas'
import { estimateLine, SERVICE_PRICINGS, VAT_RATES } from '#shared/workshop'

const props = defineProps<{
  initial?: {
    name: string
    description: string | null
    category: string | null
    pricing: 'fixed' | 'hourly'
    priceNet: string | null
    laborHours: string | null
    vatRate: string
  } | null
  laborRateNet: string | null
  defaultVatRate: string
  categories: string[]
  loading?: boolean
}>()
const emit = defineEmits<{
  submit: [data: z.output<typeof servicePriceSchema>]
  cancel: []
}>()

const { t, n } = useI18n()

const state = reactive<ServicePriceInput>({
  name: props.initial?.name ?? '',
  description: props.initial?.description ?? null,
  category: props.initial?.category ?? null,
  pricing: props.initial?.pricing ?? 'fixed',
  priceNet: props.initial?.priceNet ? Number(props.initial.priceNet) : null,
  laborHours: props.initial?.laborHours ? Number(props.initial.laborHours) : null,
  vatRate: Number(props.initial?.vatRate ?? props.defaultVatRate),
})

const pricingItems = computed(() => SERVICE_PRICINGS.map(value => ({
  value,
  label: t(`priceList.pricingOption.${value}`),
  description: t(`priceList.pricingHint.${value}`),
})))
const vatItems = VAT_RATES.map(rate => ({ value: rate as number, label: `${rate}%` }))
const money = { minimumFractionDigits: 2, maximumFractionDigits: 2 }
const hours = { minimumFractionDigits: 0, maximumFractionDigits: 2 }

/** Podgląd ceny tak, jak trafi do kosztorysu. */
const preview = computed(() => {
  const unitPriceNet = state.pricing === 'fixed' ? state.priceNet : props.laborRateNet
  const quantity = state.pricing === 'fixed' ? 1 : state.laborHours
  if (unitPriceNet === null || unitPriceNet === undefined || !quantity) return null
  return estimateLine({ quantity, unitPriceNet, discountPercent: 0, vatRate: state.vatRate })
})

function onSubmit(event: FormSubmitEvent<z.output<typeof servicePriceSchema>>) {
  emit('submit', event.data)
}
</script>

<template>
  <UForm
    :schema="servicePriceSchema"
    :state="state"
    class="space-y-4"
    @submit="onSubmit"
  >
    <UFormField
      :label="$t('priceList.name')"
      name="name"
      required
    >
      <UInput
        v-model="state.name"
        :placeholder="$t('priceList.namePlaceholder')"
        class="w-full"
        autofocus
      />
    </UFormField>

    <UFormField
      :label="$t('priceList.category')"
      name="category"
    >
      <UInput
        v-model.nullable="state.category"
        :placeholder="$t('priceList.categoryPlaceholder')"
        list="price-list-categories"
        class="w-full"
      />
      <datalist id="price-list-categories">
        <option
          v-for="c in props.categories"
          :key="c"
          :value="c"
        />
      </datalist>
    </UFormField>

    <UFormField
      :label="$t('priceList.pricing')"
      name="pricing"
    >
      <URadioGroup
        v-model="state.pricing"
        :items="pricingItems"
        variant="card"
        orientation="horizontal"
        :ui="{ fieldset: 'grid gap-2 sm:grid-cols-2' }"
      />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        v-if="state.pricing === 'fixed'"
        :label="$t('priceList.priceNet')"
        name="priceNet"
        required
      >
        <UInputNumber
          v-model="state.priceNet"
          :min="0"
          :step="0.01"
          :format-options="money"
          :increment="false"
          :decrement="false"
          class="w-full"
        />
      </UFormField>
      <UFormField
        v-else
        :label="$t('priceList.laborHours')"
        name="laborHours"
        required
      >
        <UInputNumber
          v-model="state.laborHours"
          :min="0"
          :step="0.25"
          :format-options="hours"
          class="w-full"
        />
      </UFormField>
      <UFormField
        :label="$t('priceList.vatRate')"
        name="vatRate"
      >
        <USelect
          v-model="state.vatRate"
          :items="vatItems"
          class="w-32"
        />
      </UFormField>
    </div>

    <p
      class="rounded-md bg-elevated p-3 text-sm"
      :class="preview ? 'font-medium' : 'text-muted'"
    >
      <template v-if="preview">
        {{ $t('priceList.preview', { net: n(preview.netCents / 100, 'currency'), gross: n(preview.grossCents / 100, 'currency') }) }}
      </template>
      <template v-else-if="state.pricing === 'hourly' && !props.laborRateNet">
        {{ $t('priceList.previewNoRate') }}
      </template>
      <template v-else>
        —
      </template>
    </p>

    <UFormField
      :label="$t('priceList.details')"
      name="description"
    >
      <UTextarea
        v-model.nullable="state.description"
        :rows="2"
        autoresize
        class="w-full"
      />
    </UFormField>

    <div class="flex justify-end gap-2">
      <UButton
        color="neutral"
        variant="ghost"
        :label="$t('common.cancel')"
        @click="emit('cancel')"
      />
      <UButton
        type="submit"
        :loading="props.loading"
        :label="$t('common.save')"
      />
    </div>
  </UForm>
</template>
