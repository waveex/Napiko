/**
 * Powiadomienia zespołu: jedna funkcja rozsyła zdarzenie do właściwych osób.
 *  - dzwonek w aplikacji – zawsze (tabela notification),
 *  - e-mail i push – według ustawień osoby (notification_preference, domyślne w shared/notifications.ts).
 *
 * Wywołujemy ją w tej samej transakcji co zmianę danych (jak kolejkę zadań): nie ma sytuacji
 * „zlecenie zmienione, ale powiadomienie zginęło”. E-maile i push wychodzą przez kolejkę zadań.
 * Moduł nie zależy od Nuxta – korzystają z niego endpointy, zadania w tle i testy.
 */
import { randomUUID } from 'node:crypto'
import { and, count, eq, inArray, sql } from 'drizzle-orm'
import type { Db, Tx } from './client'
import { enqueueJob } from './jobs'
import { withSystem } from './tenant'
import {
  customer, member, notification, notificationPreference, organization, organizationSettings, task, taskAssignment, user,
  vehicle, workOrder,
} from './schema'
import { getEnv } from '../lib/env'
import { isPushConfigured } from '../lib/push'
import { renderTeamNotification } from '../lib/notification-texts'
import { hasPermission, type PermissionRequest } from '../../shared/permissions'
import {
  TEAM_NOTIFICATIONS, vehicleText, type TeamNotificationData, type TeamNotificationType,
} from '../../shared/notifications'
import type { WorkRequestKind } from '../../shared/workshop'

export interface NotifyTeamInput {
  orgId: string
  type: TeamNotificationType
  /** kto wywołał zdarzenie – nie powiadamiamy go o jego własnym działaniu; null = klient albo system */
  actorUserId: string | null
  /** konkretni odbiorcy (np. przypisany mechanik, autor zgłoszenia) */
  userIds?: (string | null | undefined)[]
  /** oraz wszyscy członkowie zespołu z tym uprawnieniem (np. biuro, które wycenia zgłoszenia) */
  permission?: PermissionRequest
  /** z wyjątkiem osób z tym uprawnieniem (domyślnie wyjątek z opisu typu powiadomienia) */
  except?: PermissionRequest
  workOrderId?: string | null
  entity?: { type: string, id: string } | null
  /** ścieżka w aplikacji, np. /app/orders/<id> */
  link?: string | null
  data: TeamNotificationData
}

export interface TeamNotificationJob {
  orgId: string
  userId: string
  notificationId: string
  title: string
  body: string
  url: string
  tag: string
  lang: string
}

