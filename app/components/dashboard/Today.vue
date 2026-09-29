<script setup lang="ts">
/** Pulpit biura – dzisiejszy dzień: odbiory zaplanowane na dziś, przyjęte i zamknięte zlecenia. */
import type { DashboardOffice } from '~/composables/useDashboard'

defineProps<{ today: DashboardOffice['today'] }>()

const { d } = useI18n()
</script>

<template>
  <article class="oxy-surface flex min-w-0 flex-col p-4">
    <h3 class="font-semibold">
      {{ $t('dashboard.today.title') }}
    </h3>
    <dl class="mt-3 grid grid-cols-3 gap-2">
      <div class="rounded-xl bg-elevated p-3">
        <dt class="text-sm text-muted">
          {{ $t('dashboard.today.due') }}
        </dt>
        <dd class="text-xl font-semibold">
          {{ today.due }}
        </dd>
      </div>
      <div class="rounded-xl bg-elevated p-3">
        <dt class="text-sm text-muted">
          {{ $t('dashboard.today.received') }}
        </dt>
        <dd class="text-xl font-semibold">
          {{ today.received }}
        </dd>
      </div>
      <div class="rounded-xl bg-elevated p-3">
        <dt class="text-sm text-muted">
          {{ $t('dashboard.today.closed') }}
        </dt>
        <dd class="text-xl font-semibold">
          {{ today.closed }}
        </dd>
      </div>
    </dl>
    <h4 class="mt-4 text-sm font-medium text-muted">
      {{ $t('dashboard.today.pickups') }}
    </h4>
    <ul
      v-if="today.orders.length"
      class="mt-1 divide-y divide-default"
    >
      <DashboardItem
        v-for="o in today.orders"
        :key="o.id"
        :to="`/app/orders/${o.id}`"
      >
        <span class="w-12 shrink-0 font-mono text-sm tabular-nums">{{ d(new Date(o.promisedAt!), 'time') }}</span>
        <div class="min-w-0 flex-1">
          <p><DashboardVehicle :vehicle="o.vehicle" /></p>
          <p class="text-sm text-muted">
            {{ o.customerName }}
          </p>
        </div>
        <StatusBadge
          kind="order"
          :status="o.status"
          class="shrink-0"
        />
      </DashboardItem>
    </ul>
    <p
      v-else
      class="mt-1 text-sm text-muted"
    >
      {{ $t('dashboard.today.noPickups') }}
    </p>
    <p
      v-if="today.due > today.orders.length"
      class="mt-2"
    >
      <UButton
        to="/app/orders"
        variant="link"
        trailing-icon="i-lucide-arrow-right"
        :label="$t('dashboard.attention.showBoard')"
        class="px-0"
      />
    </p>
  </article>
</template>
