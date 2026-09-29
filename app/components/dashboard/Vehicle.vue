<script setup lang="ts">
import { VEHICLE_TYPE_INFO, type VehicleType } from '#shared/workshop'

/** Pojazd w zwartej postaci do list: ikona rodzaju, marka i model, numer rejestracyjny (albo seryjny). */
const props = defineProps<{
  vehicle: {
    type: VehicleType
    make: string | null
    model: string | null
    registrationNumber: string | null
    serialNumber?: string | null
  }
}>()

const { t } = useI18n()
const name = computed(() => [props.vehicle.make, props.vehicle.model].filter(Boolean).join(' ') || t(`vehicleType.${props.vehicle.type}`))
</script>

<template>
  <span class="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
    <UIcon
      :name="VEHICLE_TYPE_INFO[vehicle.type].icon"
      class="size-4 shrink-0 text-muted"
    />
    <span class="font-medium break-words">{{ name }}</span>
    <span
      v-if="vehicle.registrationNumber"
      class="rounded border border-default bg-elevated px-1.5 font-mono text-sm leading-5 tracking-wide break-all"
    >{{ vehicle.registrationNumber }}</span>
    <span
      v-else-if="vehicle.serialNumber"
      class="font-mono text-sm break-all text-muted"
    >{{ vehicle.serialNumber }}</span>
  </span>
</template>
