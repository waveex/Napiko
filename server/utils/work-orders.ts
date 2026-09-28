/**
 * Zlecenia: odczyt szczegółów, reguły przydzielania zadań i pracy mechanika.
 */
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Tx } from '../db/client'
import {
  approvalItem, approvalRequest, customer, fileObject, member, organizationSettings, task, taskAssignment, timeEntry,
  user, vehicle, workOrder, workOrderAttachment, workRequest,
} from '../db/schema'
import type { AssignmentPolicy } from '../db/schema'
import type { WorkOrderStatus } from '../../shared/workshop'
import type { TenantRequestContext } from './tenant'

/** Zamknięte i anulowane zlecenia są tylko do odczytu (najpierw trzeba je ponownie otworzyć). */
export function assertOrderOpen(status: WorkOrderStatus) {
  if (status === 'closed' || status === 'cancelled') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: 'Zlecenie jest zamknięte. Otwórz je ponownie, aby wprowadzić zmiany.',
    })
  }
}

/** Zadanie razem z podstawowymi danymi zlecenia (do sprawdzeń przed zmianą). */
export async function loadTaskWithOrder(tx: Tx, id: string) {
  const [row] = await tx
    .select({ task, order: { id: workOrder.id, number: workOrder.number, status: workOrder.status } })
    .from(task)
    .innerJoin(workOrder, eq(workOrder.id, task.workOrderId))
    .where(eq(task.id, id))
    .limit(1)
  if (!row) throw notFound('Nie znaleziono zadania.')
  return row
}

export async function getAssignmentPolicy(tx: Tx): Promise<AssignmentPolicy> {
  const [row] = await tx.select({ policy: organizationSettings.assignmentPolicy }).from(organizationSettings).limit(1)
  return row?.policy ?? 'office'
}

/**
 * Polityka organizacji decyduje, kto przydziela zadania:
 *  - "office": biuro przydziela (mechanicy nie biorą zadań sami),
 *  - "self": mechanicy biorą zadania sami (biuro nie przydziela innym),
 *  - "mixed": oba sposoby.
 */
export function assignmentCapabilities(ctx: TenantRequestContext, policy: AssignmentPolicy) {
  const officeMayAssign = can(ctx, { task: ['assign'] }) && policy !== 'self'
  const selfAssign = officeMayAssign || (can(ctx, { task: ['selfAssign'] }) && policy !== 'office')
  return { assignOthers: officeMayAssign, selfAssign }
}

/**
 * Czy bieżący użytkownik może przypisać osobę do zadania albo ją zdjąć.
 * Zdejmować innych może zawsze osoba z prawem przydziału (np. gdy mechanik jest na urlopie),
 * a przypisać można tylko członka zespołu.
 */
export async function assertMayChangeAssignment(tx: Tx, ctx: TenantRequestContext, userId: string, mode: 'assign' | 'unassign') {
  const caps = assignmentCapabilities(ctx, await getAssignmentPolicy(tx))
  const self = userId === ctx.userId
  const allowed = (mode === 'unassign' && can(ctx, { task: ['assign'] })) || (self ? caps.selfAssign : caps.assignOthers)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: self
        ? 'Zasady warsztatu nie pozwalają samodzielnie brać ani oddawać zadań.'
        : 'Zasady warsztatu nie pozwalają przydzielać zadań innym osobom.',
    })
  }
  if (mode === 'assign') {
    const [row] = await tx.select({ userId: member.userId }).from(member)
      .where(and(eq(member.organizationId, ctx.orgId), eq(member.userId, userId)))
      .limit(1)
    if (!row) throw createError({ statusCode: 422, message: 'Ta osoba nie należy do zespołu.' })
  }
}

/** Czy użytkownik jest przypisany do zadania albo do zadania nadrzędnego (podzadania dziedziczą przypisanie). */
export async function isAssignedToTask(tx: Tx, taskId: string, parentId: string | null, userId: string) {
  const ids = parentId ? [taskId, parentId] : [taskId]
  const [row] = await tx.select({ taskId: taskAssignment.taskId }).from(taskAssignment)
    .where(and(inArray(taskAssignment.taskId, ids), eq(taskAssignment.userId, userId)))
    .limit(1)
  return !!row
}