/** Rozsyła powiadomienie; zwraca identyfikatory utworzonych powiadomień (po jednym na odbiorcę). */
export async function notifyTeam(tx: Tx, input: NotifyTeamInput): Promise<string[]> {
  const members = await tx
    .select({ userId: member.userId, role: member.role, name: user.name, email: user.email, emailVerified: user.emailVerified })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, input.orgId))
  const wanted = new Set((input.userIds ?? []).filter((id): id is string => !!id))
  const except = input.except ?? TEAM_NOTIFICATIONS[input.type].except
  const byPermission = (role: string) => !!input.permission && hasPermission(role, input.permission)
    && !(except && hasPermission(role, except))
  const recipients = members.filter(m => m.userId !== input.actorUserId && (wanted.has(m.userId) || byPermission(m.role)))
  if (!recipients.length) return []

  const actorName = input.actorUserId ? members.find(m => m.userId === input.actorUserId)?.name : undefined
  const data: TeamNotificationData = { ...input.data, actor: input.data.actor ?? actorName ?? 'OXY' }
  const rows = recipients.map(r => ({
    id: randomUUID(),
    orgId: input.orgId,
    userId: r.userId,
    type: input.type,
    actorUserId: input.actorUserId,
    workOrderId: input.workOrderId ?? null,
    entityType: input.entity?.type ?? null,
    entityId: input.entity?.id ?? null,
    link: input.link ?? null,
    data,
  }))
  // Bez RETURNING: odbiorca to zwykle ktoś inny, a polityka RLS pozwala czytać tylko własne powiadomienia.
  await tx.insert(notification).values(rows)

  const env = getEnv()
  const pushEnabled = isPushConfigured(env)
  const prefs = await tx.select().from(notificationPreference).where(and(
    eq(notificationPreference.orgId, input.orgId),
    eq(notificationPreference.type, input.type),
    inArray(notificationPreference.userId, recipients.map(r => r.userId)),
  ))
  const defaults = TEAM_NOTIFICATIONS[input.type].defaults
  const channels = new Map(recipients.map((r) => {
    const pref = prefs.find(p => p.userId === r.userId)
    return [r.userId, { email: pref?.email ?? defaults.email, push: pref?.push ?? defaults.push }]
  }))
  const wantsEmail = recipients.filter(r => channels.get(r.userId)!.email && (r.emailVerified || !env.AUTH_REQUIRE_EMAIL_VERIFICATION))
  const wantsPush = pushEnabled ? recipients.filter(r => channels.get(r.userId)!.push) : []
  if (!wantsEmail.length && !wantsPush.length) return rows.map(r => r.id)

  const [org] = await tx.select({ name: organization.name }).from(organization).where(eq(organization.id, input.orgId)).limit(1)
  const [settings] = await tx.select({ locale: organizationSettings.locale }).from(organizationSettings)
    .where(eq(organizationSettings.orgId, input.orgId)).limit(1)
  const locale = settings?.locale ?? 'pl'
  const texts = renderTeamNotification(input.type, data, locale)
  const idOf = (userId: string) => rows.find(r => r.userId === userId)!.id

  for (const r of wantsEmail) {
    await enqueueJob(tx, {
      type: 'email.send',
      orgId: input.orgId,
      payload: {
        to: r.email,
        template: 'team-notification',
        data: {
          title: texts.title,
          body: texts.body,
          note: data.note ? String(data.note) : '',
          organizationName: org?.name ?? 'OXY',
          url: `${env.appUrl}/app/n/${idOf(r.userId)}`,
          settingsUrl: `${env.appUrl}/app/notifications?tab=settings`,
          lang: locale,
        },
      },
    })
  }

  if (wantsPush.length) {
    // Kto pracuje w kilku warsztatach, widzi w tytule, którego dotyczy powiadomienie
    const memberships = await tx.select({ userId: member.userId, n: count() }).from(member)
      .where(inArray(member.userId, wantsPush.map(r => r.userId)))
      .groupBy(member.userId)
    for (const r of wantsPush) {
      const id = idOf(r.userId)
      const multi = (memberships.find(m => m.userId === r.userId)?.n ?? 1) > 1
      const payload: TeamNotificationJob = {
        orgId: input.orgId,
        userId: r.userId,
        notificationId: id,
        title: multi && org ? `${texts.title} · ${org.name}` : texts.title,
        body: texts.body,
        url: `/app/n/${id}`,
        tag: `n-${id}`,
        lang: locale,
      }
      await enqueueJob(tx, { type: 'push.send', orgId: input.orgId, payload: { ...payload }, maxAttempts: 5 })
    }
  }
  return rows.map(r => r.id)
}

/** Zlecenie z pojazdem – wspólne dane do treści powiadomień zespołu i klienta. */
export async function loadOrderSummary(tx: Tx, workOrderId: string) {
  const [row] = await tx
    .select({
      id: workOrder.id,
      orgId: workOrder.orgId,
      number: workOrder.number,
      status: workOrder.status,
      promisedAt: workOrder.promisedAt,
      customerId: workOrder.customerId,
      vehicle: {
        type: vehicle.type,
        make: vehicle.make,
        model: vehicle.model,
        registrationNumber: vehicle.registrationNumber,
        serialNumber: vehicle.serialNumber,
      },
      customerName: customer.name,
    })
    .from(workOrder)
    .innerJoin(vehicle, eq(vehicle.id, workOrder.vehicleId))
    .innerJoin(customer, eq(customer.id, workOrder.customerId))
    .where(eq(workOrder.id, workOrderId))
    .limit(1)
  if (!row) return null
  // Pojazd bez marki i tablic (np. maszyna z numerem fabrycznym): w treści zostaje typ pojazdu z tłumaczeń
  return { ...row, vehicleLabel: vehicleText(row.vehicle) || row.vehicle.serialNumber || '' }
}

