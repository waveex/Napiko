/**
 * Krok 1 wysyłki pliku: rejestrujemy plik i zwracamy podpisany adres, pod który przeglądarka
 * wysyła go bezpośrednio do magazynu S3 (z pominięciem limitów funkcji serverless).
 */
import { randomUUID } from 'node:crypto'
import { withTenant } from '../../db/tenant'
import { fileObject } from '../../db/schema'
import { uploadRequestSchema } from '../../../shared/schemas'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { file: ['upload'] })
  const input = await readValidatedBody(event, body => uploadRequestSchema.parse(body))

  const id = randomUUID()
  const now = new Date()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  // Klucz bez danych osobowych: organizacja / rok / miesiąc / identyfikator
  const storageKey = `org/${ctx.orgId}/${now.getUTCFullYear()}/${month}/${id}`

  await withTenant(useDb(), ctx, tx => tx.insert(fileObject).values({
    id,
    orgId: ctx.orgId,
    uploadedBy: ctx.userId,
    storageKey,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    purpose: input.purpose,
  }))

  const uploadUrl = await useFileStorage().presignUpload(storageKey, input.contentType, input.sizeBytes)
  return {
    fileId: id,
    uploadUrl,
    method: 'PUT' as const,
    headers: { 'Content-Type': input.contentType },
  }
})
