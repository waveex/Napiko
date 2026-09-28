import type { H3Event } from 'h3'
import { z } from 'zod'

const uuidParams = z.object({ id: z.uuid() })

/** Identyfikator z adresu (np. /api/work-orders/:id) – zawsze UUID. */
export async function getIdParam(event: H3Event) {
  const { id } = await getValidatedRouterParams(event, params => uuidParams.parse(params))
  return id
}