export type OrderSummary = NonNullable<Awaited<ReturnType<typeof loadOrderSummary>>>

/** Wspólne dane zlecenia w treści powiadomienia zespołu. */
export function orderData(order: OrderSummary): TeamNotificationData {
  return { order: order.number, vehicle: order.vehicleLabel, vehicleType: order.vehicle.type }
}

// ─────────────────────────────────────────────────────────────────────────────
// Zdarzenia warsztatu → kto dostaje powiadomienie
// ─────────────────────────────────────────────────────────────────────────────

/** Przydział albo zdjęcie osoby z zadania (nie powiadamiamy, gdy ktoś bierze lub oddaje zadanie sam). */
export async function notifyTaskAssignment(
  tx: Tx,
  input: { orgId: string, actorUserId: string, userId: string, taskId: string, taskTitle: string, workOrderId: string, assigned: boolean },
) {
  if (input.userId === input.actorUserId) return []
  const order = await loadOrderSummary(tx, input.workOrderId)
  if (!order) return []
  return notifyTeam(tx, {
    orgId: input.orgId,
    type: input.assigned ? 'task.assigned' : 'task.unassigned',
    actorUserId: input.actorUserId,
    userIds: [input.userId],
    workOrderId: order.id,
    entity: { type: 'task', id: input.taskId },
    link: input.assigned ? '/app/my-tasks' : `/app/orders/${order.id}`,
    data: { ...orderData(order), task: input.taskTitle },
  })
}

/**
 * Nowe zadania bez przydziału przy zasadzie „mechanicy sami biorą zadania” – nikt ich nie przydzieli,
 * więc mechanicy muszą się o nich dowiedzieć. Przy pozostałych zasadach zadania przydziela biuro.
 */
export async function notifyTasksAvailable(
  tx: Tx,
  input: { orgId: string, actorUserId: string, workOrderId: string, taskIds: string[], taskTitle?: string },
) {
  if (!input.taskIds.length) return []
  const [settings] = await tx.select({ policy: organizationSettings.assignmentPolicy }).from(organizationSettings)
    .where(eq(organizationSettings.orgId, input.orgId)).limit(1)
  if ((settings?.policy ?? 'office') !== 'self') return []
  const order = await loadOrderSummary(tx, input.workOrderId)
  if (!order) return []
  return notifyTeam(tx, {
    orgId: input.orgId,
    type: 'task.available',
    actorUserId: input.actorUserId,
    permission: TEAM_NOTIFICATIONS['task.available'].audience,
    workOrderId: order.id,
    entity: input.taskIds.length === 1 ? { type: 'task', id: input.taskIds[0]! } : { type: 'work_order', id: order.id },
    link: '/app/my-tasks',
    data: { ...orderData(order), count: input.taskIds.length, task: input.taskIds.length === 1 ? input.taskTitle : undefined },
  })
}

