/**
 * Decyzja w zgłoszeniu potrzeby – wspólna dla biura (np. zgoda telefoniczna) i klienta (link z akceptacją):
 *  - status zgłoszenia i kto / jak zdecydował,
 *  - zatwierdzona praca dodatkowa staje się nowym zadaniem, przydzielonym mechanikowi, który ją zgłosił,
 *  - zadanie wstrzymane w oczekiwaniu na decyzję wraca do mechanika,
 *  - zatwierdzona wycena trafia do kosztorysu zlecenia (robocizna i części osobno),
 *  - wpis w dzienniku zdarzeń.
 */
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Tx } from '../db/client'
import { recordAudit } from '../db/audit'
import { member, task, taskAssignment, workRequest } from '../db/schema'
import type { WorkRequestKind } from '../../shared/workshop'
import type { Actor, OrderRef, RequestMeta } from './task-status'

export interface RequestRef {
  id: string
  workOrderId: string
  taskId: string | null
  kind: WorkRequestKind
  title: string
  description: string | null
  reportedBy: string | null
  partsNet: string | null
  laborNet: string | null
  vatRate: string
}

export async function decideWorkRequest(
  tx: Tx,
  actor: Actor,
  request: RequestRef,
  order: OrderRef,
  decision: 'approved' | 'rejected',
  options: { note: string | null, via: 'office' | 'customer', approvalId?: string },
  meta: RequestMeta,
) {
  let createdTaskId: string | null = null

  if (decision === 'approved' && request.kind === 'extra_work') {
    const [{ next } = { next: 0 }] = await tx
      .select({ next: sql<number>`coalesce(max(${task.position}) + 1, 0)::int` })
      .from(task)
      .where(and(eq(task.workOrderId, request.workOrderId), isNull(task.parentId)))
    const [created] = await tx.insert(task).values({
      orgId: actor.orgId,
      workOrderId: request.workOrderId,
      title: request.title,
      description: request.description,
      position: next,
      createdBy: actor.userId,
    }).returning({ id: task.id })
    createdTaskId = created!.id

    // Pracę wykonuje zwykle ten, kto ją znalazł – o ile nadal jest w zespole
    if (request.reportedBy) {
      const [stillMember] = await tx.select({ userId: member.userId }).from(member)
        .where(and(eq(member.organizationId, actor.orgId), eq(member.userId, request.reportedBy)))
        .limit(1)
      if (stillMember) {
        await tx.insert(taskAssignment).values({
          orgId: actor.orgId,
          taskId: createdTaskId,
          userId: request.reportedBy,
          assignedBy: actor.userId,
        })
      }
    }
    await recordAudit(tx, {
      orgId: actor.orgId,
      actorUserId: actor.userId,
      action: 'task.created',
      entityType: 'task',
      entityId: createdTaskId,
      data: { number: order.number, title: request.title, fromRequest: request.id },
      ...meta,
    })
  }

  await tx.update(workRequest).set({
    status: decision,
    decisionNote: options.note,
    decidedBy: actor.userId,
    decidedAt: sql`now()`,
    createdTaskId,
  }).where(eq(workRequest.id, request.id))

  await recordAudit(tx, {
    orgId: actor.orgId,
    actorUserId: actor.userId,
    action: 'work_request.decided',
    entityType: 'work_request',
    entityId: request.id,
    data: {
      number: order.number,
      title: request.title,
      decision,
      via: options.via,
      ...(options.approvalId ? { approvalId: options.approvalId } : {}),
    },
    ...meta,
  })

  if (decision === 'approved') {
    await addRequestToEstimate(tx, actor, request, order.number, meta)
  }

  // Zadanie wstrzymane „do decyzji klienta” wraca do mechanika
  if (request.taskId && request.kind === 'extra_work') {
    const related = await loadTaskWithOrder(tx, request.taskId)
    if (related.task.status === 'waiting_approval') {
      await applyTaskStatus(tx, actor, related.task, related.order, 'paused', meta)
    }
  }

  return { createdTaskId }
}
