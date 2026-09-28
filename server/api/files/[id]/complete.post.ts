/**
 * Krok 2 wysyłki pliku: sprawdzamy w magazynie, że plik dotarł i ma deklarowany rozmiar.
 */
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { withTenant } from '../../../db/tenant'
import { recordAudit } from '../../../db/audit'
import { fileObject } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { file: ['upload'] })
  const { id } = await getValidatedRouterParams(event, params => z.object({ id: z.uuid() }).parse(params))

  return withTenant(useDb(), ctx, async (tx) => {
    const [file] = await tx.select().from(fileObject).where(eq(fileObject.id, id)).limit(1)
    if (!file) throw createError({ statusCode: 404, message: 'Nie znaleziono pliku.' })
    if (file.status === 'uploaded') return file

    const stored = await useFileStorage().head(file.storageKey)
    if (!stored) throw createError({ statusCode: 409, message: 'Plik nie dotarł do magazynu.' })
    if (stored.sizeBytes !== file.sizeBytes) {
      throw createError({ statusCode: 409, message: 'Rozmiar pliku nie zgadza się z deklarowanym.' })
    }

    const [updated] = await tx
      .update(fileObject)
      .set({ status: 'uploaded', uploadedAt: new Date() })
      .where(eq(fileObject.id, id))
      .returning()
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'file.uploaded',
      entityType: 'file',
      entityId: id,
      data: { purpose: file.purpose, contentType: file.contentType, sizeBytes: file.sizeBytes },
      ...requestMeta(event),
    })
    return updated
  })
})
