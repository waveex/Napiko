/**
 * Publiczna strona akceptacji (bez logowania) – dostęp wyłącznie przez losowy token z linku.
 * Zwracamy tylko treść tej jednej prośby: to, co zapisano w chwili wysyłki, i zdjęcia do niej przypięte.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { withSystem } from '../../../db/tenant'
import { recordAudit } from '../../../db/audit'
import {
  approvalItem, approvalRequest, fileObject, isEstimateSnapshot, organizationSettings, workOrderAttachment,
} from '../../../db/schema'
import { approvalTokenSchema } from '../../../../shared/schemas'

export default defineEventHandler(async (event) => {
  const { token } = await getValidatedRouterParams(event, params => approvalTokenSchema.parse(params))
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')

  return withSystem(useDb(), async (tx) => {
    const [approval] = await tx.select().from(approvalRequest)
      .where(eq(approvalRequest.tokenHash, hashApprovalToken(token))).limit(1)
    if (!approval) throw createError({ statusCode: 404, message: 'Link jest nieprawidłowy albo został usunięty.' })

    // Pierwsze otwarcie linku zapisujemy (warsztat widzi, że klient zajrzał) – poza podglądem zespołu
    const preview = await isOrganizationMember(event, approval.orgId)
    if (!preview && !approval.viewedAt && approval.status === 'pending') {
      const opened = await tx.update(approvalRequest).set({ viewedAt: new Date() })
        .where(and(eq(approvalRequest.id, approval.id), isNull(approvalRequest.viewedAt)))
        .returning({ id: approvalRequest.id })
      if (opened.length) {
        await recordAudit(tx, {
          orgId: approval.orgId,
          action: 'approval.viewed',
          entityType: 'approval',
          entityId: approval.id,
          data: { number: approval.snapshot.order.number },
          ...requestMeta(event),
        })
      }
    }

    const snapshot = approval.snapshot
    // Kosztorys: jedna decyzja o całości (kolumna decision), bez pozycji approval_item i zdjęć
    const decisions = isEstimateSnapshot(snapshot)
      ? []
      : await tx.select({ requestId: approvalItem.workRequestId, decision: approvalItem.decision })
          .from(approvalItem).where(eq(approvalItem.approvalId, approval.id))

    const storage = useFileStorage()
    const attachmentIds = isEstimateSnapshot(snapshot) ? [] : snapshot.items.flatMap(item => item.attachmentIds)
    const files = attachmentIds.length
      ? await tx
          .select({ id: workOrderAttachment.id, contentType: fileObject.contentType, fileName: fileObject.fileName, storageKey: fileObject.storageKey })
          .from(workOrderAttachment)
          .innerJoin(fileObject, eq(fileObject.id, workOrderAttachment.fileId))
          .where(and(
            inArray(workOrderAttachment.id, attachmentIds),
            eq(workOrderAttachment.orgId, approval.orgId),
            eq(workOrderAttachment.customerVisible, true),
            eq(fileObject.status, 'uploaded'),
          ))
      : []
    const photos = Object.fromEntries(await Promise.all(files.map(async f => [
      f.id,
      { contentType: f.contentType, url: await storage.presignDownload(f.storageKey, f.fileName, 3600) },
    ] as const)))

    const [settings] = await tx
      .select({ storageKey: fileObject.storageKey, fileName: fileObject.fileName })
      .from(organizationSettings)
      .innerJoin(fileObject, eq(fileObject.id, organizationSettings.logoFileId))
      .where(and(eq(organizationSettings.orgId, approval.orgId), eq(fileObject.status, 'uploaded')))
      .limit(1)

    const expired = approval.status === 'pending' && approval.expiresAt.getTime() < Date.now()
    return {
      kind: approval.kind,
      status: expired ? 'expired' as const : approval.status,
      decision: approval.decision,
      snapshot,
      expiresAt: approval.expiresAt,
      answeredAt: approval.answeredAt,
      customerNote: approval.customerNote,
      decisions: Object.fromEntries(decisions.map(d => [d.requestId, d.decision])),
      photos,
      logoUrl: settings ? await storage.presignDownload(settings.storageKey, settings.fileName, 3600) : null,
      preview,
    }
  })
})
