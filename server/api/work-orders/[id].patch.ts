/**
 * Zmiana zlecenia: status, zakres, termin, licznik i paragon. Zmiana statusu trafia do dziennika zdarzeń.
 * Numer paragonu (rozliczenia) można wpisać także w zamkniętym zleceniu – zwykle robi się to przy zamknięciu.
 * „Gotowe do odbioru” wysyła klientowi wiadomość (pole „Powiadom klienta” albo ustawienia warsztatu).
 */
import { eq } from 'drizzle-orm'
import { withTenant } from '../../db/tenant'
import { recordAudit } from '../../db/audit'
import { queueOrderStatusNotification } from '../../db/customer-notifications'
import { getEnv } from '../../lib/env'
import { workOrder } from '../../db/schema'
import { workOrderUpdateSchema } from '../../../shared/schemas'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { workOrder: ['update'] })
  const id = await getIdParam(event)
  const input = await readValidatedBody(event, body => workOrderUpdateSchema.parse(body))
  if (input.notifyCustomer) assertCan(ctx, { customerNotification: ['send'] })
  let notified = false

  const result = await withTenant(useDb(), ctx, async (tx) => {
    const [before] = await tx.select().from(workOrder).where(eq(workOrder.id, id)).limit(1)
    if (!before) throw notFound('Nie znaleziono zlecenia.')
    // Zamknięte zlecenie można tylko ponownie otworzyć (zmianą statusu) albo uzupełnić w nim paragon.
    const onlyStatus = input.description === undefined && input.meterValue === undefined && input.promisedAt === undefined
    if (!onlyStatus) assertOrderOpen(before.status)
    const receiptChange = input.receiptNumber !== undefined || input.receiptIssuedOn !== undefined
    if (receiptChange) assertCan(ctx, { billing: ['update'] })

    const values: Partial<typeof workOrder.$inferInsert> = {}
    if (input.receiptNumber !== undefined && input.receiptNumber !== before.receiptNumber) values.receiptNumber = input.receiptNumber
    if (input.receiptIssuedOn !== undefined && input.receiptIssuedOn !== before.receiptIssuedOn) values.receiptIssuedOn = input.receiptIssuedOn
    // bez numeru paragonu nie ma też jego daty
    if (values.receiptNumber === null) values.receiptIssuedOn = null
    if (input.description !== undefined) values.description = input.description
    if (input.meterValue !== undefined) values.meterValue = input.meterValue
    if (input.promisedAt !== undefined) values.promisedAt = input.promisedAt ? new Date(input.promisedAt) : null
    if (input.status && input.status !== before.status) {
      values.status = input.status
      values.closedAt = input.status === 'closed' || input.status === 'cancelled' ? new Date() : null
    }
    if (Object.keys(values).length === 0) return loadWorkOrderDetail(tx, ctx, id)

    await tx.update(workOrder).set(values).where(eq(workOrder.id, id))

    if (values.status) {
      await recordAudit(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'work_order.status_changed',
        entityType: 'work_order',
        entityId: id,
        data: { number: before.number, from: before.status, to: values.status },
        ...requestMeta(event),
      })
      // Zamknięcie zlecenia to odbiór pojazdu – kończymy też otwarte zadanie „Wydanie auta”
      if (values.status === 'closed') {
        await completeHandoverOnClose(tx, ctx, { id, number: before.number, status: 'closed' }, requestMeta(event))
      }
      // Pojazd gotowy do odbioru – wiadomość do klienta (SMS / push i e-mail według ustawień warsztatu)
      if (values.status === 'ready' && input.notifyCustomer !== false && can(ctx, { customerNotification: ['send'] })) {
        const queued = await queueOrderStatusNotification(tx, getEnv(), {
          orgId: ctx.orgId,
          workOrderId: id,
          event: 'order_ready',
          trigger: 'auto',
          force: input.notifyCustomer === true,
          actorUserId: ctx.userId,
          meta: requestMeta(event),
        })
        notified = queued.length > 0
      }
    }
    if (values.receiptNumber !== undefined || values.receiptIssuedOn !== undefined) {
      await recordAudit(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'work_order.receipt_recorded',
        entityType: 'work_order',
        entityId: id,
        data: {
          number: before.number,
          receiptNumber: values.receiptNumber !== undefined ? values.receiptNumber : before.receiptNumber,
          receiptIssuedOn: values.receiptIssuedOn !== undefined ? values.receiptIssuedOn : before.receiptIssuedOn,
        },
        ...requestMeta(event),
      })
    }
    const otherFields = Object.keys(values).filter(k => !['status', 'closedAt', 'receiptNumber', 'receiptIssuedOn'].includes(k))
    if (otherFields.length) {
      await recordAudit(tx, {
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'work_order.updated',
        entityType: 'work_order',
        entityId: id,
        data: { number: before.number, fields: otherFields },
        ...requestMeta(event),
      })
    }
    return loadWorkOrderDetail(tx, ctx, id)
  })

  if (notified) await deliverNotifications(event)
  return result
})
