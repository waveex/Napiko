<script setup lang="ts">
/**
 * Pulpit mechanika – praca przy zadaniach: bieżące zadanie z licznikiem i przyciskami (jak w „Moich zadaniach”),
 * a gdy licznik stoi – następne zadanie ze Startem. Obok czas pracy dziś, dalsza kolejka i zgłoszone potrzeby.
 */
import type { z } from 'zod'
import type { workRequestCreateSchema } from '#shared/schemas'
import { formatDuration, TASK_STATUS_ICON, URGENCY_COLOR, WORK_REQUEST_STATUS_COLOR } from '#shared/workshop'
import type { DashboardMine } from '~/composables/useDashboard'

const props = defineProps<{
  mine: DashboardMine
  /** bieżący czas (ms, zegar serwera) */
  now: number
  /** sekundy od pobrania danych – dodajemy je do czasów, żeby liczniki szły na żywo */
  sinceFetch: number
  refresh: () => Promise<unknown>
}>()

const { d, locale } = useI18n()

type Task = DashboardMine['queue'][number]

const running = computed(() => props.mine.running)
const runningTask = computed(() => props.mine.runningTask)
/** Najważniejsze zadanie: to, nad którym trwa praca, a gdy licznik stoi – pierwsze z kolejki. */
const hero = computed<Task | null>(() => runningTask.value ?? (running.value ? null : props.mine.queue[0] ?? null))
/** Dalej: zadania do zrobienia, a po nich te, które czekają na część albo decyzję klienta. */
const later = computed(() => [...props.mine.queue, ...props.mine.waiting].filter(task => task.id !== hero.value?.id).slice(0, 4))
const liveSeconds = computed(() => (runningTask.value ? runningTask.value.mySeconds + props.sinceFetch : null))
const secondsToday = computed(() => props.mine.secondsToday + (running.value ? props.sinceFetch : 0))
const runningFor = computed(() => (running.value ? (props.now - new Date(running.value.startedAt).getTime()) / 1000 : 0))
const runningLong = computed(() => runningFor.value > 10 * 3600)
const waitingStatus = (task: Task) => task.status === 'waiting_parts' || task.status === 'waiting_approval'

const overdue = (task: Task) => !!task.order.promisedAt && new Date(task.order.promisedAt).getTime() < props.now
const ago = (date: string) => formatRelative(date, props.now, locale.value)
const dotClass: Record<string, string> = { error: 'bg-error', warning: 'bg-warning', success: 'bg-success' }

const { busy, work } = useTaskWork(() => props.refresh())

// ── zgłoszenie potrzeby przy zadaniu ──
const reportFor = ref<Task | null>(null)
const reportOpen = computed({
  get: () => !!reportFor.value,
  set: (value) => {
    if (!value) reportFor.value = null
  },
})
const { saving: reporting, submit: submitNeed } = useReportNeed()
async function sendNeed(input: z.output<typeof workRequestCreateSchema>, files: File[]) {
  if (!reportFor.value) return
  if (await submitNeed(reportFor.value.order.id, input, files)) {
    reportFor.value = null
    await props.refresh()
  }
}
</script>

