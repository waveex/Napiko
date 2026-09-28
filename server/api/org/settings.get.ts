import { withTenant } from '../../db/tenant'
import { fileObject, organizationSettings } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { settings: ['read'] })
  const { settings, logo } = await withTenant(useDb(), ctx, async (tx) => {
    const [settings] = await tx.select().from(organizationSettings).limit(1)
    const logo = settings?.logoFileId
      ? (await tx.select().from(fileObject).where(eq(fileObject.id, settings.logoFileId)).limit(1))[0]
      : undefined
    return { settings, logo }
  })
  if (!settings) throw createError({ statusCode: 404, message: 'Brak ustawień organizacji.' })

  const logoUrl = logo?.status === 'uploaded'
    ? await useFileStorage().presignDownload(logo.storageKey, logo.fileName)
    : null
  return { ...settings, logoUrl }
})
