<script setup lang="ts">
import { grossCents, toCents, VAT_RATES } from '#shared/workshop'

const props = defineProps<{
  initial?: { partsNet: string | null, laborNet: string | null, vatRate: string, officeNote: string | null }
  loading?: boolean
}>()
const emit = defineEmits<{
  submit: [data: { partsNet: number | null, laborNet: number | null, vatRate: number, officeNote: string | null }]
  cancel: []
}>()

const { n } = useI18n()

const partsNet = ref<number | null>(props.initial?.partsNet ? Number(props.initial.partsNet) : null)
const laborNet = ref<number | null>(props.initial?.laborNet ? Number(props.initial.laborNet) : null)
const vatRate = ref<number>(props.initial ? Number(props.initial.vatRate) : 23)
const officeNote = ref<string | null>(props.initial?.officeNote ?? null)

const vatItems = VAT_RATES.map(rate => ({ value: rate as number, label: `${rate}%` }))
const money = { minimumFractionDigits: 2, maximumFractionDigits: 2 }

const netCents = computed(() => toCents(partsNet.value) + toCents(laborNet.value))
const totalGross = computed(() => grossCents(partsNet.value, laborNet.value, vatRate.value))
const valid = computed(() => partsNet.value !== null || laborNet.value !== null)

function submit() {
  if (!valid.value) return
  emit('submit', { partsNet: partsNet.value, laborNet: laborNet.value, vatRate: vatRate.value, officeNote: officeNote.value || null })
}
</script>

<template>
  <form
    class="space-y-4"
    @submit.prevent="submit"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField :label="$t('requests.partsNet')">
        <UInputNumber
          v-model="partsNet"
          :min="0"
          :step="0.01"
          :format-options="money"
          :increment="false"
          :decrement="false"
          class="w-full"
          autofocus
        />
      </UFormField>
      <UFormField :label="$t('requests.laborNet')">
        <UInputNumber
          v-model="laborNet"
          :min="0"
          :step="0.01"
          :format-options="money"
          :increment="false"
          :decrement="false"
          class="w-full"
        />
      </UFormField>
    </div>
    <UFormField :label="$t('requests.vatRate')">
      <USelect
        v-model="vatRate"
        :items="vatItems"
        class="w-32"
      />
    </UFormField>
    <p class="rounded-md bg-elevated p-3 text-sm font-medium">
      {{ $t('requests.total', { net: n(netCents / 100, 'currency'), gross: n(totalGross / 100, 'currency') }) }}
    </p>
    <UFormField
      :label="$t('requests.officeNote')"
      :help="$t('requests.officeNoteHint')"
    >
      <UTextarea
        v-model.nullable="officeNote"
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
        :disabled="!valid"
        :loading="loading"
        :label="$t('requests.saveQuote')"
      />
    </div>
  </form>
</template>
