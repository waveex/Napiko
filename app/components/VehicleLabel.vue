<script setup lang="ts">
import { VEHICLE_TYPE_INFO, type VehicleType } from '#shared/workshop'

const props = withDefaults(defineProps<{
  vehicle: {
    type: VehicleType
    make: string | null
    model: string | null
    registrationNumber?: string | null
    serialNumber?: string | null
    year?: number | null
  }
  /** Pokaż numer rejestracyjny (albo seryjny, gdy pojazd nie ma tablic). */
  identifier?: boolean
}>(), { identifier: true })

const { t } = useI18n()

const title = computed(() =>
  [props.vehicle.make, props.vehicle.model].filter(Boolean).join(' ') || t(`vehicleType.${props.vehicle.type}`),
)
const plate = computed(() => props.vehicle.registrationNumber || null)
const serial = computed(() => (!plate.value ? props.vehicle.serialNumber : null) || null)
</script>

<template>
  <span class="inline-flex items-center gap-2 min-w-0">
    <UIcon
      :name="VEHICLE_TYPE_INFO[vehicle.type].icon"
      class="size-4 shrink-0 text-muted"
    />
    <span class="truncate">{{ title }}</span>
    <template v-if="identifier !== false">
      <span
        v-if="plate"
        class="shrink-0 rounded border border-default bg-elevated px-1.5 font-mono text-xs leading-5 tracking-wide"
      >{{ plate }}</span>
      <span
        v-else-if="serial"
        class="shrink-0 font-mono text-xs text-muted"
      >{{ serial }}</span>
    </template>
  </span>
</template>
