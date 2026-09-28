<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { z } from 'zod'
import { vehicleSchema } from '#shared/schemas'
import { METER_UNITS, VEHICLE_TYPES, VEHICLE_TYPE_INFO } from '#shared/workshop'

const schema = vehicleSchema.omit({ customerId: true })
type State = z.input<typeof schema>
type Output = z.output<typeof schema>

const props = defineProps<{
  initial?: Partial<State>
  submitLabel: string
  loading?: boolean
}>()
const emit = defineEmits<{ submit: [data: Output], cancel: [] }>()

const { t } = useI18n()

const state = reactive<State>({
  type: 'car',
  make: null,
  model: null,
  year: null,
  registrationNumber: null,
  vin: null,
  serialNumber: null,
  meterUnit: 'km',
  meterValue: null,
  notes: null,
  ...props.initial,
})

const info = computed(() => VEHICLE_TYPE_INFO[state.type])

// Zmiana rodzaju podpowiada jednostkę licznika (auto – km, wózek widłowy – motogodziny, rower – brak).
watch(() => state.type, (type) => {
  state.meterUnit = VEHICLE_TYPE_INFO[type].meterUnit
})

const typeItems = computed(() => VEHICLE_TYPES.map(value => ({
  value,
  label: t(`vehicleType.${value}`),
  icon: VEHICLE_TYPE_INFO[value].icon,
})))
const meterItems = computed(() => METER_UNITS.map(value => ({ value, label: t(`meterUnitOption.${value}`) })))

const showRegistration = computed(() => info.value.registration || !!state.registrationNumber)
const identifierLabel = computed(() => info.value.identifier === 'frame' ? t('vehicles.frame') : t('vehicles.serial'))
const noGrouping = { useGrouping: false }

function onVin(value: string | null) {
  state.vin = value ? value.toUpperCase().replace(/\s/g, '') : null
}

function onSubmit(event: FormSubmitEvent<Output>) {
  emit('submit', event.data)
}
</script>

<template>
  <UForm
    :schema="schema"
    :state="state"
    class="space-y-4"
    @submit="onSubmit"
  >
    <UFormField
      name="type"
      :label="$t('vehicles.type')"
      required
    >
      <USelectMenu
        v-model="state.type"
        :items="typeItems"
        value-key="value"
        :icon="info.icon"
        class="w-full"
      />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        name="make"
        :label="$t('vehicles.make')"
      >
        <UInput
          v-model.nullable="state.make"
          autocomplete="off"
          class="w-full"
        />
      </UFormField>
      <UFormField
        name="model"
        :label="$t('vehicles.model')"
      >
        <UInput
          v-model.nullable="state.model"
          autocomplete="off"
          class="w-full"
        />
      </UFormField>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        name="year"
        :label="$t('vehicles.year')"
      >
        <UInputNumber
          v-model="state.year"
          :min="1900"
          :max="2100"
          :format-options="noGrouping"
          :increment="false"
          :decrement="false"
          class="w-full"
        />
      </UFormField>
      <UFormField
        v-if="showRegistration"
        name="registrationNumber"
        :label="$t('vehicles.registration')"
      >
        <UInput
          v-model.nullable="state.registrationNumber"
          autocomplete="off"
          class="w-full uppercase"
        />
      </UFormField>
    </div>

    <UFormField
      v-if="info.identifier === 'vin'"
      name="vin"
      :label="$t('vehicles.vin')"
      :help="$t('vehicles.vinHint')"
    >
      <UInput
        :model-value="state.vin ?? ''"
        maxlength="17"
        autocomplete="off"
        class="w-full font-mono"
        @update:model-value="v => onVin(String(v ?? '') || null)"
      />
    </UFormField>
    <UFormField
      v-else
      name="serialNumber"
      :label="identifierLabel"
    >
      <UInput
        v-model.nullable="state.serialNumber"
        autocomplete="off"
        class="w-full font-mono"
      />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        name="meterUnit"
        :label="$t('vehicles.meterUnit')"
      >
        <USelect
          v-model="state.meterUnit"
          :items="meterItems"
          class="w-full"
        />
      </UFormField>
      <UFormField
        v-if="state.meterUnit !== 'none'"
        name="meterValue"
        :label="`${$t('vehicles.meterValue')} (${$t(`meterUnit.${state.meterUnit}`)})`"
      >
        <UInputNumber
          v-model="state.meterValue"
          :min="0"
          :format-options="noGrouping"
          :increment="false"
          :decrement="false"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField
      name="notes"
      :label="$t('vehicles.notes')"
    >
      <UTextarea
        v-model.nullable="state.notes"
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
        :loading="loading"
        :label="submitLabel"
      />
    </div>
  </UForm>
</template>
