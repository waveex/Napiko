/**
 * Zalogowany użytkownik, aktywna organizacja, rola i uprawnienia (liczone na serwerze).
 */
import { and, eq } from 'drizzle-orm'
import { member, organization } from '../db/schema'
import { hasPermission } from '../../shared/permissions'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const orgId = session.session.activeOrganizationId

  let activeOrganization = null
  if (orgId) {
    const [row] = await useDb()
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        kind: organization.kind,
        role: member.role,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(and(eq(member.organizationId, orgId), eq(member.userId, session.user.id)))
      .limit(1)
    if (row) {
      activeOrganization = {
        ...row,
        can: {
          updateSettings: hasPermission(row.role, { settings: ['update'] }),
          inviteMembers: hasPermission(row.role, { invitation: ['create'] }),
          readAudit: hasPermission(row.role, { audit: ['read'] }),
          uploadFiles: hasPermission(row.role, { file: ['upload'] }),
          readCustomers: hasPermission(row.role, { customer: ['read'] }),
          createCustomers: hasPermission(row.role, { customer: ['create'] }),
          readCustomerContact: hasPermission(row.role, { customerContact: ['read'] }),
          readOrders: hasPermission(row.role, { workOrder: ['read'] }),
          createOrders: hasPermission(row.role, { workOrder: ['create'] }),
          workOnTasks: hasPermission(row.role, { task: ['work'] }),
          reportNeeds: hasPermission(row.role, { workRequest: ['create'] }),
          quoteRequests: hasPermission(row.role, { workRequest: ['quote'] }),
          readBilling: hasPermission(row.role, { billing: ['read'] }),
          updateBilling: hasPermission(row.role, { billing: ['update'] }),
          notifyCustomers: hasPermission(row.role, { customerNotification: ['send'] }),
        },
      }
    }
  }

  const organizations = await useDb()
    .select({ id: organization.id, name: organization.name, kind: organization.kind, role: member.role })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, session.user.id))
    .orderBy(organization.name)

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
    },
    activeOrganization,
    organizations,
  }
})