export async function loadWorkOrderDetail(tx: Tx, ctx: TenantRequestContext, id: string) {
  const [order] = await tx.select().from(workOrder).where(eq(workOrder.id, id)).limit(1)
  if (!order) throw notFound('Nie znaleziono zlecenia.')
  const [veh] = await tx.select().from(vehicle).where(eq(vehicle.id, order.vehicleId)).limit(1)
  const [cust] = await tx.select().from(customer).where(eq(customer.id, order.customerId)).limit(1)
  const tasks = await tx.select().from(task).where(eq(task.workOrderId, id)).orderBy(asc(task.position), asc(task.createdAt))
  const assignments = tasks.length
    ? await tx
        .select({ taskId: taskAssignment.taskId, userId: taskAssignment.userId, name: user.name })
        .from(taskAssignment)
        .innerJoin(user, eq(user.id, taskAssignment.userId))
        .where(inArray(taskAssignment.taskId, tasks.map(t => t.id)))
    : []

  // Czas pracy: suma zakończonych i trwających odcinków (liczona w bazie, jej zegarem)
  const times = await tx
    .select({
      taskId: timeEntry.taskId,
      seconds: sql<number>`coalesce(sum(extract(epoch from coalesce(${timeEntry.endedAt}, now()) - ${timeEntry.startedAt})), 0)::int`,
    })
    .from(timeEntry)
    .where(eq(timeEntry.workOrderId, id))
    .groupBy(timeEntry.taskId)
  const running = await tx
    .select({ taskId: timeEntry.taskId, userId: timeEntry.userId, name: user.name, startedAt: timeEntry.startedAt })
    .from(timeEntry)
    .leftJoin(user, eq(user.id, timeEntry.userId))
    .where(and(eq(timeEntry.workOrderId, id), isNull(timeEntry.endedAt)))

  const policy = await getAssignmentPolicy(tx)
  const assign = assignmentCapabilities(ctx, policy)

  const withAssignees = tasks.map(t => ({
    ...t,
    assignees: assignments.filter(a => a.taskId === t.id).map(a => ({ id: a.userId, name: a.name })),
    timeSpentSeconds: times.find(x => x.taskId === t.id)?.seconds ?? 0,
    running: running.filter(r => r.taskId === t.id).map(r => ({ userId: r.userId, name: r.name, startedAt: r.startedAt })),
  }))
  const tree = withAssignees
    .filter(t => !t.parentId)
    .map(t => ({ ...t, subtasks: withAssignees.filter(s => s.parentId === t.id) }))

  const seePrices = can(ctx, { workRequest: ['quote'] })
  const requests = can(ctx, { workRequest: ['read'] })
    ? (await tx
        .select({ request: workRequest, reporterName: user.name })
        .from(workRequest)
        .leftJoin(user, eq(user.id, workRequest.reportedBy))
        .where(eq(workRequest.workOrderId, id))
        .orderBy(desc(workRequest.createdAt)))
        .map(r => ({ ...maskRequestPrices(r.request, seePrices), reporterName: r.reporterName }))
    : []

  const attachments = can(ctx, { file: ['read'] }) ? await loadAttachments(tx, id) : []
  const billing = can(ctx, { billing: ['read'] })
  // Prośby o akceptację kosztorysu widzi tylko osoba z dostępem do rozliczeń (są w nich ceny)
  const approvals = can(ctx, { workRequest: ['read'] })
    ? (await loadApprovals(tx, ctx, id)).filter(a => a.kind !== 'estimate' || billing)
    : []
  const estimate = billing ? await loadEstimate(tx, id) : null

  return {
    ...order,
    // numer paragonu to dane rozliczeniowe – mechanik ich nie potrzebuje
    receiptNumber: billing ? order.receiptNumber : null,
    receiptIssuedOn: billing ? order.receiptIssuedOn : null,
    estimate,
    vehicle: veh!,
    customer: maskCustomer(cust!, can(ctx, { customerContact: ['read'] })),
    tasks: tree,
    requests,
    attachments,
    approvals,
    timeSpentSeconds: times.reduce((sum, x) => sum + x.seconds, 0),
    assignmentPolicy: policy,
    serverTime: new Date(),
    can: {
      update: can(ctx, { workOrder: ['update'] }),
      createTask: can(ctx, { task: ['create'] }),
      updateTask: can(ctx, { task: ['update'] }),
      work: can(ctx, { task: ['work'] }),
      assignOthers: assign.assignOthers,
      selfAssign: assign.selfAssign,
      /** zdejmowanie przydziałów niezależnie od polityki (np. urlop mechanika) */
      manageAssignments: can(ctx, { task: ['assign'] }),
      reportNeeds: can(ctx, { workRequest: ['create'] }),
      quote: seePrices,
      decide: can(ctx, { workRequest: ['decide'] }),
      uploadFiles: can(ctx, { file: ['upload'] }),
      billing,
      editBilling: can(ctx, { billing: ['update'] }),
    },
  }
}

