<script setup lang="ts">
import type { z } from 'zod'
import type { workRequestCreateSchema } from '#shared/schemas'
import { formatDuration } from '#shared/workshop'

const { t } = useI18n()
const toast = useToast()
const { data: me } = await useMe()

const { data, refresh, status, error } = await useFetch('/api/my/tasks')
const serverTime = computed(() => data.value?.serverTime)
const now = useNow(serverTime)

type MyTask = NonNullable<typeof data.value>['tasks'][number]

const running = computed(() => data.value?.running ?? null)
const runningTask = computed(() => data.value?.tasks.find(task => task.id === running.value?.taskId) ?? null)

/** Czas od pobrania danych – dokładamy go do czasu z serwera, żeby licznik szedł na żywo. */
const sinceFetch = computed(() => (serverTime.value ? Math.max(0, (now.value - new Date(serverTime.value).getTime()) / 1000) : 0))
const liveSeconds = computed(() => (runningTask.value ? (runningTask.value.mySeconds ?? 0) + sinceFetch.value : null))
const runningLong = computed(() => running.value && now.value - new Date(running.value.startedAt).getTime() > 10 * 3600 * 1000)

const groups = computed(() => {
  const tasks = (data.value?.tasks ?? []).filter(task => task.id !== running.value?.taskId)
  return [
    { key: 'todo', title: t('myTasks.todo'), tasks: tasks.filter(task => ['todo', 'in_progress', 'paused'].includes(task.status)) },
    { key: 'waiting', title: t('myTasks.waiting'), tasks: tasks.filter(task => ['waiting_parts', 'waiting_approval'].includes(task.status)) },
    { key: 'done', title: t('myTasks.doneToday'), tasks: tasks.filter(task => task.status === 'done') },
  ].filter(group => group.tasks.length)
})
const nothing = computed(() => !runningTask.value && !groups.value.length && !data.value?.available.length)

const busyTask = ref<string | null>(null)

async function work(task: MyTask, action: 'start' | 'pause' | 'finish') {
  if (busyTask.value) return
  busyTask.value = task.id
  try {
    await $fetch(`/api/tasks/${task.id}/work`, { method: 'POST', body: { action } })
    await refresh()
    const title = action === 'start' ? t('myTasks.started') : action === 'pause' ? t('myTasks.paused') : t('myTasks.finished')
    toast.add({ title, color: 'success', icon: action === 'finish' ? 'i-lucide-circle-check' : 'i-lucide-timer' })
  }
  catch (error) {
    toast.add({ title: apiErrorMessage(error, t('common.error')), color: 'error' })
  }
  finally {
    busyTask.value = null
  }
}

async function take(taskId: string) {
  if (busyTask.value) return
  busyTask.value = taskId
  try {
    await $fetch(`/api/tasks/${taskId}/assignees`, { method: 'POST', body: { userId: me.value!.user.id } })
    await refresh()
    toast.add({ title: t('myTasks.taken'), color: 'success', icon: 'i-lucide-hand' })
  }
  catch (error) {
    toast.add({ title: apiErrorMessage(error, t('common.error')), color: 'error' })
  }
  finally {
    busyTask.value = null
  }
}

// ── zgłoszenie potrzeby przy zadaniu ──
const reportFor = ref<MyTask | null>(null)
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
    await refresh()
  }
}

// Odświeżanie w tle – biuro mogło przydzielić nowe zadanie albo odpowiedzieć na zgłoszenie
let poll: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  poll = setInterval(() => {
    if (document.visibilityState === 'visible' && !busyTask.value) refresh()
  }, 60_000)
})
onBeforeUnmount(() => clearInterval(poll))
</script>

<template>
  <UDashboardPanel id="my-tasks">
    <template #header>
      <UDashboardNavbar :title="$t('myTasks.title')">
        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            :loading="status === 'pending'"
            :aria-label="$t('ui.refresh')"
            @click="refresh()"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="napiko-intro">
        <h2>{{ $t('nav.myTasks') }}</h2>
        <p>{{ $t('ui.tasksHint') }}</p>
      </div>
      <LoadState
        :error="error"
        :pending="status === 'pending' && !data"
        @retry="refresh()"
      />
      <div
        v-if="data"
        class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
      >
        <section
          v-if="runningTask"
          class="space-y-3 xl:sticky xl:top-0"
        >
          <h2 class="flex items-center gap-2 text-sm font-medium text-primary">
            <span class="size-2 animate-pulse rounded-full bg-primary" />
            {{ $t('myTasks.workingOn') }}
          </h2>
          <UAlert
            v-if="runningLong"
            color="warning"
            variant="subtle"
            icon="i-lucide-alarm-clock"
            :title="$t('myTasks.longRunning', { time: formatDuration((now - new Date(running!.startedAt).getTime()) / 1000) })"
          />
          <MyTaskCard
            :task="runningTask"
            :live-seconds="liveSeconds"
            mode="mine"
            :can-work="data.can.work"
            :can-report="data.can.reportNeeds"
            :can-upload="data.can.uploadFiles"
            :busy="!!busyTask"
            @work="action => work(runningTask!, action)"
            @report="reportFor = runningTask"
            @uploaded="refresh()"
          />
        </section>

        <div
          class="min-w-0 space-y-6"
          :class="{ 'xl:col-span-2': !runningTask }"
        >
          <UEmpty
            v-if="nothing"
            icon="i-lucide-clipboard-check"
            :title="$t('myTasks.empty')"
            :description="$t('myTasks.emptyHint')"
          />

          <section
            v-for="group in groups"
            :key="group.key"
            class="space-y-3"
          >
            <h2 class="text-sm font-medium text-muted">
              {{ group.title }} <span class="text-dimmed">({{ group.tasks.length }})</span>
            </h2>
            <div
              class="grid gap-4"
              :class="{ 'md:grid-cols-2': !runningTask }"
            >
              <MyTaskCard
                v-for="task in group.tasks"
                :key="task.id"
                :task="task"
                mode="mine"
                :can-work="data.can.work"
                :can-report="data.can.reportNeeds"
                :can-upload="data.can.uploadFiles"
                :busy="!!busyTask"
                @work="action => work(task, action)"
                @report="reportFor = task"
                @uploaded="refresh()"
              />
            </div>
          </section>

          <section
            v-if="data.available.length"
            class="space-y-2"
          >
            <h2 class="text-sm font-medium text-muted">
              {{ $t('myTasks.available') }} <span class="text-dimmed">({{ data.available.length }})</span>
            </h2>
            <p class="text-xs text-muted">
              {{ $t('myTasks.availableHint') }}
            </p>
            <div
              class="grid gap-4"
              :class="{ 'md:grid-cols-2': !runningTask }"
            >
              <MyTaskCard
                v-for="task in data.available"
                :key="task.id"
                :task="task"
                mode="available"
                :can-work="data.can.work"
                :can-report="false"
                :can-upload="false"
                :busy="!!busyTask"
                @take="take(task.id)"
              />
            </div>
          </section>
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
    </template>
  </UDashboardPanel>
</template>
