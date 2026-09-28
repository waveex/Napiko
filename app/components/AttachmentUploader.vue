<script setup lang="ts">
import { FILE_RULES } from '#shared/schemas'

const props = defineProps<{
  workOrderId: string
  taskId?: string | null
  workRequestId?: string | null
  label?: string
  size?: 'xs' | 'sm' | 'md'
  block?: boolean
}>()
const emit = defineEmits<{ uploaded: [count: number] }>()

const { t } = useI18n()
const toast = useToast()
const { upload } = useStorageUpload()

const input = ref<HTMLInputElement | null>(null)
const progress = ref<{ done: number, total: number } | null>(null)
const accept = FILE_RULES.attachment.types.join(',')

async function onChange(event: Event) {
  const files = [...((event.target as HTMLInputElement).files ?? [])]
  if (input.value) input.value.value = ''
  if (!files.length) return
  progress.value = { done: 0, total: files.length }
  let ok = 0
  for (const file of files) {
    try {
      const fileId = await upload(file, 'attachment')
      await $fetch(`/api/work-orders/${props.workOrderId}/attachments`, {
        method: 'POST',
        body: { fileId, taskId: props.taskId ?? null, workRequestId: props.workRequestId ?? null },
      })
      ok++
    }
    catch (error) {
      toast.add({ title: t('attachments.failed', { name: file.name }), description: apiErrorMessage(error, ''), color: 'error' })
    }
    progress.value = { done: progress.value.done + 1, total: files.length }
  }
  progress.value = null
  if (ok) {
    toast.add({ title: t('attachments.uploaded', { n: ok }), color: 'success', icon: 'i-lucide-image-up' })
    emit('uploaded', ok)
  }
}
</script>

<template>
  <div>
    <input
      ref="input"
      type="file"
      class="hidden"
      multiple
      :accept="accept"
      @change="onChange"
    >
    <UButton
      icon="i-lucide-camera"
      color="neutral"
      variant="outline"
      :size="size ?? 'sm'"
      :block="block"
      :loading="!!progress"
      :label="progress ? $t('attachments.uploading', progress) : (label ?? $t('attachments.add'))"
      @click="input?.click()"
    />
  </div>
</template>
