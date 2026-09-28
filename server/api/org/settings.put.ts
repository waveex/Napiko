import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { fileObject, organizationSettings } from '../../db/schema'
import { orgSettingsSchema } from '../../../shared/schemas'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { settings: ['update'] })
  const input = await readValidatedBody(event, body => orgSettingsSchema.parse(body))

  return withTenant(useDb(), ctx, async (tx) => {
    const [before] = await tx.select().from(organizationSettings).limit(1)
    if (!before) throw createError({ statusCode: 404, message: 'Brak ustawień organizacji.' })

    if (input.logoFileId) {
      const [logo] = await tx
        .select({ id: fileObject.id })
        .from(fileObject)
        .where(and(eq(fileObject.id, input.logoFileId), eq(fileObject.purpose, 'logo'), eq(fileObject.status, 'uploaded')))
        .limit(1)
      if (!logo) throw createError({ statusCode: 422, message: 'Nieprawidłowy plik logo.' })
    }

    const [after] = await tx
      .update(organizationSettings)
      .set(input)
      .where(eq(organizationSettings.orgId, ctx.orgId))
      .returning()

    const changed = Object.fromEntries(
      (Object.keys(input) as (keyof typeof input)[])
        .filter(key => before[key] !== after![key])
        .map(key => [key, { from: before[key], to: after![key] }]),
    )
    if (Object.keys(changed).length > 0) {
      await recordAudit(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'settings.updated',
        entityType: 'organization_settings',
        entityId: ctx.orgId,
        data: { changed },
        ...requestMeta(event),
      })
    }
    return after
  })
})
