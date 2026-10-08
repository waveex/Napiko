<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { formatDuration, TASK_STATUSES, TASK_STATUS_ICON, type TaskKind, type TaskStatus } from '#shared/workshop'

interface Person {
  id: string
  name: string
}

interface TaskNode {
  id: string
  title: string
  kind?: TaskKind
  status: TaskStatus
  estimatedMinutes: number | null
  startedAt: string | null
  assignees: Person[]
  timeSpentSeconds?: number
  running?: { userId: string | null, name: string | null, startedAt: string }[]
  subtasks?: TaskNode[]
}

interface TaskPermissions {
  createTask: boolean
  updateTask: boolean
  work: boolean
  assignOthers: boolean
  selfAssign: boolean
  manageAssignments: boolean
  reportNeeds?: boolean
}

const props = defineProps<{
  task: TaskNode
  permissions: TaskPermissions
  members: { userId: string, name: string }[]
  meId: string
  readonly: boolean
  /** Osoby przypisane do zadania nadrzędnego – mogą pracować także nad podzadaniami. */
  inheritedAssigneeIds?: string[]
}>()

const emit = defineEmits<{
  status: [taskId: string, status: TaskStatus]
  assign: [taskId: string, userId: string]
  unassign: [taskId: string, userId: string]
  remove: [taskId: string]
  addSubtask: [parentId: string, title: string]
  work: [taskId: string, action: 'start' | 'pause']
  report: [taskId: string]
}>()

const { t } = useI18n()

const isSubtask = computed(() => props.inheritedAssigneeIds !== undefined)
// „Wydanie auta” dokłada system po zakończeniu prac: ma stały tytuł (tłumaczony), bez podzadań, zgłoszeń potrzeb i usuwania
const isHandover = computed(() => props.task.kind === 'handover')
const assignedDirectly = computed(() => props.task.assignees.some(a => a.id === props.meId))
const assignedToMe = computed(() => assignedDirectly.value || !!props.inheritedAssigneeIds?.includes(props.meId))

const canChangeStatus = computed(() =>
  !props.readonly && props.permissions.work && (props.permissions.updateTask || assignedToMe.value),
)
// Kto może przydzielać innych, wybiera siebie z listy – przycisk „Biorę” jest dla mechaników.
const canTake = computed(() =>
  !props.readonly && props.permissions.selfAssign && !props.permissions.assignOthers && !assignedToMe.value,
)
const canAssignOthers = computed(() => !props.readonly && props.permissions.assignOthers)
const runningByMe = computed(() => !!props.task.running?.some(r => r.userId === props.meId))
const othersRunning = computed(() => (props.task.running ?? []).filter(r => r.userId !== props.meId))
// Licznik czasu pokazujemy wykonawcom zadania (biuro zmienia status z listy)
const canTrack = computed(() =>
  !props.readonly && props.permissions.work && assignedToMe.value && props.task.status !== 'done' && props.task.status !== 'cancelled',
)

function canRemove(userId: string) {
  if (props.readonly) return false
  if (props.permissions.manageAssignments) return true
  return userId === props.meId ? props.permissions.selfAssign : props.permissions.assignOthers
}

const statusItems = computed(() => TASK_STATUSES.map(value => ({
  value,
  label: t(`taskStatus.${value}`),
  icon: TASK_STATUS_ICON[value],
})))

const iconClass: Record<TaskStatus, string> = {
  todo: 'text-dimmed',
  in_progress: 'text-info',
  paused: 'text-muted',
  waiting_parts: 'text-warning',
  waiting_approval: 'text-warning',
  done: 'text-success',
  cancelled: 'text-error',
}

const memberItems = computed<DropdownMenuItem[]>(() => props.members.map((m) => {
  const assigned = props.task.assignees.some(a => a.id === m.userId)
  return {
    label: m.name,
    type: 'checkbox' as const,
    checked: assigned,
    onSelect: () => {
      if (assigned) emit('unassign', props.task.id, m.userId)
      else emit('assign', props.task.id, m.userId)
    },
  }
}))

const deletable = computed(() =>
  !isHandover.value && props.task.status === 'todo' && !props.task.startedAt && (props.task.subtasks ?? []).every(s => s.status === 'todo'),
)

const adding = ref(false)
const newTitle = ref('')

const actionItems = computed<DropdownMenuItem[]>(() => {
  if (props.readonly) return []
  const items: DropdownMenuItem[] = []
  if (!isSubtask.value && !isHandover.value && props.permissions.createTask) {
    items.push({
      label: t('tasks.addSubtask'),
      icon: 'i-lucide-list-plus',
      onSelect: () => {
        adding.value = true
      },
    })
  }
  if (props.permissions.reportNeeds && !isHandover.value) {
    items.push({ label: t('requests.new'), icon: 'i-lucide-message-square-warning', onSelect: () => emit('report', props.task.id) })
  }
  if (props.permissions.updateTask && deletable.value) {
    items.push({ label: t('tasks.delete'), icon: 'i-lucide-trash-2', color: 'error', onSelect: () => emit('remove', props.task.id) })
  }
  return items
})

function submitSubtask() {
  const title = newTitle.value.trim()
  if (!title) return
  emit('addSubtask', props.task.id, title)
  newTitle.value = ''
  adding.value = false
}
</script>

