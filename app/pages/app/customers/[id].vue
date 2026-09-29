<script setup lang="ts">
import type { z } from 'zod'
import type { customerSchema, vehicleSchema } from '#shared/schemas'

const route = useRoute()
const id = route.params.id as string
const { t, d } = useI18n()
const toast = useToast()

const { data: customer, error, refresh } = await useFetch(`/api/customers/${id}`)
if (error.value || !customer.value) {
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage: error.value?.statusMessage ?? 'Not Found',
    fatal: true,
  })
}

const vehiclesById = computed(() => new Map((customer.value?.vehicles ?? []).map(v => [v.id, v])))

const editModal = ref(false)
const vehicleModal = ref(false)
const saving = ref(false)

const editInitial = computed(() => {
  const c = customer.value!
  return { kind: c.kind, name: c.name, taxId: c.taxId, email: c.email, phone: c.phone, notes: c.notes }
})

async function update(data: z.output<typeof customerSchema>) {
  saving.value = true
  try {
    await $fetch(`/api/customers/${id}`, { method: 'PATCH', body: data })
    await refresh()
    editModal.value = false
    toast.add({ title: t('customers.updated'), color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

async function addVehicle(data: Omit<z.output<typeof vehicleSchema>, 'customerId'>) {
  saving.value = true
  try {
    await $fetch('/api/vehicles', { method: 'POST', body: { ...data, customerId: id } })
    await refresh()
    vehicleModal.value = false
    toast.add({ title: t('vehicles.created'), color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

useHead({ title: () => customer.value?.name ?? t('customers.title') })
</script>

<template>
  <UDashboardPanel id="customer">
    <template #header>
      <UDashboardNavbar :title="customer?.name">
        <template #leading>
          <UButton
            to="/app/customers"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            :aria-label="$t('common.back')"
          />
        </template>
        <template #right>
          <UButton
            v-if="customer?.can.createWorkOrder"
            :to="{ path: '/app/orders/new', query: { customerId: id } }"
            icon="i-lucide-clipboard-plus"
            :label="$t('orders.new')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div
        v-if="customer"
        class="grid items-start gap-6 lg:grid-cols-3"
      >
        <div class="space-y-6">
          <UPageCard :title="$t('customers.data')">
            <dl class="grid grid-cols-1 text-sm [&>dd]:mb-2 [&>dt]:text-xs">
              <dt class="text-muted">
                {{ $t('customers.kind') }}
              </dt>
              <dd>{{ $t(`customerKind.${customer.kind}`) }}</dd>
              <template v-if="customer.can.seeContact">
                <dt class="text-muted">
                  {{ $t('customers.phone') }}
                </dt>
                <dd>
                  <ULink
                    v-if="customer.phone"
                    :href="`tel:${customer.phone}`"
                  >
                    {{ customer.phone }}
                  </ULink>
                  <span v-else>—</span>
                </dd>
                <dt class="text-muted">
                  {{ $t('customers.email') }}
                </dt>
                <dd class="break-all">
                  <ULink
                    v-if="customer.email"
                    :href="`mailto:${customer.email}`"
                  >
                    {{ customer.email }}
                  </ULink>
                  <span v-else>—</span>
                </dd>
                <template v-if="customer.taxId">
                  <dt class="text-muted">
                    {{ $t('customers.taxId') }}
                  </dt>
                  <dd>{{ customer.taxId }}</dd>
                </template>
              </template>
              <dt class="text-muted">
                {{ $t('customers.since') }}
              </dt>
              <dd>{{ d(new Date(customer.createdAt), 'short') }}</dd>
            </dl>
            <p
              v-if="customer.notes"
              class="whitespace-pre-line rounded-md bg-elevated p-3 text-sm"
            >
              {{ customer.notes }}
            </p>
            <p
              v-if="!customer.can.seeContact"
              class="text-sm text-muted"
            >
              {{ $t('customers.contactHidden') }}
            </p>
            <UButton
              v-if="customer.can.update"
              icon="i-lucide-pencil"
              color="neutral"
              variant="outline"
              size="sm"
              :label="$t('customers.edit')"
              class="self-start justify-self-start"
              @click="editModal = true"
            />
          </UPageCard>

          <CustomerNotificationConsent
            v-if="customer.can.seeContact"
            :customer="customer"
            :can-edit="customer.can.update"
            @changed="refresh()"
          />
        </div>

        <div class="space-y-6 lg:col-span-2">
          <UPageCard :title="$t('customers.vehicles')">
            <p
              v-if="!customer.vehicles.length"
              class="text-sm text-muted"
            >
              {{ $t('customers.noVehicles') }}
            </p>
            <ul
              v-else
              class="divide-y divide-default"
            >
              <li
                v-for="v in customer.vehicles"
                :key="v.id"
                class="flex items-center justify-between gap-4 py-2"
              >
                <ULink
                  :to="`/app/vehicles/${v.id}`"
                  class="min-w-0"
                >
                  <VehicleLabel :vehicle="v" />
                </ULink>
                <span class="shrink-0 text-sm text-muted">{{ $t(`vehicleType.${v.type}`) }}</span>
              </li>
            </ul>
            <UButton
              v-if="customer.can.addVehicle"
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              size="sm"
              :label="$t('vehicles.new')"
              class="self-start justify-self-start"
              @click="vehicleModal = true"
            />
          </UPageCard>

          <UPageCard :title="$t('customers.orders')">
            <p
              v-if="!customer.workOrders.length"
              class="text-sm text-muted"
            >
              {{ $t('customers.noOrders') }}
            </p>
            <ul
              v-else
              class="divide-y divide-default"
            >
              <li
                v-for="o in customer.workOrders"
                :key="o.id"
                class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <ULink
                    :to="`/app/orders/${o.id}`"
                    class="font-mono text-sm"
                  >
                    {{ o.number }}
                  </ULink>
                  <VehicleLabel
                    v-if="vehiclesById.get(o.vehicleId)"
                    :vehicle="vehiclesById.get(o.vehicleId)!"
                    :identifier="false"
                    class="text-sm"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-sm text-muted">{{ d(new Date(o.receivedAt), 'short') }}</span>
                  <StatusBadge
                    kind="order"
                    :status="o.status"
                    size="sm"
                  />
                </div>
              </li>
            </ul>
          </UPageCard>
        </div>
      </div>

      <UModal
        v-model:open="editModal"
        :title="$t('customers.editTitle')"
      >
        <template #body>
          <CustomerForm
            :initial="editInitial"
            :submit-label="$t('common.save')"
            :loading="saving"
            @submit="update"
            @cancel="editModal = false"
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
            @submit="addVehicle"
            @cancel="vehicleModal = false"
          />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