/** Mechanik zgłosił potrzebę: biuro wycenia części i prace dodatkowe. */
export async function notifyWorkRequestCreated(
  tx: Tx,
  input: {
    orgId: string
    actorUserId: string
    request: { id: string, workOrderId: string, kind: WorkRequestKind, title: string, urgency: string }
    hold: boolean
  },
) {
  const order = await loadOrderSummary(tx, input.request.workOrderId)
  if (!order) return []
  return notifyTeam(tx, {
    orgId: input.orgId,
    type: 'work_request.created',
    actorUserId: input.actorUserId,
    permission: { workRequest: ['quote'] },
    workOrderId: order.id,
    entity: { type: 'work_request', id: input.request.id },
    link: `/app/orders/${order.id}`,
    data: {
      ...orderData(order),
      title: input.request.title,
      kind: input.request.kind,
      urgency: input.request.urgency,
      hold: input.hold,
    },
  })
}

/**
 * Decyzja w zgłoszeniu (biuro albo klient przez link) – dla mechanika, który je zgłosił.
 * Zatwierdzona praca dodatkowa to nowe zadanie przydzielone właśnie jemu.
 */
export async function notifyWorkRequestDecided(
  tx: Tx,
  input: {
    orgId: string
    actorUserId: string | null
    request: { id: string, workOrderId: string, kind: WorkRequestKind, title: string, reportedBy: string | null }
    decision: 'approved' | 'rejected'
    via: 'office' | 'customer'
    createdTaskId: string | null
  },
) {
  if (!input.request.reportedBy) return []
  const order = await loadOrderSummary(tx, input.request.workOrderId)
  if (!order) return []
  return notifyTeam(tx, {
    orgId: input.orgId,
    type: 'work_request.decided',
    actorUserId: input.actorUserId,
    userIds: [input.request.reportedBy],
    workOrderId: order.id,
    entity: { type: 'work_request', id: input.request.id },
    link: input.createdTaskId ? '/app/my-tasks' : `/app/orders/${order.id}`,
    data: {
      ...orderData(order),
      title: input.request.title,
      kind: input.request.kind,
      decision: input.decision,
      via: input.via,
      newTask: !!input.createdTaskId,
    },
  })
}

/**
 * Część zamówiona albo dostarczona: dla mechanika, który ją zgłosił; o dostawie – także dla osób
 * przypisanych do zadania, które czekało na tę część.
 */
export async function notifyPartStatus(
  tx: Tx,
  input: {
    orgId: string
    actorUserId: string
    request: { id: string, workOrderId: string, taskId: string | null, title: string, reportedBy: string | null }
    status: 'ordered' | 'delivered'
  },
) {
  const order = await loadOrderSummary(tx, input.request.workOrderId)
  if (!order) return []
  const userIds = [input.request.reportedBy]
  if (input.status === 'delivered' && input.request.taskId) {
    const [related] = await tx.select({ parentId: task.parentId }).from(task).where(eq(task.id, input.request.taskId)).limit(1)
    const taskIds = related?.parentId ? [input.request.taskId, related.parentId] : [input.request.taskId]
    const assignees = await tx.select({ userId: taskAssignment.userId }).from(taskAssignment)
      .where(inArray(taskAssignment.taskId, taskIds))
    userIds.push(...assignees.map(a => a.userId))
  }
  return notifyTeam(tx, {
    orgId: input.orgId,
    type: input.status === 'ordered' ? 'work_request.part_ordered' : 'work_request.part_delivered',
    actorUserId: input.actorUserId,
    userIds,
    workOrderId: order.id,
    entity: { type: 'work_request', id: input.request.id },
    link: input.status === 'delivered' ? '/app/my-tasks' : `/app/orders/${order.id}`,
    data: { ...orderData(order), title: input.request.title },
  })
}

/**
 * Ostatnie zadanie zlecenia zakończone: biuro może oznaczyć zlecenie jako gotowe do odbioru
 * (i powiadomić klienta). Nie dotyczy zleceń już gotowych, zamkniętych ani anulowanych.
 */
