/**
 * Usunięcie załącznika: autor w ciągu doby (pomyłka) albo biuro.
 * Plik znika z widoku od razu, a z magazynu – w tle (kolejka zadań).
 */
import { eq } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { enqueueJob } from '../../db/jobs'
import { fileObject, workOrder, workOrderAttachment } from '../../db/schema'

const AUTHOR_WINDOW_MS = 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { file: ['upload'] })
  const id = await getIdParam(event)

  return withTenant(useDb(), ctx, async (tx) => {
    const [row] = await tx
      .select({ attachment: workOrderAttachment, storageKey: fileObject.storageKey, number: workOrder.number })
      .from(workOrderAttachment)
      .innerJoin(fileObject, eq(fileObject.id, workOrderAttachment.fileId))
      .innerJoin(workOrder, eq(workOrder.id, workOrderAttachment.workOrderId))
      .where(eq(workOrderAttachment.id, id))
      .limit(1)
    if (!row) throw notFound('Nie znaleziono załącznika.')

    const own = row.attachment.createdBy === ctx.userId
      && Date.now() - row.attachment.createdAt.getTime() < AUTHOR_WINDOW_MS
    if (!own && !can(ctx, { workOrder: ['update'] })) {
      throw createError({ statusCode: 403, message: 'Załącznik może usunąć autor (w ciągu doby) albo biuro.' })
    }

    await tx.delete(workOrderAttachment).where(eq(workOrderAttachment.id, id))
    await tx.update(fileObject).set({ status: 'deleted' }).where(eq(fileObject.id, row.attachment.fileId))
    await enqueueJob(tx, { type: 'file.delete', orgId: ctx.orgId, payload: { storageKey: row.storageKey } })
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'attachment.removed',
      entityType: 'work_order',
      entityId: row.attachment.workOrderId,
      data: { number: row.number },
      ...requestMeta(event),
    })
    return { ok: true }
  })
})
