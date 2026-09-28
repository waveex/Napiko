/**
 * Spis potrzeb zgłoszonych przez mechaników we wszystkich zleceniach (per pojazd) –
 * dla biura: co wycenić, o co zapytać klienta, co zamówić.
 */
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { withTenant } from '../../db/tenant'
import { customer, fileObject, user, vehicle, workOrder, workOrderAttachment, workRequest } from '../../db/schema'
import { OPEN_WORK_REQUEST_STATUSES, type WorkRequestStatus } from '../../../shared/workshop'

const querySchema = z.object({ view: z.enum(['open', 'closed']).default('open') })

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { workRequest: ['read'] })
  const { view } = await getValidatedQuery(event, query => querySchema.parse(query))
  const statuses: WorkRequestStatus[] = view === 'open' ? [...OPEN_WORK_REQUEST_STATUSES] : ['rejected', 'done', 'cancelled']
  const seePrices = can(ctx, { workRequest: ['quote'] })

  return withTenant(useDb(), ctx, async (tx) => {
    const rows = await tx
      .select({
        request: workRequest,
        reporterName: user.name,
        order: { id: workOrder.id, number: workOrder.number, status: workOrder.status },
        vehicle: {
          id: vehicle.id,
          type: vehicle.type,
          make: vehicle.make,
          model: vehicle.model,
          registrationNumber: vehicle.registrationNumber,
          serialNumber: vehicle.serialNumber,
        },
        customerName: customer.name,
      })
      .from(workRequest)
      .innerJoin(workOrder, eq(workOrder.id, workRequest.workOrderId))
      .innerJoin(vehicle, eq(vehicle.id, workOrder.vehicleId))
      .innerJoin(customer, eq(customer.id, workOrder.customerId))
      .leftJoin(user, eq(user.id, workRequest.reportedBy))
      .where(and(inArray(workRequest.status, statuses)))
      .orderBy(
        asc(sql`case ${workRequest.urgency} when 'urgent' then 0 when 'recommended' then 1 else 2 end`),
        view === 'open' ? asc(workRequest.createdAt) : desc(workRequest.updatedAt),
      )
      .limit(200)

    // Zdjęcia zgłoszeń – biuro widzi, co mechanik znalazł, zanim wyceni
    const ids = rows.map(r => r.request.id)
    const files = ids.length && can(ctx, { file: ['read'] })
      ? await tx
          .select({
            id: workOrderAttachment.id,
            workRequestId: workOrderAttachment.workRequestId,
            caption: workOrderAttachment.caption,
            createdBy: workOrderAttachment.createdBy,
            createdAt: workOrderAttachment.createdAt,
            authorName: user.name,
            fileName: fileObject.fileName,
            contentType: fileObject.contentType,
            storageKey: fileObject.storageKey,
          })
          .from(workOrderAttachment)
          .innerJoin(fileObject, eq(fileObject.id, workOrderAttachment.fileId))
          .leftJoin(user, eq(user.id, workOrderAttachment.createdBy))
          .where(and(inArray(workOrderAttachment.workRequestId, ids), eq(fileObject.status, 'uploaded')))
      : []
    const storage = useFileStorage()
    const attachments = await Promise.all(files.map(async ({ storageKey, ...file }) => ({
      ...file,
      url: await storage.presignDownload(storageKey, file.fileName, 3600),
    })))

    return {
      requests: rows.map(r => ({
        ...maskRequestPrices(r.request, seePrices),
        reporterName: r.reporterName,
        order: r.order,
        vehicle: r.vehicle,
        customerName: r.customerName,
        attachments: attachments.filter(a => a.workRequestId === r.request.id),
      })),
      can: {
        quote: seePrices,
        decide: can(ctx, { workRequest: ['decide'] }),
      },
    }
  })
})
