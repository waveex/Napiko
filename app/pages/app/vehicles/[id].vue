<script setup lang="ts">
import type { z } from 'zod'
import type { vehicleSchema } from '#shared/schemas'
import { VEHICLE_TYPE_INFO } from '#shared/workshop'

const route = useRoute()
const id = route.params.id as string
const { t, d, n } = useI18n()
const toast = useToast()
const { data: me } = await useMe()

const { data: vehicle, error, refresh } = await useFetch(`/api/vehicles/${id}`)
if (error.value || !vehicle.value) {
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage: error.value?.statusMessage ?? 'Not Found',
    fatal: true,
  })
}

const title = computed(() => {
  const v = vehicle.value
  if (!v) return ''
  return [v.make, v.model].filter(Boolean).join(' ') || t(`vehicleType.${v.type}`)
})

const identifierLabel = computed(() => {
  const kind = vehicle.value ? VEHICLE_TYPE_INFO[vehicle.value.type].identifier : 'serial'
  return kind === 'frame' ? t('vehicles.frame') : t('vehicles.serial')
})

const editModal = ref(false)
const saving = ref(false)

const editInitial = computed(() => {
  const v = vehicle.value!
  return {
    type: v.type,
    make: v.make,
    model: v.model,
    year: v.year,
    registrationNumber: v.registrationNumber,
    vin: v.vin,
    serialNumber: v.serialNumber,
    meterUnit: v.meterUnit,
    meterValue: v.meterValue,
    notes: v.notes,
  }
})

async function update(data: Omit<z.output<typeof vehicleSchema>, 'customerId'>) {
  saving.value = true
  try {
    await $fetch(`/api/vehicles/${id}`, { method: 'PATCH', body: data })
    await refresh()
    editModal.value = false
    toast.add({ title: t('vehicles.updated'), color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

useHead({ title: () => title.value })
</script>

<template>
  <UDashboardPanel id="vehicle">
    <template #header>
      <UDashboardNavbar :title="title">
        <template #leading>
          <UButton
            :to="vehicle?.customer && me?.activeOrganization?.can.readCustomers ? `/app/customers/${vehicle.customer.id}` : '/app/orders'"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            :aria-label="$t('common.back')"
          />
        </template>
        <template #trailing>
          <span
            v-if="vehicle?.registrationNumber"
            class="rounded border border-default bg-elevated px-1.5 font-mono text-xs leading-5 tracking-wide"
          >{{ vehicle.registrationNumber }}</span>
        </template>
        <template #right>
          <UButton
            v-if="vehicle?.can.createWorkOrder"
            :to="{ path: '/app/orders/new', query: { customerId: vehicle.customerId, vehicleId: id } }"
            icon="i-lucide-clipboard-plus"
            :label="$t('orders.new')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div
        v-if="vehicle"
        class="grid gap-6 lg:grid-cols-3"
      >
        <div class="space-y-6">
          <UPageCard :title="$t('vehicles.data')">
            <dl class="grid grid-cols-1 text-sm [&>dd]:mb-2 [&>dt]:text-xs">
              <dt class="text-muted">
                {{ $t('vehicles.type') }}
              </dt>
              <dd class="flex items-center gap-2">
                <UIcon
                  :name="VEHICLE_TYPE_INFO[vehicle.type].icon"
                  class="size-4 text-muted"
                />
                {{ $t(`vehicleType.${vehicle.type}`) }}
              </dd>
              <template v-if="vehicle.year">
                <dt class="text-muted">
                  {{ $t('vehicles.year') }}
                </dt>
                <dd>{{ vehicle.year }}</dd>
              </template>
              <template v-if="vehicle.vin">
                <dt class="text-muted">
                  {{ $t('vehicles.vin') }}
                </dt>
                <dd class="break-all font-mono">
                  {{ vehicle.vin }}
                </dd>
              </template>
              <template v-if="vehicle.serialNumber">
                <dt class="text-muted">
                  {{ identifierLabel }}
                </dt>
                <dd class="break-all font-mono">
                  {{ vehicle.serialNumber }}
                </dd>
              </template>
              <template v-if="vehicle.meterUnit !== 'none' && vehicle.meterValue !== null">
                <dt class="text-muted">
                  {{ $t('vehicles.meterValue') }}
                </dt>
                <dd>{{ n(vehicle.meterValue) }} {{ $t(`meterUnit.${vehicle.meterUnit}`) }}</dd>
              </template>
            </dl>
            <p
              v-if="vehicle.notes"
              class="whitespace-pre-line rounded-md bg-elevated p-3 text-sm"
            >
              {{ vehicle.notes }}
            </p>
            <UButton
              v-if="vehicle.can.update"
              icon="i-lucide-pencil"
              color="neutral"
              variant="outline"
              size="sm"
              :label="$t('vehicles.edit')"
              class="self-start justify-self-start"
              @click="editModal = true"
            />
          </UPageCard>

          <UPageCard
            v-if="vehicle.customer"
            :title="$t('vehicles.owner')"
          >
            <p class="font-medium">
              {{ vehicle.customer.name }}
            </p>
            <p
              v-if="vehicle.customer.phone"
              class="text-sm"
            >
              <ULink :href="`tel:${vehicle.customer.phone}`">
                {{ vehicle.customer.phone }}
              </ULink>
            </p>
            <UButton
              v-if="me?.activeOrganization?.can.readCustomers"
              :to="`/app/customers/${vehicle.customer.id}`"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-user"
              :label="$t('common.details')"
              class="self-start justify-self-start"
            />
          </UPageCard>
        </div>

        <UPageCard
          :title="$t('vehicles.history')"
          class="lg:col-span-2"
        >
          <p
            v-if="!vehicle.workOrders.length"
            class="text-sm text-muted"
          >
            {{ $t('vehicles.noHistory') }}
          </p>
          <ol
            v-else
            class="space-y-4"
          >
            <li
              v-for="o in vehicle.workOrders"
              :key="o.id"
              class="border-s-2 border-default ps-4"
            >
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <ULink
                  :to="`/app/orders/${o.id}`"
                  class="font-mono text-sm"
                >
                  {{ o.number }}
                </ULink>
                <span class="text-sm text-muted">{{ d(new Date(o.receivedAt), 'short') }}</span>
                <StatusBadge
                  kind="order"
                  :status="o.status"
                  size="sm"
                />
                <span
                  v-if="o.meterValue !== null && vehicle.meterUnit !== 'none'"
                  class="text-sm text-muted"
                >{{ n(o.meterValue) }} {{ $t(`meterUnit.${vehicle.meterUnit}`) }}</span>
              </div>
              <p
                v-if="o.description"
                class="mt-1 line-clamp-2 text-sm"
              >
                {{ o.description }}
              </p>
            </li>
          </ol>
        </UPageCard>
      </div>

      <UModal
        v-model:open="editModal"
        :title="$t('vehicles.editTitle')"
      >
        <template #body>
          <VehicleForm
            :initial="editInitial"
            :submit-label="$t('common.save')"
            :loading="saving"
            @submit="update"
            @cancel="editModal = false"
          />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
