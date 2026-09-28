<script setup lang="ts">
import type { z } from 'zod'
import type { customerSchema, vehicleSchema } from '#shared/schemas'

const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const { data: me } = await useMe()

const allowed = computed(() => !!me.value?.activeOrganization?.can.createOrders)

// ── 1. Klient ──
const customerId = ref<string | undefined>(typeof route.query.customerId === 'string' ? route.query.customerId : undefined)
const vehicleId = ref<string | undefined>(typeof route.query.vehicleId === 'string' ? route.query.vehicleId : undefined)

const searchTerm = ref('')
const q = useDebounced(searchTerm)
const { data: results, status: searchStatus } = await useFetch('/api/customers', {
  query: { q },
  default: () => [],
})

const { data: customer, refresh: refreshCustomer } = await useAsyncData(
  'new-order-customer',
  () => (customerId.value ? $fetch(`/api/customers/${customerId.value}`) : Promise.resolve(null)),
  { watch: [customerId] },
)

const customerItems = computed(() => {
  const items = results.value.map(c => ({
    value: c.id,
    label: c.name,
    description: [c.phone, t('customers.vehicleCount') + `: ${c.vehicleCount}`].filter(Boolean).join(' · '),
  }))
  // wybrany klient musi być na liście, nawet gdy nie pasuje do bieżącego wyszukiwania
  if (customer.value && !items.some(i => i.value === customer.value!.id)) {
    items.unshift({ value: customer.value.id, label: customer.value.name, description: customer.value.phone ?? '' })
  }
  return items
})

// Po zmianie klienta: jeśli ma jeden pojazd – wybieramy go, jeśli wybrany pojazd nie jest jego – czyścimy.
watch(customer, (c) => {
  if (!c) {
    vehicleId.value = undefined
    return
  }
  if (!c.vehicles.some(v => v.id === vehicleId.value)) {
    vehicleId.value = c.vehicles.length === 1 ? c.vehicles[0]!.id : undefined
  }
}, { immediate: true })

const customerModal = ref(false)
const vehicleModal = ref(false)
const saving = ref(false)

