/**
 * Kosztorys do akceptacji klienta (art. 630 KC: klient zna zakres i koszt, zanim warsztat zacznie prace).
 * Ten sam mechanizm co przy pracach dodatkowych: link (e-mail, SMS albo przekazany osobiście),
 * treść zapisana w chwili wysyłki (snapshot + skrót SHA-256), decyzja klienta z datą, IP i przeglądarką.
 */
import { and, eq, gt, sql } from 'drizzle-orm'
import { withTenant } from '../../../db/tenant'
import { recordAudit } from '../../../db/audit'
import { enqueueJob } from '../../../db/jobs'
import { approvalRequest, organization, organizationSettings, vehicle, workOrder, type EstimateSnapshot } from '../../../db/schema'
import { estimateApprovalCreateSchema } from '../../../../shared/schemas'
import { normalizePhone } from '../../../../shared/workshop'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { billing: ['update'] })
  const workOrderId = await getIdParam(event)
  const input = await readValidatedBody(event, body => estimateApprovalCreateSchema.parse(body))
  const meta = requestMeta(event)

  const result = await withTenant(useDb(), ctx, async (tx) => {
    // Blokada zlecenia: dwa równoległe kliknięcia nie wyślą dwóch próśb
    const [row] = await tx
      .select({ order: workOrder, vehicle })
      .from(workOrder)
      .innerJoin(vehicle, eq(vehicle.id, workOrder.vehicleId))
      .where(eq(workOrder.id, workOrderId))
      .limit(1)
      .for('update', { of: workOrder })
    if (!row) throw notFound('Nie znaleziono zlecenia.')
    const { order } = row
    assertOrderOpen(order.status)

    const estimate = await loadEstimate(tx, workOrderId)
    if (!estimate.items.length) {
      throw createError({ statusCode: 422, message: 'Kosztorys jest pusty – dodaj pozycje przed wysłaniem.' })
    }
    const [pending] = await tx.select({ id: approvalRequest.id }).from(approvalRequest)
      .where(and(
        eq(approvalRequest.workOrderId, workOrderId),
        eq(approvalRequest.kind, 'estimate'),
        eq(approvalRequest.status, 'pending'),
        gt(approvalRequest.expiresAt, sql`now()`),
      ))
      .limit(1)
    if (pending) {
      throw createError({ statusCode: 409, message: 'Kosztorys czeka już na odpowiedź klienta. Wycofaj poprzednią prośbę, aby wysłać nową wersję.' })
    }

    const [org] = await tx.select({ name: organization.name }).from(organization).where(eq(organization.id, ctx.orgId)).limit(1)
    const [settings] = await tx.select({ smsSenderName: organizationSettings.smsSenderName }).from(organizationSettings).limit(1)
    const profile = await loadCompanyProfile(tx, ctx.orgId)
    const now = new Date()
    const snapshot: EstimateSnapshot = {
      version: 1,
      kind: 'estimate',
      organization: snapshotOrganization(org!.name, profile),
      order: { number: order.number },
      vehicle: {
        type: row.vehicle.type,
        make: row.vehicle.make,
        model: row.vehicle.model,
        registrationNumber: row.vehicle.registrationNumber,
      },
      message: input.message,
      currency: 'PLN',
      lines: estimate.items.map(item => ({
        id: item.id,
        kind: item.kind,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPriceNet: item.unitPriceNet,
        discountPercent: item.discountPercent,
        vatRate: item.vatRate,
        netCents: item.netCents,
        vatCents: item.vatCents,
        grossCents: item.grossCents,
      })),
      totals: estimate.totals,
      totalGrossCents: estimate.totals.grossCents,
      estimateHash: estimate.hash,
      footer: profile.documentFooter,
      createdAt: now.toISOString(),
    }
    const snapshotHash = hashSnapshot(snapshot)
    const token = generateApprovalToken()
    const expiresAt = new Date(now.getTime() + input.expiresInDays * 24 * 3600 * 1000)
    const recipient = input.channel === 'sms' ? normalizePhone(input.recipient) : input.recipient

    const [approval] = await tx.insert(approvalRequest).values({
      orgId: ctx.orgId,
      workOrderId,
      kind: 'estimate',
      tokenHash: hashApprovalToken(token),
      channel: input.channel,
      recipient: input.channel === 'link' ? null : recipient,
      snapshot,
      snapshotHash,
      expiresAt,
      sentBy: ctx.userId,
    }).returning({ id: approvalRequest.id })

    if (order.status === 'received' || order.status === 'in_progress' || order.status === 'waiting_parts') {
      await tx.update(workOrder).set({ status: 'waiting_approval' }).where(eq(workOrder.id, workOrderId))
      await recordAudit(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'work_order.status_changed',
        entityType: 'work_order',
        entityId: workOrderId,
        data: { number: order.number, from: order.status, to: 'waiting_approval', automatic: true },
        ...meta,
      })
    }

    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'approval.sent',
      entityType: 'approval',
      entityId: approval!.id,
      data: {
        number: order.number,
        kind: 'estimate',
        channel: input.channel,
        items: snapshot.lines.length,
        totalGrossCents: snapshot.totalGrossCents,
        estimateHash: estimate.hash,
        snapshotHash,
      },
      ...meta,
    })

    const url = approvalUrl(token)
    const vehicleName = [row.vehicle.make, row.vehicle.model].filter(Boolean).join(' ') || order.number
    const plate = row.vehicle.registrationNumber ? ` ${row.vehicle.registrationNumber}` : ''
    const total = formatPln(snapshot.totalGrossCents)
    if (input.channel === 'email' && recipient) {
      await enqueueJob(tx, {
        type: 'email.send',
        orgId: ctx.orgId,
        payload: {
          to: recipient,
          template: 'estimate-request',
          data: {
            organizationName: org!.name,
            vehicle: `${vehicleName}${plate}`,
            orderNumber: order.number,
            total,
            message: input.message ?? '',
            expires: expiresAt.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', dateStyle: 'short', timeStyle: 'short' }),
            url,
          },
        },
      })
    }
    if (input.channel === 'sms' && recipient) {
      await enqueueJob(tx, {
        type: 'sms.send',
        orgId: ctx.orgId,
        payload: {
          to: recipient,
          from: settings?.smsSenderName ?? null,
          message: `${org!.name}: kosztorys naprawy (${vehicleName}${plate}) na ${total} czeka na Twoją akceptację: ${url}`,
        },
      })
    }

    return { id: approval!.id, url, expiresAt }
  })

  await runPendingJobs({ budgetMs: 3000 }).catch(() => undefined)
  return result
})
