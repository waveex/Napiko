/**
 * Członkowie aktywnej organizacji (np. do przydzielania zadań).
 */
import { asc, eq } from 'drizzle-orm'
import { member, user } from '../../db/schema'
import { parseRoles } from '../../../shared/permissions'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { task: ['read'] })
  const rows = await useDb()
    .select({ userId: member.userId, name: user.name, role: member.role })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, ctx.orgId))
    .orderBy(asc(user.name))
  return rows.map(r => ({ ...r, roles: parseRoles(r.role) }))
})
