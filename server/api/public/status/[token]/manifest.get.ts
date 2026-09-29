/**
 * Manifest aplikacji dla strony statusu naprawy: klient może dodać ją do ekranu początkowego telefonu
 * (na iPhonie to warunek powiadomień push), a ikona otwiera od razu status jego naprawy.
 */
import { eq } from 'drizzle-orm'
import { withSystem } from '../../../../db/tenant'
import { organization, workOrder, workOrderStatusLink } from '../../../../db/schema'
import { hashStatusToken } from '../../../../db/customer-notifications'
import { statusTokenSchema } from '../../../../../shared/notifications'

export default defineEventHandler(async (event) => {
  const { token } = await getValidatedRouterParams(event, params => statusTokenSchema.parse(params))
  const [row] = await withSystem(useDb(), tx => tx
    .select({ name: organization.name })
    .from(workOrderStatusLink)
    .innerJoin(workOrder, eq(workOrder.id, workOrderStatusLink.workOrderId))
    .innerJoin(organization, eq(organization.id, workOrder.orgId))
    .where(eq(workOrderStatusLink.tokenHash, hashStatusToken(token)))
    .limit(1))
  if (!row) throw createError({ statusCode: 404 })
  setResponseHeader(event, 'Content-Type', 'application/manifest+json; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  return {
    name: `${row.name} – status naprawy`,
    short_name: row.name.length > 12 ? `${row.name.slice(0, 11)}…` : row.name,
    description: 'Status naprawy Twojego pojazdu i powiadomienia od warsztatu.',
    id: `/s/${token}`,
    start_url: `/s/${token}`,
    scope: '/',
    display: 'standalone',
    background_color: '#f5f7fa',
    theme_color: '#6936b5',
    lang: 'pl',
    icons: [
      { src: '/icons/customer-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/customer-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/customer-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
})
