/**
 * Prośba do klienta o akceptację wycenionych prac dodatkowych (i części).
 * Klient dostaje link (e-mail, SMS albo przekazany osobiście), widzi opis, zdjęcia i ceny brutto
 * i decyduje o każdej pozycji osobno. Zapisujemy dokładną treść, którą zobaczy (snapshot + skrót).
 */
import { and, eq, gt, inArray, sql } from 'drizzle-orm'
import { withTenant } from '../../../db/tenant'
import { recordAudit } from '../../../db/audit'
import { enqueueJob } from '../../../db/jobs'
import { queueApprovalDelivery } from '../../../db/customer-notifications'
import { getEnv } from '../../../lib/env'
import {
  approvalItem, approvalRequest, fileObject, organization, organizationSettings, vehicle, workOrder,
  workOrderAttachment, workRequest, type ApprovalSnapshot,
} from '../../../db/schema'
import { approvalCreateSchema } from '../../../../shared/schemas'
import { grossCents, normalizePhone } from '../../../../shared/workshop'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { workRequest: ['decide'] })
  const workOrderId = await getIdParam(event)
  const input = await readValidatedBody(event, body => approvalCreateSchema.parse(body))
  const meta = requestMeta(event)

  const result = await withTenant(useDb(), ctx, async (tx) => {
    const [row] = await tx
      .select({ order: workOrder, vehicle })
      .from(workOrder)
      .innerJoin(vehicle, eq(vehicle.id, workOrder.vehicleId))
      .where(eq(workOrder.id, workOrderId))
      .limit(1)
    if (!row) throw notFound('Nie znaleziono zlecenia.')
    const { order } = row
    assertOrderOpen(order.status)

    const ids = [...new Set(input.requestIds)]
    const requests = await tx.select().from(workRequest)
      .where(and(inArray(workRequest.id, ids), eq(workRequest.workOrderId, workOrderId)))
    if (requests.length !== ids.length) {
      throw createError({ statusCode: 422, message: 'Wybrane pozycje nie należą do tego zlecenia.' })
    }
    const unpriced = requests.find(r => r.status !== 'quoted')
    if (unpriced) {
      throw createError({ statusCode: 409, message: `Pozycja „${unpriced.title}” nie ma wyceny albo ma już decyzję.` })
    }
    const pending = await tx
      .select({ requestId: approvalItem.workRequestId })
      .from(approvalItem)
      .innerJoin(approvalRequest, eq(approvalRequest.id, approvalItem.approvalId))
      // wygasłe prośby nie blokują wysłania nowego linku
      .where(and(inArray(approvalItem.workRequestId, ids), eq(approvalRequest.status, 'pending'), gt(approvalRequest.expiresAt, sql`now()`)))
    if (pending.length) {
      const title = requests.find(r => r.id === pending[0]!.requestId)?.title
      throw createError({ statusCode: 409, message: `Pozycja „${title}” czeka już na odpowiedź klienta. Wycofaj poprzednią prośbę, aby wysłać nową.` })
    }

    // Zdjęcia zgłoszeń stają się widoczne dla klienta
    const photos = await tx
      .select({ id: workOrderAttachment.id, requestId: workOrderAttachment.workRequestId })
      .from(workOrderAttachment)
      .innerJoin(fileObject, eq(fileObject.id, workOrderAttachment.fileId))
      .where(and(inArray(workOrderAttachment.workRequestId, ids), eq(fileObject.status, 'uploaded')))
    if (photos.length) {
      await tx.update(workOrderAttachment).set({ customerVisible: true })
        .where(inArray(workOrderAttachment.id, photos.map(p => p.id)))
    }

    const [org] = await tx.select({ name: organization.name }).from(organization).where(eq(organization.id, ctx.orgId)).limit(1)
    const [settings] = await tx.select({ smsSenderName: organizationSettings.smsSenderName }).from(organizationSettings).limit(1)
    const now = new Date()
    const items = ids.map((id) => {
      const r = requests.find(x => x.id === id)!
      return {
        requestId: r.id,
        title: r.title,
        description: r.description,
        kind: r.kind,
        urgency: r.urgency,
        partsNet: r.partsNet,
        laborNet: r.laborNet,
        vatRate: r.vatRate,
        grossCents: grossCents(r.partsNet, r.laborNet, r.vatRate),
        attachmentIds: photos.filter(p => p.requestId === r.id).map(p => p.id),
      }
    })
    const snapshot: ApprovalSnapshot = {
      version: 1,
      organization: { name: org!.name },
      order: { number: order.number },
      vehicle: {
        type: row.vehicle.type,
        make: row.vehicle.make,
        model: row.vehicle.model,
        registrationNumber: row.vehicle.registrationNumber,
      },
      message: input.message,
      currency: 'PLN',
      items,
      totalGrossCents: items.reduce((sum, item) => sum + item.grossCents, 0),
      createdAt: now.toISOString(),
    }
    const snapshotHash = hashSnapshot(snapshot)
    const token = generateApprovalToken()
    const expiresAt = new Date(now.getTime() + input.expiresInDays * 24 * 3600 * 1000)
    const recipient = input.channel === 'sms' ? normalizePhone(input.recipient) : input.recipient

    const [approval] = await tx.insert(approvalRequest).values({
      orgId: ctx.orgId,
      workOrderId,
      tokenHash: hashApprovalToken(token),
      channel: input.channel,
      recipient: input.channel === 'link' ? null : recipient,
      snapshot,
      snapshotHash,
      expiresAt,
      sentBy: ctx.userId,
    }).returning({ id: approvalRequest.id })
    await tx.insert(approvalItem).values(ids.map(id => ({ orgId: ctx.orgId, approvalId: approval!.id, workRequestId: id })))

    // Zlecenie czeka na klienta
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
      data: { number: order.number, channel: input.channel, items: ids.length, totalGrossCents: snapshot.totalGrossCents, snapshotHash },
      ...meta,
    })

    const url = approvalUrl(token)
    const vehicleName = [row.vehicle.make, row.vehicle.model].filter(Boolean).join(' ') || order.number
    const plate = row.vehicle.registrationNumber ? ` ${row.vehicle.registrationNumber}` : ''
    if (input.channel !== 'link' && recipient) {
      // SMS (albo push na zarejestrowany telefon klienta) lub e-mail – wpis w dzienniku wiadomości klienta
      await queueApprovalDelivery(tx, getEnv(), {
        orgId: ctx.orgId,
        workOrderId,
        approvalId: approval!.id,
        kind: 'work_requests',
        channel: input.channel,
        recipient,
        sentBy: ctx.userId,
        organizationName: org!.name,
        smsFrom: settings?.smsSenderName ?? null,
        vehicle: `${vehicleName}${plate}`,
        orderNumber: order.number,
        url,
        message: input.message,
        expires: expiresAt.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', dateStyle: 'short', timeStyle: 'short' }),
      })
    }
    // Po terminie linku: powiadomienie dla wysyłającego, jeśli klient nie odpowiedział
    await enqueueJob(tx, {
      type: 'approval.expiry-check',
      orgId: ctx.orgId,
      payload: { approvalId: approval!.id },
      runAt: new Date(expiresAt.getTime() + 60_000),
    })

    return { id: approval!.id, url, expiresAt }
  })

  // E-mail / SMS wychodzi od razu (kolejka ponowi wysyłkę, jeśli bramka nie odpowie)
  await deliverNotifications(event)
  return result
})
