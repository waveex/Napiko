import { withTenant } from '../../db/tenant'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { workOrder: ['read'] })
  const id = await getIdParam(event)
  return withTenant(useDb(), ctx, tx => loadWorkOrderDetail(tx, ctx, id))
})
