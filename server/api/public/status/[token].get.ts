/**
 * Publiczna strona statusu naprawy (bez logowania) – dostęp tylko przez token z linku w SMS-ie / e-mailu.
 * Pokazujemy etap naprawy z datami, termin, postęp prac i kontakt do warsztatu, a także ustawienia
 * powiadomień klienta (zamaskowany numer i adres). Bez cen, danych klienta, notatek i nazwisk zespołu.
 */
import { and, asc, eq, gt, sql } from 'drizzle-orm'
import { withCustomerLink } from '../../../db/tenant'
import {
  approvalRequest, auditEvent, companyProfile, customer, customerPushSubscription, fileObject, organization, organizationSettings,
  task, vehicle, workOrder, workOrderStatusLink,
} from '../../../db/schema'
import { maskEmail, maskPhone, statusStep, statusTokenSchema } from '../../../../shared/notifications'

/** Po zamknięciu zlecenia link działa jeszcze 30 dni. */
const DAYS_AFTER_CLOSE = 30

export default defineEventHandler(async (event) => {
  const { token } = await getValidatedRouterParams(event, params => statusTokenSchema.parse(params))
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  setResponseHeader(event, 'Cache-Control', 'no-store')

  const link = await resolveStatusLink(token)
  if (!link) throw invalidLink()
  const [order] = await withCustomerLink(useDb(), link.orgId, tx => tx.select().from(workOrder)
    .where(eq(workOrder.id, link.workOrderId)).limit(1))
  if (!order) throw invalidLink()
  const closedLongAgo = (order.status === 'closed' || order.status === 'cancelled') && order.closedAt
    && order.closedAt.getTime() < Date.now() - DAYS_AFTER_CLOSE * 24 * 3600 * 1000
  if (closedLongAgo) throw createError({ statusCode: 410, message: 'Link wygasł – naprawa została zakończona.' })

  // Zespół warsztatu może podejrzeć stronę – bez liczenia wyświetleń i bez zmian ustawień za klienta
  const preview = await isOrganizationMember(event, order.orgId)

  return withCustomerLink(useDb(), order.orgId, async (tx) => {
    if (!preview) {
      await tx.update(workOrderStatusLink).set({
        firstViewedAt: sql`coalesce(${workOrderStatusLink.firstViewedAt}, now())`,
        lastViewedAt: sql`now()`,
        viewCount: sql`${workOrderStatusLink.viewCount} + 1`,
      }).where(eq(workOrderStatusLink.workOrderId, link.workOrderId))
    }
    const [veh] = await tx.select({
      type: vehicle.type,
      make: vehicle.make,
      model: vehicle.model,
      registrationNumber: vehicle.registrationNumber,
    }).from(vehicle).where(eq(vehicle.id, order.vehicleId)).limit(1)
    const [org] = await tx.select({ name: organization.name }).from(organization).where(eq(organization.id, order.orgId)).limit(1)
    const [profile] = await tx.select().from(companyProfile).where(eq(companyProfile.orgId, order.orgId)).limit(1)
    const [client] = await tx.select({
      phone: customer.phone,
      email: customer.email,
      notifySms: customer.notifySms,
      notifyEmail: customer.notifyEmail,
    }).from(customer).where(eq(customer.id, order.customerId)).limit(1)
    const tasks = await tx.select({ status: task.status }).from(task).where(eq(task.workOrderId, order.id))
    const active = tasks.filter(t => t.status !== 'cancelled')
    const [waiting] = await tx.select({ id: approvalRequest.id }).from(approvalRequest).where(and(
      eq(approvalRequest.workOrderId, order.id),
      eq(approvalRequest.status, 'pending'),
      gt(approvalRequest.expiresAt, sql`now()`),
    )).limit(1)
    const [logo] = await tx
      .select({ storageKey: fileObject.storageKey, fileName: fileObject.fileName })
      .from(organizationSettings)
      .innerJoin(fileObject, eq(fileObject.id, organizationSettings.logoFileId))
      .where(and(eq(organizationSettings.orgId, order.orgId), eq(fileObject.status, 'uploaded')))
      .limit(1)
    const [devices] = await tx.select({ n: sql<number>`count(*)::int` }).from(customerPushSubscription)
      .where(and(eq(customerPushSubscription.customerId, order.customerId), sql`${customerPushSubscription.revokedAt} is null`))

    // Daty etapów z dziennika zdarzeń: kiedy zlecenie weszło w realizację i kiedy było gotowe do odbioru
    const changes = await tx
      .select({ to: sql<string>`${auditEvent.data}->>'to'`, at: auditEvent.createdAt })
      .from(auditEvent)
      .where(and(
        eq(auditEvent.orgId, order.orgId),
        eq(auditEvent.entityType, 'work_order'),
        eq(auditEvent.entityId, order.id),
        eq(auditEvent.action, 'work_order.status_changed'),
      ))
      .orderBy(asc(auditEvent.seq))
    const firstIn = changes.find(c => statusStep(c.to) === 'in_progress')?.at ?? null
    const lastReady = [...changes].reverse().find(c => c.to === 'ready')?.at ?? null

    const push = usePush()
    return {
      organization: {
        name: org?.name ?? '',
        logoUrl: logo ? await useFileStorage().presignDownload(logo.storageKey, logo.fileName, 3600) : null,
        phone: profile?.phone ?? null,
        email: profile?.email ?? null,
        address: profile ? formatAddress(profile) || null : null,
        website: profile?.website ?? null,
      },
      order: {
        number: order.number,
        status: order.status,
        step: statusStep(order.status),
        cancelled: order.status === 'cancelled',
        receivedAt: order.receivedAt,
        promisedAt: order.promisedAt,
        closedAt: order.closedAt,
        updatedAt: order.updatedAt,
        steps: {
          received: order.receivedAt,
          in_progress: firstIn,
          ready: order.status === 'ready' || order.status === 'closed' ? lastReady : null,
          closed: order.status === 'closed' ? order.closedAt : null,
        },
      },
      vehicle: veh ?? null,
      progress: { done: active.filter(t => t.status === 'done').length, total: active.length },
      waitingForCustomer: !!waiting,
      notifications: {
        sms: { available: !!client?.phone, enabled: client?.notifySms ?? true, to: maskPhone(client?.phone) },
        email: { available: !!client?.email, enabled: client?.notifyEmail ?? true, to: maskEmail(client?.email) },
      },
      push: { enabled: push.enabled, publicKey: push.publicKey, devices: devices?.n ?? 0 },
      preview,
    }
  })
})
