/**
 * Jedna ścieżka zmiany statusu zadania dla wszystkich miejsc w aplikacji
 * (lista zadań, rejestrator czasu, zgłoszenia potrzeb, decyzje biura):
 *  - daty rozpoczęcia i zakończenia zadania,
 *  - zatrzymanie liczników czasu, gdy zadanie przestaje być „w trakcie”,
 *  - automatyczne przejście przyjętego zlecenia do realizacji,
 *  - wpisy w dzienniku zdarzeń,
 *  - zadanie „Wydanie auta”: dokładane, gdy zakończono ostatnie zadanie zlecenia, i wycofywane, gdy praca wróci
 *    (zob. syncHandoverTask),
 *  - powiadomienie biura, gdy zakończono ostatnie zadanie zlecenia (można wydać pojazd).
 */
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Tx } from '../db/client'
import { recordAudit } from '../db/audit'
import { notifyIfAllTasksDone } from '../db/notifications'
import { task, timeEntry, workOrder } from '../db/schema'
import { allWorkDone, HANDOVER_TASK_TITLE, type TaskKind, type TaskStatus, type WorkOrderStatus } from '../../shared/workshop'

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
  kind: TaskKind
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

  // Wydanie auta nie zmienia stanu prac, więc nie dokłada się ani nie wycofuje samo przez siebie
  if (current.kind === 'work') {
    await syncHandoverTask(tx, ctx, order, meta)
    if (next === 'done') {
      await notifyIfAllTasksDone(tx, { orgId: ctx.orgId, actorUserId: ctx.userId, workOrderId: order.id })
    }
  }
  return true
}

/**
 * Zadanie „Wydanie auta” podąża za stanem prac:
 *  - wszystkie zadania robocze zrobione i nie ma jeszcze wydania → dokładamy je na koniec listy,
 *  - praca wróciła (nowe zadanie, cofnięty status, usunięte zadanie), a wydanie jest nietknięte → wycofujemy je,
 *  - wydanie, którym ktoś już się zajął (zrobione, anulowane, rozpoczęte), zostaje bez zmian –
 *    anulowanego nie dokładamy ponownie.
 * Wołamy to po każdej zmianie zbioru albo statusów zadań (dla zleceń zamkniętych i anulowanych nic nie robi).
 */
export async function syncHandoverTask(tx: Tx, ctx: Actor, order: OrderRef, meta: RequestMeta) {
  if (order.status === 'closed' || order.status === 'cancelled') return

  const rows = await tx
    .select({ id: task.id, kind: task.kind, status: task.status, parentId: task.parentId, position: task.position, startedAt: task.startedAt })
    .from(task)
    .where(eq(task.workOrderId, order.id))
  const handover = rows.find(r => r.kind === 'handover')

  if (allWorkDone(rows)) {
    if (handover) return
    const next = rows.reduce((max, r) => (r.parentId ? max : Math.max(max, r.position + 1)), 0)
    // Dwa równoległe zakończenia ostatnich zadań: wygrywa pierwsze, drugie trafia w indeks unikalny i nic nie robi
    const [created] = await tx.insert(task).values({
      orgId: ctx.orgId,
      workOrderId: order.id,
      kind: 'handover',
      title: HANDOVER_TASK_TITLE,
      position: next,
    }).onConflictDoNothing().returning({ id: task.id })
    if (!created) return
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'task.created',
      entityType: 'task',
      entityId: created.id,
      data: { number: order.number, title: HANDOVER_TASK_TITLE, subtask: false, kind: 'handover', automatic: true },
      ...meta,
    })
    return
  }

  if (handover && handover.status === 'todo' && !handover.startedAt) {
    await tx.delete(task).where(eq(task.id, handover.id))
    await recordAudit(tx, {
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'task.deleted',
      entityType: 'task',
      entityId: handover.id,
      data: { number: order.number, title: HANDOVER_TASK_TITLE, subtask: false, kind: 'handover', automatic: true },
      ...meta,
    })
  }
}

/** Zamknięcie zlecenia oznacza, że pojazd został wydany – otwarte zadanie wydania kończymy razem z nim. */
export async function completeHandoverOnClose(tx: Tx, ctx: Actor, order: OrderRef, meta: RequestMeta) {
  const [handover] = await tx
    .select({ id: task.id, title: task.title, kind: task.kind, status: task.status, startedAt: task.startedAt })
    .from(task)
    .where(and(eq(task.workOrderId, order.id), eq(task.kind, 'handover')))
    .limit(1)
  if (!handover || handover.status === 'done' || handover.status === 'cancelled') return
  await applyTaskStatus(tx, ctx, handover, order, 'done', meta)
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
