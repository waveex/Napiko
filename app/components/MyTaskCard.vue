<script setup lang="ts">
import {
  formatClock, formatDuration, TASK_STATUS_ICON, URGENCY_COLOR, WORK_REQUEST_STATUS_COLOR,
  type TaskStatus, type VehicleType, type WorkOrderStatus, type WorkRequestKind, type WorkRequestStatus, type WorkRequestUrgency,
} from '#shared/workshop'

interface MyTask {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  parentTitle: string | null
  estimatedMinutes: number | null
  order: { id: string, number: string, status: WorkOrderStatus, description: string | null, promisedAt: string | null }
  vehicle: { type: VehicleType, make: string | null, model: string | null, registrationNumber: string | null, serialNumber: string | null }
  customerName: string
  mySeconds?: number
  requests?: { id: string, title: string, kind: WorkRequestKind, urgency: WorkRequestUrgency, status: WorkRequestStatus }[]
}

const props = defineProps<{
  task: MyTask
  /** Mój licznik działa na tym zadaniu – sekundy od startu całej pracy nad zadaniem. */
  liveSeconds?: number | null
  mode: 'mine' | 'available'
  canWork: boolean
  canReport: boolean
  canUpload: boolean
  busy?: boolean
}>()
const emit = defineEmits<{
  work: [action: 'start' | 'pause' | 'finish']
  take: []
  report: []
  uploaded: []
}>()

const { d } = useI18n()

const running = computed(() => props.liveSeconds !== null && props.liveSeconds !== undefined)
const overdue = computed(() => !!props.task.order.promisedAt && new Date(props.task.order.promisedAt).getTime() < Date.now())
const finished = computed(() => props.task.status === 'done')
</script>

<template>
  <article
    class="oxy-surface p-5"
    :class="running ? 'border-primary ring-2 ring-primary/30' : 'border-default'"
  >
    <div class="flex items-start gap-3">
      <UIcon
        :name="TASK_STATUS_ICON[task.status]"
        class="mt-0.5 size-5 shrink-0"
        :class="running ? 'text-primary' : finished ? 'text-success' : 'text-muted'"
      />
      <div class="min-w-0 flex-1 space-y-1">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3
            class="text-base font-semibold"
            :class="{ 'text-muted line-through': finished }"
          >
            {{ task.title }}
          </h3>
          <StatusBadge
            v-if="!running"
            kind="task"
            :status="task.status"
            size="sm"
          />
        </div>
        <p
          v-if="task.parentTitle"
          class="text-xs text-muted"
        >
          {{ $t('myTasks.subtaskOf', { title: task.parentTitle }) }}
        </p>
        <VehicleLabel
          :vehicle="task.vehicle"
          class="max-w-full text-lg font-semibold"
        />
        <p class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
          <ULink
            :to="`/app/orders/${task.order.id}`"
            class="font-mono"
          >
            {{ task.order.number }}
          </ULink>
          <span
            v-if="task.order.promisedAt"
            :class="overdue && !finished ? 'font-medium text-error' : ''"
          >
            {{ $t('myTasks.promised', { date: d(new Date(task.order.promisedAt), 'long') }) }}
          </span>
          <span>{{ task.customerName }}</span>
        </p>
        <p
          v-if="task.description"
          class="whitespace-pre-line pt-2 text-base"
        >
          {{ task.description }}
        </p>
        <p
          v-else-if="task.order.description"
          class="whitespace-pre-line pt-2 text-base"
        >
          <span class="text-muted">{{ $t('myTasks.orderScope') }}:</span> {{ task.order.description }}
        </p>
      </div>
    </div>

    <div
      v-if="running"
      class="mt-3 flex items-baseline gap-3"
    >
      <span class="font-mono text-3xl font-semibold tabular-nums text-primary">{{ formatClock(liveSeconds ?? 0) }}</span>
      <span
        v-if="task.estimatedMinutes"
        class="text-sm text-muted"
      >{{ $t('myTasks.estimated', { n: task.estimatedMinutes }) }}</span>
    </div>
    <p
      v-else-if="mode === 'mine' && (task.mySeconds || task.estimatedMinutes)"
      class="mt-2 text-xs text-muted"
    >
      <template v-if="task.mySeconds">
        {{ $t('myTasks.myTime', { time: formatDuration(task.mySeconds) }) }}
      </template>
      <template v-if="task.mySeconds && task.estimatedMinutes">
        ·
      </template>
      <template v-if="task.estimatedMinutes">
        {{ $t('myTasks.estimated', { n: task.estimatedMinutes }) }}
      </template>
    </p>

    <ul
      v-if="task.requests?.length"
      class="mt-3 flex flex-wrap gap-2"
    >
      <li
        v-for="r in task.requests"
        :key="r.id"
        class="inline-flex items-center gap-1.5 rounded-full border border-default py-0.5 ps-1.5 pe-2 text-xs"
      >
        <span
          class="size-2 rounded-full"
          :class="{ 'bg-error': URGENCY_COLOR[r.urgency] === 'error', 'bg-warning': URGENCY_COLOR[r.urgency] === 'warning', 'bg-success': URGENCY_COLOR[r.urgency] === 'success' }"
        />
        {{ r.title }}
        <UBadge
          :color="WORK_REQUEST_STATUS_COLOR[r.status]"
          variant="subtle"
          size="sm"
          :label="$t(`requestStatus.${r.status}`)"
        />
      </li>
    </ul>

    <div
      v-if="!finished"
      class="oxy-work-actions mt-5 grid grid-cols-1 gap-3 min-[390px]:grid-cols-2"
    >
      <template v-if="mode === 'available'">
        <UButton
          icon="i-lucide-hand"
          size="lg"
          :loading="busy"
          :label="$t('myTasks.take')"
          class="min-[390px]:col-span-2 justify-center"
          @click="emit('take')"
        />
      </template>
      <template v-else-if="canWork">
        <template v-if="running">
          <UButton
            icon="i-lucide-pause"
            size="lg"
            color="warning"
            variant="soft"
            :loading="busy"
            :label="$t('myTasks.pause')"
            class="justify-center"
            @click="emit('work', 'pause')"
          />
          <UButton
            icon="i-lucide-check"
            size="lg"
            color="success"
            :loading="busy"
            :label="$t('myTasks.finish')"
            class="justify-center"
            @click="emit('work', 'finish')"
          />
        </template>
        <UButton
          v-else
          icon="i-lucide-play"
          size="lg"
          :loading="busy"
          :label="task.status === 'paused' || task.status === 'in_progress' ? $t('myTasks.resume') : $t('myTasks.start')"
          class="min-[390px]:col-span-2 justify-center"
          @click="emit('work', 'start')"
        />
      </template>
      <UButton
        v-if="mode === 'mine' && canReport"
        icon="i-lucide-message-square-warning"
        color="neutral"
        variant="outline"
        :label="$t('requests.new')"
        class="justify-center"
        @click="emit('report')"
      />
      <AttachmentUploader
        v-if="mode === 'mine' && canUpload"
        :work-order-id="task.order.id"
        :task-id="task.id"
        size="md"
        block
        @uploaded="emit('uploaded')"
      />
    </div>
  </article>
</template>