/** Ceny i notatki biura widzi tylko biuro (mechanik widzi, co zgłosił i na jakim etapie jest zgłoszenie). */
export function maskRequestPrices<T extends { partsNet: string | null, laborNet: string | null, officeNote: string | null }>(
  request: T,
  visible: boolean,
): T {
  return visible ? request : { ...request, partsNet: null, laborNet: null, officeNote: null }
}

/** Zdjęcia i filmy zlecenia z krótkotrwałymi adresami do podglądu. */
export async function loadAttachments(tx: Tx, workOrderId: string) {
  const rows = await tx
    .select({
      id: workOrderAttachment.id,
      taskId: workOrderAttachment.taskId,
      workRequestId: workOrderAttachment.workRequestId,
      caption: workOrderAttachment.caption,
      customerVisible: workOrderAttachment.customerVisible,
      createdBy: workOrderAttachment.createdBy,
      createdAt: workOrderAttachment.createdAt,
      authorName: user.name,
      fileName: fileObject.fileName,
      contentType: fileObject.contentType,
      sizeBytes: fileObject.sizeBytes,
      storageKey: fileObject.storageKey,
    })
    .from(workOrderAttachment)
    .innerJoin(fileObject, eq(fileObject.id, workOrderAttachment.fileId))
    .leftJoin(user, eq(user.id, workOrderAttachment.createdBy))
    .where(and(eq(workOrderAttachment.workOrderId, workOrderId), eq(fileObject.status, 'uploaded')))
    .orderBy(asc(workOrderAttachment.createdAt))
  const storage = useFileStorage()
  return Promise.all(rows.map(async ({ storageKey, ...row }) => ({
    ...row,
    url: await storage.presignDownload(storageKey, row.fileName, 3600),
  })))
}

/** Prośby o akceptację wysłane klientowi (adres odbiorcy widzi tylko osoba z dostępem do kontaktu). */
export async function loadApprovals(tx: Tx, ctx: TenantRequestContext, workOrderId: string) {
  const rows = await tx
    .select({
      id: approvalRequest.id,
      kind: approvalRequest.kind,
      status: approvalRequest.status,
      decision: approvalRequest.decision,
      channel: approvalRequest.channel,
      recipient: approvalRequest.recipient,
      expiresAt: approvalRequest.expiresAt,
      viewedAt: approvalRequest.viewedAt,
      answeredAt: approvalRequest.answeredAt,
      customerNote: approvalRequest.customerNote,
      createdAt: approvalRequest.createdAt,
      sentByName: user.name,
      totalGrossCents: sql<number>`(${approvalRequest.snapshot}->>'totalGrossCents')::int`,
    })
    .from(approvalRequest)
    .leftJoin(user, eq(user.id, approvalRequest.sentBy))
    .where(eq(approvalRequest.workOrderId, workOrderId))
    .orderBy(desc(approvalRequest.createdAt))
  const items = rows.length
    ? await tx.select().from(approvalItem).where(inArray(approvalItem.approvalId, rows.map(r => r.id)))
    : []
  const contact = can(ctx, { customerContact: ['read'] })
  const now = Date.now()
  return rows.map(r => ({
    ...r,
    recipient: contact ? r.recipient : null,
    expired: r.status === 'pending' && r.expiresAt.getTime() < now,
    items: items.filter(i => i.approvalId === r.id).map(i => ({ requestId: i.workRequestId, decision: i.decision })),
  }))
}
