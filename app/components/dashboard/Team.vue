<script setup lang="ts">
/** Pulpit biura – zespół teraz: kto przy czym pracuje, czas pracy dziś i zadania w kolejce każdej osoby. */
import { formatClock, formatDuration } from '#shared/workshop'
import type { DashboardTeam } from '~/composables/useDashboard'

const props = defineProps<{ team: DashboardTeam, now: number, sinceFetch: number }>()

const working = computed(() => props.team.filter(p => p.running).length)
const runningFor = (startedAt: string) => formatClock((props.now - new Date(startedAt).getTime()) / 1000)
</script>

<template>
  <article class="napiko-surface flex min-w-0 flex-col p-4">
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <h3 class="font-semibold">
        {{ $t('dashboard.team.title') }}
      </h3>
      <span
        v-if="team.length"
        class="text-sm text-muted"
      >{{ $t('dashboard.team.working', { working, total: team.length }) }}</span>
    </header>
    <ul
      v-if="team.length"
      class="mt-2 divide-y divide-default"
    >
      <li
        v-for="person in team"
        :key="person.id"
        class="flex min-h-14 items-center gap-3 py-2"
      >
        <UChip
          :color="person.running ? 'success' : 'neutral'"
          position="bottom-right"
          inset
          :show="!!person.running"
        >
          <UAvatar
            :alt="person.name"
            size="md"
          />
        </UChip>
        <div class="min-w-0 flex-1">
          <p class="font-medium break-words">
            {{ person.name }}
          </p>
          <p
            v-if="person.running"
            class="text-sm"
          >
            <ULink
              :to="`/app/orders/${person.running.order.id}`"
              class="font-medium"
            >
              {{ person.running.task.title }}
            </ULink>
            <span class="text-muted"> · </span><DashboardVehicle :vehicle="person.running.vehicle" />
          </p>
          <p
            v-else
            class="text-sm text-muted"
          >
            {{ $t('dashboard.team.idle') }}
          </p>
        </div>
        <div class="shrink-0 text-end text-sm">
          <p
            v-if="person.running"
            class="font-mono font-semibold tabular-nums text-primary"
          >
            {{ runningFor(person.running.startedAt) }}
          </p>
          <p
            v-if="person.running || person.secondsToday"
            class="text-muted"
          >
            {{ $t('dashboard.team.today', { time: formatDuration(person.secondsToday + (person.running ? sinceFetch : 0)) }) }}
          </p>
          <p class="text-muted">
            {{ $t('dashboard.team.queue', { n: person.queue }) }}
          </p>
        </div>
      </li>
    </ul>
    <UEmpty
      v-else
      icon="i-lucide-users"
      :title="$t('dashboard.team.empty')"
      :description="$t('dashboard.team.emptyHint')"
      :actions="[{ label: $t('nav.team'), to: '/app/team', icon: 'i-lucide-user-plus', color: 'neutral', variant: 'outline' }]"
      variant="naked"
      class="mt-2"
    />
  </article>
</template>