export async function notifyIfAllTasksDone(tx: Tx, input: { orgId: string, actorUserId: string | null, workOrderId: string }) {
  const order = await loadOrderSummary(tx, input.workOrderId)
  if (!order || ['ready', 'closed', 'cancelled'].includes(order.status)) return []
  if (!(await allTasksDone(tx, order.id))) return []
  return notifyTeam(tx, {
    orgId: input.orgId,
    type: 'work_order.tasks_completed',
    actorUserId: input.actorUserId,
    permission: { workOrder: ['update'] },
    workOrderId: order.id,
    entity: { type: 'work_order', id: order.id },
    link: `/app/orders/${order.id}`,
    data: orderData(order),
  })
}

/**
 * Odpowiedź klienta albo wygaśnięcie linku: powiadamiamy osobę, która wysłała prośbę,
 * a gdy nie ma jej już w zespole – wszystkich, którzy mogą zająć się sprawą.
 */
export async function notifyApprovalOutcome(
  tx: Tx,
  type: 'approval.answered' | 'approval.expired',
  approval: { id: string, orgId: string, kind: 'work_requests' | 'estimate', sentBy: string | null },
  order: OrderSummary,
  data: TeamNotificationData,
) {
  const [sender] = approval.sentBy
    ? await tx.select({ userId: member.userId }).from(member)
        .where(and(eq(member.organizationId, approval.orgId), eq(member.userId, approval.sentBy)))
        .limit(1)
    : []
  const fallback: PermissionRequest = approval.kind === 'estimate' ? { billing: ['update'] } : { workRequest: ['decide'] }
  return notifyTeam(tx, {
    orgId: approval.orgId,
    type,
    actorUserId: null,
    ...(sender ? { userIds: [sender.userId] } : { permission: fallback }),
    workOrderId: order.id,
    entity: { type: 'approval', id: approval.id },
    link: `/app/orders/${order.id}`,
    data: { ...orderData(order), kind: approval.kind, ...data },
  })
}

/** Wszystkie zadania zlecenia zakończone (bez anulowanych) – biuro może oznaczyć zlecenie jako gotowe do odbioru. */
export async function allTasksDone(tx: Tx, workOrderId: string) {
  const rows = await tx.select({ status: task.status }).from(task).where(eq(task.workOrderId, workOrderId))
  const active = rows.filter(r => r.status !== 'cancelled')
  return active.length > 0 && active.every(r => r.status === 'done')
}

/**
 * Nieprzeczytane powiadomienia osoby w innych warsztatach (podpowiedź w dzwonku, np. mechanik w dwóch warsztatach).
 * Kontekst systemowy, ale zawsze zawężony do zalogowanej osoby.
 */
export async function unreadElsewhere(db: Db, userId: string, activeOrgId: string) {
  const result = await withSystem(db, tx => tx.execute<{ n: number }>(sql`
    select count(*)::int as n from notification n
    join member m on m.organization_id = n.org_id and m.user_id = n.user_id
    where n.user_id = ${userId} and n.org_id <> ${activeOrgId} and n.read_at is null
  `))
  return result.rows[0]?.n ?? 0
}

/**
 * Sprzątanie (zadanie codzienne): przeczytane powiadomienia starsze niż 90 dni, wszystkie starsze niż 180 dni,
 * wykonane zadania kolejki starsze niż 30 dni i wyłączone telefony klientów sprzed roku.
 * Treści powiadomień nie są potrzebne dłużej – ważne zdarzenia są w dzienniku zdarzeń.
 */
export async function cleanupNotifications(db: Db) {
  return withSystem(db, async (tx) => {
    const notifications = await tx.execute(sql`
      delete from notification
      where created_at < now() - interval '180 days'
         or (read_at is not null and created_at < now() - interval '90 days')
    `)
    const jobs = await tx.execute(sql`delete from job where status = 'done' and updated_at < now() - interval '30 days'`)
    const devices = await tx.execute(sql`
      delete from customer_push_subscription where revoked_at is not null and revoked_at < now() - interval '365 days'
    `)
    return { notifications: notifications.rowCount ?? 0, jobs: jobs.rowCount ?? 0, customerDevices: devices.rowCount ?? 0 }
  })
}
