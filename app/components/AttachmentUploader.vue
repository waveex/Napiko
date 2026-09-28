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
const failed = shallowRef<{ file: File, fileId?: string }[]>([])

async function onChange(event: Event) {
  if (progress.value) return
  const files = [...((event.target as HTMLInputElement).files ?? [])]
  if (input.value) input.value.value = ''
  if (!files.length) return
  await send(files.map(file => ({ file })))
}

async function send(items: { file: File, fileId?: string }[]) {
  if (progress.value) return
  progress.value = { done: 0, total: items.length }
  failed.value = []
  let ok = 0
  for (const item of items) {
    try {
      item.fileId ??= await upload(item.file, 'attachment')
      await $fetch(`/api/work-orders/${props.workOrderId}/attachments`, {
        method: 'POST',
        body: { fileId: item.fileId, taskId: props.taskId ?? null, workRequestId: props.workRequestId ?? null },
      })
      ok++
    }
    catch (error) {
      failed.value = [...failed.value, item]
      toast.add({ title: t('attachments.failed', { name: item.file.name }), description: apiErrorMessage(error, ''), color: 'error' })
    }
    progress.value = { done: progress.value.done + 1, total: items.length }
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
    <div
      v-if="failed.length"
      class="mt-3 space-y-2"
      role="alert"
    >
      <p
        v-for="item in failed"
        :key="item.file.name"
        class="break-words text-sm text-error"
      >
        {{ $t('attachments.failed', { name: item.file.name }) }}
      </p>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        :label="$t('ui.retry')"
        :loading="!!progress"
        @click="send([...failed])"
      />
    </div>
  </div>
</template>
