import type { z } from 'zod'
import type { workRequestCreateSchema } from '#shared/schemas'

/** Wysłanie zgłoszenia potrzeby razem ze zdjęciami (zdjęcia przypinamy do zgłoszenia i zadania). */
export function useReportNeed() {
  const { t } = useI18n()
  const toast = useToast()
  const { upload } = useStorageUpload()
  const saving = ref(false)

  async function submit(workOrderId: string, data: z.output<typeof workRequestCreateSchema>, files: File[]) {
    saving.value = true
    try {
      const { id } = await $fetch(`/api/work-orders/${workOrderId}/requests`, { method: 'POST', body: data })
      for (const file of files) {
        try {
          const fileId = await upload(file, 'attachment')
          await $fetch(`/api/work-orders/${workOrderId}/attachments`, {
            method: 'POST',
            body: { fileId, workRequestId: id, taskId: data.taskId },
          })
        }
        catch (error) {
          toast.add({ title: t('attachments.failed', { name: file.name }), description: apiErrorMessage(error, ''), color: 'error' })
        }
      }
      toast.add({ title: t('requests.sent'), color: 'success', icon: 'i-lucide-send' })
      return true
    }
    catch (error) {
      toast.add({ title: apiErrorMessage(error, t('common.error')), color: 'error' })
      return false
    }
    finally {
      saving.value = false
    }
  }

  return { saving, submit }
}
