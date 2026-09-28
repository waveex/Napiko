<script setup lang="ts">
import { TASK_STATUS_COLOR, WORK_ORDER_STATUS_COLOR, type TaskStatus, type WorkOrderStatus } from '#shared/workshop'

const props = defineProps<{
  kind: 'order' | 'task'
  status: WorkOrderStatus | TaskStatus
  size?: 'sm' | 'md'
}>()

const color = computed(() => props.kind === 'order'
  ? WORK_ORDER_STATUS_COLOR[props.status as WorkOrderStatus]
  : TASK_STATUS_COLOR[props.status as TaskStatus])
const labelKey = computed(() => `${props.kind === 'order' ? 'workOrderStatus' : 'taskStatus'}.${props.status}`)
</script>

<template>
  <UBadge
    :color="color"
    variant="subtle"
    :size="size ?? 'md'"
    :label="$t(labelKey)"
  />
</template>
