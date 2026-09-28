<script setup lang="ts">
import type { VehicleType, WorkOrderStatus } from '#shared/workshop'

const props = defineProps<{
  order: {
    id: string
    number: string
    status: WorkOrderStatus
    promisedAt: string | null
    vehicle: { type: VehicleType, make: string | null, model: string | null, registrationNumber: string | null }
    customer: { name: string }
    tasksTotal: number
    tasksDone: number
    openRequests?: number
    working?: number
    assignees: { id: string, name: string }[]
  }
}>()

const { d } = useI18n()

const overdue = computed(() =>
  !!props.order.promisedAt && props.order.status !== 'ready' && new Date(props.order.promisedAt).getTime() < Date.now(),
)
</script>

<template>
  <NuxtLink
    :to="`/app/orders/${order.id}`"
    class="block rounded-lg border border-default bg-default p-3 transition hover:border-accented hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-primary"
  >
    <div class="flex items-center justify-between gap-2 text-xs text-muted">
      <span class="font-mono">{{ order.number }}</span>
      <span
        v-if="order.promisedAt"
        class="inline-flex items-center gap-1"
        :class="overdue ? 'font-medium text-error' : ''"
      >
        <UIcon
          name="i-lucide-clock"
          class="size-3"
        />
        {{ d(new Date(order.promisedAt), 'long') }}
      </span>
    </div>

    <VehicleLabel
      :vehicle="order.vehicle"
      class="mt-2 max-w-full font-medium"
    />
    <p class="mt-1 truncate text-sm text-muted">
      {{ order.customer.name }}
    </p>

    <div
      v-if="order.tasksTotal"
      class="mt-3 flex items-center gap-2"
    >
      <UProgress
        :model-value="order.tasksDone"
        :max="order.tasksTotal"
        size="xs"
        class="flex-1"
      />
      <span class="text-xs text-muted">{{ order.tasksDone }}/{{ order.tasksTotal }}</span>
    </div>

    <div
      v-if="order.assignees.length || order.openRequests || order.working"
      class="mt-3 flex items-center justify-between gap-2"
    >
      <UAvatarGroup
        size="xs"
        :max="4"
      >
        <UAvatar
          v-for="a in order.assignees"
          :key="a.id"
          :alt="a.name"
          :title="a.name"
        />
      </UAvatarGroup>
      <div class="flex items-center gap-1.5">
        <span
          v-if="order.working"
          class="size-2 animate-pulse rounded-full bg-info"
          :title="$t('orders.workingNow')"
        />
        <UBadge
          v-if="order.openRequests"
          color="warning"
          variant="subtle"
          size="sm"
          icon="i-lucide-message-square-warning"
          :label="String(order.openRequests)"
          :title="$t('requests.title')"
        />
      </div>
    </div>
  </NuxtLink>
</template>
