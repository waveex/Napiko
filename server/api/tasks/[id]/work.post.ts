/**
 * Rejestrator czasu pracy mechanika: start / pauza / zakończ.
 *  - start: zatrzymuje mój poprzedni licznik (jeden naraz), uruchamia nowy, zadanie → „w trakcie”,
 *  - pauza: zatrzymuje mój licznik; gdy nikt inny nie pracuje – zadanie → „wstrzymane”,
 *  - zakończ: zatrzymuje wszystkie liczniki zadania, zadanie → „zrobione”.
 */
import { and, eq, isNull, sql } from 'drizzle-orm'
import { withTenant } from '../../../db/tenant'
import { timeEntry } from '../../../db/schema'
import { taskWorkSchema } from '../../../../shared/schemas'

export default defineEventHandler(async (event) => {
  const ctx = await requireTenant(event, { task: ['work'] })
  const id = await getIdParam(event)
  const { action } = await readValidatedBody(event, body => taskWorkSchema.parse(body))
  const meta = requestMeta(event)

  try {
    return await withTenant(useDb(), ctx, async (tx) => {
      const { task: current, order } = await loadTaskWithOrder(tx, id)
      assertOrderOpen(order.status)
      if (!can(ctx, { task: ['update'] }) && !(await isAssignedToTask(tx, current.id, current.parentId, ctx.userId))) {
        throw createError({ statusCode: 403, message: 'Nad zadaniem pracuje osoba do niego przypisana.' })
      }
      if (current.status === 'cancelled') {
        throw createError({ statusCode: 409, message: 'Zadanie jest anulowane.' })
      }

      const [mine] = await tx.select({ id: timeEntry.id, taskId: timeEntry.taskId }).from(timeEntry)
        .where(and(eq(timeEntry.userId, ctx.userId), isNull(timeEntry.endedAt)))
        .limit(1)

      if (action === 'start') {
        if (mine?.taskId !== id) {
          if (mine) {
            await tx.update(timeEntry).set({ endedAt: sql`now()` }).where(eq(timeEntry.id, mine.id))
            // Poprzednie zadanie: jeśli nikt nad nim nie pracuje, oznaczamy je jako wstrzymane
            if (!(await hasRunningTimer(tx, mine.taskId))) {
              const previous = await loadTaskWithOrder(tx, mine.taskId)
              if (previous.task.status === 'in_progress') {
                await applyTaskStatus(tx, ctx, previous.task, previous.order, 'paused', meta)
              }
            }
          }
          await tx.insert(timeEntry).values({ orgId: ctx.orgId, taskId: id, workOrderId: order.id, userId: ctx.userId })
        }
        await applyTaskStatus(tx, ctx, current, order, 'in_progress', meta)
      }
      else if (action === 'pause') {
        if (mine?.taskId === id) {
          await tx.update(timeEntry).set({ endedAt: sql`now()` }).where(eq(timeEntry.id, mine.id))
        }
        if (current.status === 'in_progress' && !(await hasRunningTimer(tx, id))) {
          await applyTaskStatus(tx, ctx, current, order, 'paused', meta)
        }
      }
      else {
        await applyTaskStatus(tx, ctx, current, order, 'done', meta)
      }

      return { taskId: id, status: current.status, orderStatus: order.status }
    })
  }
  catch (error) {
    // Dwa równoległe „start” tej samej osoby – drugi trafia na unikalny indeks liczników
    if (isUniqueViolation(error)) {
      throw createError({ statusCode: 409, message: 'Licznik czasu już działa. Odśwież widok.' })
    }
    throw error
  }
})
