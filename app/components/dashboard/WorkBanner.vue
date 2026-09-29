<script setup lang="ts">
/**
 * Pulpit biura i właściciela – własna praca przy zadaniach w skrócie: trwający licznik z pauzą i zakończeniem
 * albo następne zadanie ze Startem. Pełny widok (zgłoszenia, zdjęcia) jest w „Moich zadaniach”.
 * Nie pokazuje się, gdy osoba nie ma przydzielonych zadań.
 */
import { formatClock } from '#shared/workshop'
import type { DashboardMine } from '~/composables/useDashboard'

const props = defineProps<{
  mine: DashboardMine
  now: number
  sinceFetch: number
  refresh: () => Promise<unknown>
}>()

const running = computed(() => props.mine.running)
/** Zadanie z licznikiem, a gdy licznik stoi – pierwsze z kolejki. */
const task = computed(() => props.mine.runningTask ?? (running.value ? null : props.mine.queue[0] ?? null))
const clock = computed(() => {
  if (!running.value) return null
  if (props.mine.runningTask) return formatClock(props.mine.runningTask.mySeconds + props.sinceFetch)
  return formatClock((props.now - new Date(running.value.startedAt).getTime()) / 1000)
})
const visible = computed(() => !!running.value || props.mine.counts.queue > 0 || props.mine.counts.waiting > 0)

const { busy, work } = useTaskWork(() => props.refresh())
</script>

<template>
  <section
    v-if="visible"
    class="oxy-surface flex flex-wrap items-center gap-x-4 gap-y-3 p-4"
    :class="{ 'oxy-surface-active': running }"
    :aria-label="$t('dashboard.work.title')"
  >
    <span
      class="grid size-10 shrink-0 place-items-center rounded-xl"
      :class="running ? 'bg-primary/10 text-primary' : 'bg-elevated text-muted'"
    >
      <UIcon
        :name="running ? 'i-lucide-timer' : 'i-lucide-wrench'"
        class="size-5"
      />
    </span>
    <div class="min-w-0 flex-1 basis-56">
      <p
        class="flex items-center gap-2 text-sm font-medium"
        :class="running ? 'text-primary' : 'text-muted'"
      >
        <span
          v-if="running"
          class="size-2 animate-pulse rounded-full bg-primary"
        />
        {{ running ? $t('myTasks.workingOn') : task ? $t('dashboard.work.nextUp') : $t('dashboard.work.yourTasks') }}
      </p>
      <template v-if="task">
        <p class="font-semibold break-words">
          {{ task.title }}
        </p>
        <p class="text-sm text-muted">
          <DashboardVehicle :vehicle="task.vehicle" /> · <span class="font-mono">{{ task.order.number }}</span>
        </p>
      </template>
      <p
        v-else-if="running"
        class="text-sm"
      >
        {{ $t('dashboard.work.runningElsewhere') }}
      </p>
      <p
        v-else
        class="text-sm"
      >
        {{ $t('dashboard.work.summary', { queue: mine.counts.queue, waiting: mine.counts.waiting }) }}
      </p>
    </div>
    <span
      v-if="clock"
      class="font-mono text-2xl font-semibold tabular-nums text-primary"
    >{{ clock }}</span>
    <div class="flex flex-wrap gap-2">
      <template v-if="mine.can.work && task">
        <template v-if="running">
          <UButton
            icon="i-lucide-pause"
            color="warning"
            variant="soft"
            :loading="busy === task.id"
            :disabled="!!busy"
            :label="$t('myTasks.pause')"
            @click="work(task.id, 'pause')"
          />
          <UButton
            icon="i-lucide-check"
            color="success"
            :loading="busy === task.id"
            :disabled="!!busy"
            :label="$t('myTasks.finish')"
            @click="work(task.id, 'finish')"
          />
        </template>
        <UButton
          v-else
          icon="i-lucide-play"
          :loading="busy === task.id"
          :disabled="!!busy"
          :label="task.status === 'paused' || task.status === 'in_progress' ? $t('myTasks.resume') : $t('myTasks.start')"
          @click="work(task.id, 'start')"
        />
      </template>
      <UButton
        v-if="running && !task"
        :to="`/app/orders/${running.workOrderId}`"
        color="neutral"
        variant="outline"
        :label="$t('dashboard.work.openOrder')"
      />
      <UButton
        to="/app/my-tasks"
        color="neutral"
        variant="outline"
        trailing-icon="i-lucide-arrow-right"
        :label="$t('dashboard.work.allTasks')"
      />
    </div>
  </section>
</template>
