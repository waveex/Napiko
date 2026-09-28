/**
 * Przypięcie wysłanego pliku (zdjęcie, film) do zlecenia – opcjonalnie do zadania albo zgłoszenia.
 * Plik trafia wcześniej do magazynu przez /api/files/upload-url + /complete.
 */
import { and, eq } from 'drizzle-orm'
import { withTenant } from '../../../db/tenant'
import { recordAudit } from '../../../db/audit'
import { fileObject, workOrder, workOrderAttachment } from '../../../db/schema'
import { attachmentCreateSchema } from '../../../../shared/schemas'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { file: ['upload'], workOrder: ['read'] })
  const workOrderId = await getIdParam(event)
  const input = await readValidatedBody(event, body => attachmentCreateSchema.parse(body))

  try {
    return await withTenant(useDb(), ctx, async (tx) => {
      const [order] = await tx.select({ id: workOrder.id, number: workOrder.number, status: workOrder.status })
        .from(workOrder).where(eq(workOrder.id, workOrderId)).limit(1)
      if (!order) throw notFound('Nie znaleziono zlecenia.')
      assertOrderOpen(order.status)

      // Przypiąć można tylko własny, w pełni wysłany załącznik
      const [file] = await tx.select().from(fileObject)
        .where(and(eq(fileObject.id, input.fileId), eq(fileObject.uploadedBy, ctx.userId)))
        .limit(1)
      if (!file || file.status !== 'uploaded' || file.purpose !== 'attachment') {
        throw createError({ statusCode: 422, message: 'Plik nie został wysłany albo nie jest załącznikiem.' })
      }

      const [row] = await tx.insert(workOrderAttachment).values({
        orgId: ctx.orgId,
        workOrderId,
        taskId: input.taskId,
        workRequestId: input.workRequestId,
        fileId: input.fileId,
        caption: input.caption,
        createdBy: ctx.userId,
      }).returning({ id: workOrderAttachment.id })

      await recordAudit(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'attachment.added',
        entityType: 'work_order',
        entityId: workOrderId,
        data: { number: order.number, contentType: file.contentType, request: !!input.workRequestId, task: !!input.taskId },
        ...requestMeta(event),
      })
      return { id: row!.id }
    })
  }
  catch (error) {
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, message: 'Ten plik jest już przypięty.' })
    throw error
  }
})
