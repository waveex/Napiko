<script setup lang="ts">
import { TASK_STATUS_COLOR, TASK_STATUS_ICON, WORK_ORDER_STATUS_COLOR, type TaskStatus, type WorkOrderStatus } from '#shared/workshop'

const props = defineProps<{
  kind: 'order' | 'task'
  status: WorkOrderStatus | TaskStatus
  size?: 'sm' | 'md'
}>()

const color = computed(() => props.kind === 'order'
  ? WORK_ORDER_STATUS_COLOR[props.status as WorkOrderStatus]
  : TASK_STATUS_COLOR[props.status as TaskStatus])
const labelKey = computed(() => `${props.kind === 'order' ? 'workOrderStatus' : 'taskStatus'}.${props.status}`)
const orderIcons: Record<string, string> = {
  new: 'i-lucide-inbox', in_progress: 'i-lucide-wrench', waiting_parts: 'i-lucide-package',
  waiting_approval: 'i-lucide-message-circle', ready: 'i-lucide-circle-check', closed: 'i-lucide-lock', cancelled: 'i-lucide-ban',
}
const icon = computed(() => props.kind === 'task' ? TASK_STATUS_ICON[props.status as TaskStatus] : (orderIcons[props.status] ?? 'i-lucide-clipboard-list'))
</script>

<template>
  <UBadge
    :color="color"
    :icon="icon"
    variant="subtle"
    :size="size ?? 'md'"
    :label="$t(labelKey)"
  />
</template>
