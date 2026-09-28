/**
 * Metadane pliku i krótkotrwały adres do pobrania (tylko w obrębie aktywnej organizacji – pilnuje RLS).
 */
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { withTenant } from '../../db/tenant'
import { fileObject } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { file: ['read'] })
  const { id } = await getValidatedRouterParams(event, params => z.object({ id: z.uuid() }).parse(params))

  const [file] = await withTenant(useDb(), ctx, tx => tx.select().from(fileObject).where(eq(fileObject.id, id)).limit(1))
  if (!file || file.status !== 'uploaded') throw createError({ statusCode: 404, message: 'Nie znaleziono pliku.' })

  return {
    id: file.id,
    fileName: file.fileName,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    purpose: file.purpose,
    uploadedAt: file.uploadedAt,
    url: await useFileStorage().presignDownload(file.storageKey, file.fileName),
  }
})