async function createCustomer(data: z.output<typeof customerSchema>) {
  saving.value = true
  try {
    const created = await $fetch('/api/customers', { method: 'POST', body: data })
    customerModal.value = false
    customerId.value = created.id
    toast.add({ title: t('customers.created'), color: 'success', icon: 'i-lucide-check' })
    vehicleModal.value = true
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

// ── 2. Pojazd ──
const vehicle = computed(() => customer.value?.vehicles.find(v => v.id === vehicleId.value) ?? null)

async function createVehicle(data: Omit<z.output<typeof vehicleSchema>, 'customerId'>) {
  if (!customerId.value) return
  saving.value = true
  try {
    const created = await $fetch('/api/vehicles', { method: 'POST', body: { ...data, customerId: customerId.value } })
    vehicleModal.value = false
    await refreshCustomer()
    vehicleId.value = created.id
    toast.add({ title: t('vehicles.created'), color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

// ── 3. Zakres prac ──
const description = ref('')
const meterValue = ref<number | null>(null)
const promisedAt = ref('')
const tasks = ref<string[]>([''])

watch(vehicle, () => {
  meterValue.value = null
})

function addTaskLine() {
  tasks.value.push('')
}
function removeTaskLine(index: number) {
  tasks.value.splice(index, 1)
  if (!tasks.value.length) tasks.value.push('')
}

const canSubmit = computed(() => !!customerId.value && !!vehicleId.value && !saving.value)

async function submit() {
  if (!customerId.value || !vehicleId.value) return
  saving.value = true
  try {
    const order = await $fetch('/api/work-orders', {
      method: 'POST',
      body: {
        customerId: customerId.value,
        vehicleId: vehicleId.value,
        description: description.value,
        meterValue: vehicle.value?.meterUnit === 'none' ? null : meterValue.value,
        promisedAt: fromDateTimeLocal(promisedAt.value),
        tasks: tasks.value.map(title => title.trim()).filter(Boolean),
      },
    })
    toast.add({ title: t('orders.created', { number: order.number }), color: 'success', icon: 'i-lucide-check' })
    await navigateTo(`/app/orders/${order.id}`)
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

const noGrouping = { useGrouping: false }
</script>

<template>
  <UDashboardPanel id="new-order">
    <template #header>
      <UDashboardNavbar :title="$t('orders.newTitle')">
        <template #leading>
          <UButton
            to="/app/orders"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            :aria-label="$t('common.back')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="!allowed"
        color="warning"
        variant="subtle"
        icon="i-lucide-lock"
        :title="$t('common.noAccess')"
      />

      <div
        v-else
        class="max-w-3xl space-y-6"
      >
        <UPageCard :title="`1. ${$t('orders.stepCustomer')}`">
          <div class="flex flex-col gap-3 sm:flex-row">
            <USelectMenu
              v-model="customerId"
              v-model:search-term="searchTerm"
              :items="customerItems"
              value-key="value"
              ignore-filter
              :loading="searchStatus === 'pending'"
              icon="i-lucide-user"
              :placeholder="$t('orders.selectCustomer')"
              :search-input="{ placeholder: $t('orders.searchCustomer') }"
              class="flex-1"
            />
            <UButton
              icon="i-lucide-user-plus"
              color="neutral"
              variant="outline"
              :label="$t('customers.new')"
              @click="customerModal = true"
            />
          </div>
        </UPageCard>

        <UPageCard
          :title="`2. ${$t('orders.stepVehicle')}`"
          :class="{ 'opacity-60': !customer }"
        >
          <template v-if="customer">
            <p
              v-if="!customer.vehicles.length"
              class="text-sm text-muted"
            >
              {{ $t('orders.noVehiclesForCustomer') }}
            </p>
            <URadioGroup
              v-else
              v-model="vehicleId"
              :items="customer.vehicles.map(v => ({ value: v.id, vehicle: v }))"
              variant="card"
              :legend="$t('orders.selectVehicle')"
              :ui="{ fieldset: 'flex-col gap-2', legend: 'text-sm font-normal text-muted mb-2' }"
            >
              <template #label="{ item }">
                <VehicleLabel :vehicle="item.vehicle" />
              </template>
              <template #description="{ item }">
                {{ $t(`vehicleType.${item.vehicle.type}`) }}<template v-if="item.vehicle.year">
                  · {{ item.vehicle.year }}
                </template>
              </template>
            </URadioGroup>
            <UButton
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              :label="$t('vehicles.new')"
              class="self-start justify-self-start"
              @click="vehicleModal = true"
            />
          </template>
          <p
            v-else
            class="text-sm text-muted"
          >
            {{ $t('orders.selectCustomer') }}
          </p>
        </UPageCard>

        <UPageCard
          :title="`3. ${$t('orders.stepScope')}`"
          :class="{ 'opacity-60': !vehicle }"
        >
          <UFormField :label="$t('orders.description')">
            <UTextarea
              v-model="description"
              :rows="3"
              autoresize
              :placeholder="$t('orders.descriptionPlaceholder')"
              class="w-full"
            />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField
              v-if="vehicle && vehicle.meterUnit !== 'none'"
              :label="`${$t('orders.meterValue')} (${$t(`meterUnit.${vehicle.meterUnit}`)})`"
            >
              <UInputNumber
                v-model="meterValue"
                :min="0"
                :format-options="noGrouping"
                :increment="false"
                :decrement="false"
                :placeholder="vehicle.meterValue !== null ? String(vehicle.meterValue) : undefined"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="$t('orders.promisedAt')">
              <UInput
                v-model="promisedAt"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField
            :label="$t('orders.initialTasks')"
            :help="$t('orders.initialTasksHint')"
          >
            <div class="space-y-2">
              <div
                v-for="(_, index) in tasks"
                :key="index"
                class="flex gap-2"
              >
                <UInput
                  v-model="tasks[index]"
                  :placeholder="$t('orders.taskPlaceholder')"
                  class="flex-1"
                  @keydown.enter.prevent="addTaskLine"
                />
                <UButton
                  icon="i-lucide-x"
                  color="neutral"
                  variant="ghost"
                  :aria-label="$t('common.delete')"
                  @click="removeTaskLine(index)"
                />
              </div>
              <UButton
                icon="i-lucide-plus"
                color="neutral"
                variant="ghost"
                size="sm"
                :label="$t('orders.addTaskLine')"
                @click="addTaskLine"
              />
            </div>
          </UFormField>
        </UPageCard>

        <div class="flex justify-end">
          <UButton
            size="lg"
            icon="i-lucide-clipboard-check"
            :disabled="!canSubmit"
            :loading="saving"
            :label="$t('orders.create')"
            @click="submit"
          />
        </div>
      </div>

      <UModal
        v-model:open="customerModal"
        :title="$t('customers.new')"
      >
        <template #body>
          <CustomerForm
            :submit-label="$t('common.save')"
            :loading="saving"
            @submit="createCustomer"
            @cancel="customerModal = false"
          />
        </template>
      </UModal>

      <UModal
        v-model:open="vehicleModal"
        :title="$t('vehicles.newTitle')"
      >
        <template #body>
          <VehicleForm
            :submit-label="$t('common.save')"
            :loading="saving"
            @submit="createVehicle"
            @cancel="vehicleModal = false"
          />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
