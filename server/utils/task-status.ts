/**
 * Jedna ścieżka zmiany statusu zadania dla wszystkich miejsc w aplikacji
 * (lista zadań, rejestrator czasu, zgłoszenia potrzeb, decyzje biura):
 *  - daty rozpoczęcia i zakończenia zadania,
 *  - zatrzymanie liczników czasu, gdy zadanie przestaje być „w trakcie”,
 *  - automatyczne przejście przyjętego zlecenia do realizacji,
 *  - wpisy w dzienniku zdarzeń.
 */
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Tx } from '../db/client'
import { recordAudit } from '../db/audit'
import { task, timeEntry, workOrder } from '../db/schema'
import type { TaskStatus, WorkOrderStatus } from '../../shared/workshop'

/** Kto wykonuje zmianę: członek zespołu albo – przy decyzji klienta przez link – system (userId: null). */
export interface Actor {
  orgId: string
  userId: string | null
}

export interface RequestMeta {
  ip: string | null
  userAgent: string | null
}

export interface TaskRef {
  id: string
  title: string
  status: TaskStatus
  startedAt: Date | null
}

export interface OrderRef {
  id: string
  number: string
  status: WorkOrderStatus
}

export async function applyTaskStatus(
  tx: Tx,
  ctx: Actor,
  current: TaskRef,
  order: OrderRef,
  next: TaskStatus,
  meta: RequestMeta,
): Promise<boolean> {
  if (next === current.status) return false

  await tx.update(task).set({
    status: next,
    ...(next === 'in_progress' && !current.startedAt ? { startedAt: sql`now()` } : {}),
    completedAt: next === 'done' ? sql`now()` : null,
  }).where(eq(task.id, current.id))

  if (next !== 'in_progress') {
    // czas bazy (now()), a nie serwera aplikacji – bez ryzyka końca przed początkiem
    await tx.update(timeEntry).set({ endedAt: sql`now()` })
      .where(and(eq(timeEntry.taskId, current.id), isNull(timeEntry.endedAt)))
  }

  await recordAudit(tx, {
    orgId: ctx.orgId,
    actorUserId: ctx.userId,
    action: 'task.status_changed',
    entityType: 'task',
    entityId: current.id,
    data: { number: order.number, title: current.title, from: current.status, to: next },
    ...meta,
  })
  current.status = next

  if (next === 'in_progress' && order.status === 'received') {
    await tx.update(workOrder).set({ status: 'in_progress' }).where(eq(workOrder.id, order.id))
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'work_order.status_changed',
      entityType: 'work_order',
      entityId: order.id,
      data: { number: order.number, from: 'received', to: 'in_progress', automatic: true },
      ...meta,
    })
    order.status = 'in_progress'
  }
  return true
}

/** Czy ktoś jeszcze pracuje nad zadaniem (uruchomiony licznik). */
export async function hasRunningTimer(tx: Tx, taskId: string) {
  const [row] = await tx.select({ id: timeEntry.id }).from(timeEntry)
    .where(and(eq(timeEntry.taskId, taskId), isNull(timeEntry.endedAt)))
    .limit(1)
  return !!row
}

/** Błąd unikalności z PostgreSQL (Drizzle opakowuje go w „Failed query”). */
export function isUniqueViolation(error: unknown) {
  const err = error as { code?: string, cause?: { code?: string } }
  return err?.code === '23505' || err?.cause?.code === '23505'
}