<template>
  <div>
    <div class="flex items-start gap-3 py-3">
      <UIcon
        :name="TASK_STATUS_ICON[task.status]"
        class="mt-0.5 size-5 shrink-0"
        :class="iconClass[task.status]"
      />

      <div class="min-w-0 flex-1 space-y-2">
        <p
          class="font-medium"
          :class="{ 'text-muted line-through': task.status === 'cancelled', 'text-muted': task.status === 'done' }"
        >
          {{ isHandover ? $t('tasks.handover') : task.title }}
          <span
            v-if="task.estimatedMinutes"
            class="ms-1 text-xs font-normal text-muted"
          >{{ $t('tasks.estimatedMinutes', { n: task.estimatedMinutes }) }}</span>
        </p>

        <p
          v-if="isHandover"
          class="text-xs text-muted"
        >
          {{ $t('tasks.handoverHint') }}
        </p>

        <p
          v-if="task.timeSpentSeconds || task.running?.length"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"
        >
          <span
            v-if="task.timeSpentSeconds"
            class="inline-flex items-center gap-1"
          >
            <UIcon
              name="i-lucide-timer"
              class="size-3.5"
            />
            {{ formatDuration(task.timeSpentSeconds) }}
          </span>
          <span
            v-for="r in othersRunning"
            :key="r.userId ?? r.startedAt"
            class="inline-flex items-center gap-1 text-info"
          >
            <span class="size-2 animate-pulse rounded-full bg-info" />
            {{ $t('timer.running', { name: r.name ?? '—' }) }}
          </span>
        </p>

        <div class="flex flex-wrap items-center gap-2">
          <USelect
            v-if="canChangeStatus"
            :model-value="task.status"
            :items="statusItems"
            :icon="TASK_STATUS_ICON[task.status]"
            size="xs"
            class="w-48"
            :aria-label="$t('orders.status')"
            @update:model-value="value => emit('status', task.id, value as TaskStatus)"
          />
          <StatusBadge
            v-else
            kind="task"
            :status="task.status"
            size="sm"
          />

          <span
            v-for="a in task.assignees"
            :key="a.id"
            class="inline-flex items-center gap-1 rounded-full bg-elevated py-0.5 ps-1 pe-2 text-xs"
          >
            <UAvatar
              :alt="a.name"
              size="3xs"
            />
            {{ a.name }}
            <button
              v-if="canRemove(a.id)"
              type="button"
              class="-me-1 inline-flex rounded-full p-0.5 text-muted hover:bg-accented hover:text-default"
              :aria-label="$t('tasks.unassign', { name: a.name })"
              :title="$t('tasks.unassign', { name: a.name })"
              @click="emit('unassign', task.id, a.id)"
            >
              <UIcon
                name="i-lucide-x"
                class="size-3"
              />
            </button>
          </span>

          <UDropdownMenu
            v-if="canAssignOthers && members.length"
            :items="memberItems"
            :content="{ align: 'start' }"
          >
            <UButton
              icon="i-lucide-user-plus"
              size="xs"
              color="neutral"
              variant="ghost"
              :label="$t('tasks.assign')"
            />
          </UDropdownMenu>
          <UButton
            v-if="canTake"
            icon="i-lucide-hand"
            size="xs"
            variant="soft"
            :label="$t('tasks.take')"
            @click="emit('assign', task.id, meId)"
          />
          <UButton
            v-if="canTrack"
            :icon="runningByMe ? 'i-lucide-pause' : 'i-lucide-play'"
            size="xs"
            :color="runningByMe ? 'warning' : 'primary'"
            :variant="runningByMe ? 'soft' : 'solid'"
            :label="runningByMe ? $t('myTasks.pause') : $t('myTasks.start')"
            @click="emit('work', task.id, runningByMe ? 'pause' : 'start')"
          />
        </div>
      </div>

      <UDropdownMenu
        v-if="actionItems.length"
        :items="actionItems"
        :content="{ align: 'end' }"
      >
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="$t('common.actions')"
        />
      </UDropdownMenu>
    </div>

    <div
      v-if="task.subtasks?.length || adding"
      class="ms-2.5 border-s border-default ps-5"
    >
      <TaskItem
        v-for="sub in task.subtasks"
        :key="sub.id"
        :task="sub"
        :permissions="permissions"
        :members="members"
        :me-id="meId"
        :readonly="readonly"
        :inherited-assignee-ids="task.assignees.map(a => a.id)"
        @status="(id, status) => emit('status', id, status)"
        @assign="(id, userId) => emit('assign', id, userId)"
        @unassign="(id, userId) => emit('unassign', id, userId)"
        @remove="id => emit('remove', id)"
        @work="(id, action) => emit('work', id, action)"
        @report="id => emit('report', id)"
      />
      <form
        v-if="adding"
        class="flex gap-2 py-2"
        @submit.prevent="submitSubtask"
      >
        <UInput
          v-model="newTitle"
          :placeholder="$t('tasks.subtaskPlaceholder')"
          size="sm"
          autofocus
          class="flex-1"
        />
        <UButton
          type="submit"
          size="sm"
          icon="i-lucide-plus"
          :disabled="!newTitle.trim()"
          :label="$t('common.add')"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          :aria-label="$t('common.cancel')"
          @click="adding = false"
        />
      </form>
    </div>
  </div>
</template>