<template>
  <DashboardSection
    :title="$t('dashboard.work.title')"
    :description="$t('dashboard.work.description')"
  >
    <template #actions>
      <UButton
        to="/app/my-tasks"
        color="neutral"
        variant="outline"
        trailing-icon="i-lucide-arrow-right"
        :label="$t('dashboard.work.allTasks')"
      />
    </template>

    <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div class="min-w-0 space-y-3">
        <p
          v-if="runningTask"
          class="flex items-center gap-2 text-sm font-medium text-primary"
        >
          <span class="size-2 animate-pulse rounded-full bg-primary" />
          {{ $t('myTasks.workingOn') }}
        </p>
        <p
          v-else-if="hero"
          class="text-sm font-medium text-muted"
        >
          {{ $t('dashboard.work.nextUp') }}
        </p>
        <UAlert
          v-if="runningLong"
          color="warning"
          variant="subtle"
          icon="i-lucide-alarm-clock"
          :title="$t('myTasks.longRunning', { time: formatDuration(runningFor) })"
        />
        <MyTaskCard
          v-if="hero"
          :task="hero"
          :live-seconds="hero.id === runningTask?.id ? liveSeconds : null"
          mode="mine"
          :can-work="mine.can.work"
          :can-report="mine.can.reportNeeds"
          :can-upload="mine.can.uploadFiles"
          :busy="!!busy"
          @work="action => work(hero!.id, action)"
          @report="reportFor = hero"
          @uploaded="refresh()"
        />
        <UAlert
          v-else-if="running"
          color="info"
          variant="subtle"
          icon="i-lucide-timer"
          :title="$t('dashboard.work.runningElsewhere')"
          :actions="[{ label: $t('dashboard.work.openOrder'), to: `/app/orders/${running.workOrderId}`, color: 'neutral', variant: 'outline' }]"
        />
        <UEmpty
          v-else-if="mine.counts.waiting"
          icon="i-lucide-hourglass"
          :title="$t('dashboard.work.allWaiting')"
          :description="$t('dashboard.work.allWaitingHint')"
        />
        <UEmpty
          v-else
          icon="i-lucide-clipboard-check"
          :title="$t('myTasks.empty')"
          :description="mine.counts.available ? $t('dashboard.work.availableHint', { n: mine.counts.available }) : $t('myTasks.emptyHint')"
          :actions="mine.counts.available ? [{ label: $t('dashboard.work.showAvailable'), to: '/app/my-tasks', icon: 'i-lucide-hand' }] : undefined"
        />
      </div>

      <div class="min-w-0 space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <DashboardStat
            :label="$t('dashboard.work.timeToday')"
            :value="formatDuration(secondsToday)"
            icon="i-lucide-timer"
            tone="primary"
          />
          <DashboardStat
            :label="$t('myTasks.doneToday')"
            :value="String(mine.counts.doneToday)"
            icon="i-lucide-circle-check"
            tone="success"
          />
          <DashboardStat
            :label="$t('dashboard.work.queue')"
            :value="String(mine.counts.queue)"
            icon="i-lucide-list-todo"
            to="/app/my-tasks"
          />
          <DashboardStat
            :label="$t('dashboard.work.waiting')"
            :value="String(mine.counts.waiting)"
            icon="i-lucide-hourglass"
            :tone="mine.counts.waiting ? 'warning' : 'neutral'"
            to="/app/my-tasks"
          />
        </div>

        <div
          v-if="later.length"
          class="oxy-surface p-4"
        >
          <h3 class="font-semibold">
            {{ $t('dashboard.work.later') }}
          </h3>
          <ul class="mt-1 divide-y divide-default">
            <DashboardItem
              v-for="task in later"
              :key="task.id"
              to="/app/my-tasks"
            >
              <UIcon
                :name="TASK_STATUS_ICON[task.status]"
                class="size-5 shrink-0"
                :class="waitingStatus(task) ? 'text-warning' : 'text-muted'"
              />
              <div class="min-w-0 flex-1">
                <p class="font-medium break-words">
                  {{ task.title }}
                </p>
                <p class="text-sm text-muted">
                  <DashboardVehicle :vehicle="task.vehicle" />
                </p>
              </div>
              <StatusBadge
                v-if="waitingStatus(task)"
                kind="task"
                :status="task.status"
                class="shrink-0"
              />
              <span
                v-else-if="task.order.promisedAt"
                class="shrink-0 text-end text-sm"
                :class="overdue(task) ? 'font-medium text-error' : 'text-muted'"
              >{{ d(new Date(task.order.promisedAt), 'long') }}</span>
            </DashboardItem>
          </ul>
        </div>

        <div
          v-if="mine.requests.length"
          class="oxy-surface p-4"
        >
          <h3 class="font-semibold">
            {{ $t('dashboard.work.myRequests') }}
          </h3>
          <p class="text-sm text-muted">
            {{ $t('dashboard.work.myRequestsHint') }}
          </p>
          <ul class="mt-1 divide-y divide-default">
            <DashboardItem
              v-for="r in mine.requests"
              :key="r.id"
              :to="`/app/orders/${r.order.id}`"
            >
              <span
                class="size-2.5 shrink-0 rounded-full"
                :class="dotClass[URGENCY_COLOR[r.urgency]]"
                :title="$t(`urgency.${r.urgency}`)"
              />
              <span class="sr-only">{{ $t(`urgency.${r.urgency}`) }}</span>
              <div class="min-w-0 flex-1">
                <p class="font-medium break-words">
                  {{ r.title }}
                </p>
                <p class="text-sm text-muted">
                  <DashboardVehicle :vehicle="r.vehicle" /><span class="whitespace-nowrap"> · {{ ago(r.updatedAt) }}</span>
                </p>
              </div>
              <UBadge
                :color="WORK_REQUEST_STATUS_COLOR[r.status]"
                variant="subtle"
                size="md"
                :label="$t(`requestStatus.${r.status}`)"
                class="shrink-0"
              />
            </DashboardItem>
          </ul>
        </div>

        <UAlert
          v-if="mine.counts.available && (hero || running || mine.counts.waiting)"
          color="neutral"
          variant="outline"
          icon="i-lucide-hand"
          :title="$t('dashboard.work.available', { n: mine.counts.available })"
          :description="$t('myTasks.availableHint')"
          :actions="[{ label: $t('dashboard.work.showAvailable'), to: '/app/my-tasks', color: 'neutral', variant: 'outline' }]"
        />
      </div>
    </div>

    <UModal
      v-model:open="reportOpen"
      :title="$t('requests.new')"
      :description="reportFor ? `${reportFor.order.number} · ${reportFor.title}` : undefined"
    >
      <template #body>
        <WorkRequestForm
          v-if="reportFor"
          :task-id="reportFor.id"
          :loading="reporting"
          @submit="sendNeed"
          @cancel="reportFor = null"
        />
      </template>
    </UModal>
  </DashboardSection>
</template>
