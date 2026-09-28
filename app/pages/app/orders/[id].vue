<script setup lang="ts">
import type { z } from 'zod'
import type { workRequestCreateSchema } from '#shared/schemas'
import { formatDuration, TASK_STATUSES, WORK_ORDER_STATUSES, type TaskStatus, type WorkOrderStatus } from '#shared/workshop'

const route = useRoute()
const id = route.params.id as string
const { t, d, n } = useI18n()
const toast = useToast()
const { data: me } = await useMe()

const { data: order, error, refresh } = await useFetch(`/api/work-orders/${id}`)
if (error.value || !order.value) {
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage: error.value?.statusMessage ?? 'Not Found',
    fatal: true,
  })
}
const { data: members } = await useFetch('/api/org/members', { default: () => [] })

type Order = NonNullable<typeof order.value>

const meId = computed(() => me.value?.user.id ?? '')
const closed = computed(() => order.value?.status === 'closed' || order.value?.status === 'cancelled')
const busy = ref(false)

async function run(request: () => Promise<Order>, success?: string) {
  busy.value = true
  try {
    order.value = await request()
    if (success) toast.add({ title: success, color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    busy.value = false
  }
}

// ── zlecenie ──
const statusItems = computed(() => WORK_ORDER_STATUSES.map(value => ({ value, label: t(`workOrderStatus.${value}`) })))

function setOrderStatus(status: WorkOrderStatus) {
  if (status === order.value?.status) return
  // Zamknięcie: najpierw okno z numerem paragonu
  if (status === 'closed') {
    receiptMode.value = 'close'
    closeOpen.value = true
    return
  }
  run(() => $fetch(`/api/work-orders/${id}`, { method: 'PATCH', body: { status } }), t('orders.statusChanged'))
}

// ── zamknięcie i paragon ──
const closeOpen = ref(false)
const receiptMode = ref<'close' | 'receipt'>('close')
function openReceipt() {
  receiptMode.value = 'receipt'
  closeOpen.value = true
}
async function submitClose(data: { receiptNumber?: string | null, receiptIssuedOn?: string | null }) {
  const body = receiptMode.value === 'close' ? { status: 'closed' as const, ...data } : data
  await run(
    () => $fetch(`/api/work-orders/${id}`, { method: 'PATCH', body }),
    receiptMode.value === 'close' ? t('closeOrder.closed') : t('closeOrder.receiptSaved'),
  )
  closeOpen.value = false
}
function onEstimateUpdated(value: unknown) {
  order.value = value as Order
}

const editingDescription = ref(false)
const descriptionDraft = ref('')
function startEditDescription() {
  descriptionDraft.value = order.value?.description ?? ''
  editingDescription.value = true
}
async function saveDescription() {
  await run(() => $fetch(`/api/work-orders/${id}`, { method: 'PATCH', body: { description: descriptionDraft.value } }), t('common.saved'))
  editingDescription.value = false
}

function setPromisedAt(value: string) {
  run(() => $fetch(`/api/work-orders/${id}`, { method: 'PATCH', body: { promisedAt: fromDateTimeLocal(value) } }), t('common.saved'))
}

// ── zadania ──
const newTaskTitle = ref('')
async function addTask() {
  const title = newTaskTitle.value.trim()
  if (!title) return
  await run(() => $fetch(`/api/work-orders/${id}/tasks`, { method: 'POST', body: { title } }))
  newTaskTitle.value = ''
}
function addSubtask(parentId: string, title: string) {
  run(() => $fetch(`/api/work-orders/${id}/tasks`, { method: 'POST', body: { title, parentId } }))
}
function setTaskStatus(taskId: string, status: TaskStatus) {
  if (!TASK_STATUSES.includes(status)) return
  run(() => $fetch(`/api/tasks/${taskId}`, { method: 'PATCH', body: { status } }))
}
function assign(taskId: string, userId: string) {
  run(() => $fetch(`/api/tasks/${taskId}/assignees`, { method: 'POST', body: { userId } }))
}
function unassign(taskId: string, userId: string) {
  run(() => $fetch(`/api/tasks/${taskId}/assignees/${userId}`, { method: 'DELETE' }))
}
function removeTask(taskId: string) {
  run(() => $fetch(`/api/tasks/${taskId}`, { method: 'DELETE' }))
}

// ── czas pracy ──
async function work(taskId: string, action: 'start' | 'pause') {
  busy.value = true
  try {
    await $fetch(`/api/tasks/${taskId}/work`, { method: 'POST', body: { action } })
    await refresh()
    toast.add({ title: action === 'start' ? t('myTasks.started') : t('myTasks.paused'), color: 'success', icon: 'i-lucide-timer' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    busy.value = false
  }
}

// ── potrzeby (części, prace dodatkowe) ──
const reportOpen = ref(false)
const reportTaskId = ref<string | null>(null)
const { saving: reporting, submit: submitNeed } = useReportNeed()
const taskOptions = computed(() => (order.value?.tasks ?? []).flatMap(task => [
  { id: task.id, title: task.title },
  ...task.subtasks.map(sub => ({ id: sub.id, title: `${task.title} › ${sub.title}` })),
]))
const taskTitles = computed(() => new Map(taskOptions.value.map(task => [task.id, task.title])))

function openReport(taskId: string | null = null) {
  reportTaskId.value = taskId
  reportOpen.value = true
}
async function sendNeed(data: z.output<typeof workRequestCreateSchema>, files: File[]) {
  if (await submitNeed(id, data, files)) {
    reportOpen.value = false
    await refresh()
  }
}

// ── zdjęcia i filmy ──
const orderAttachments = computed(() => (order.value?.attachments ?? []).filter(a => !a.workRequestId))
function requestAttachments(requestId: string) {
  return (order.value?.attachments ?? []).filter(a => a.workRequestId === requestId)
}
function canDeleteAttachment(a: { createdBy: string | null, createdAt: string }) {
  if (order.value?.can.update) return true
  return a.createdBy === meId.value && Date.now() - new Date(a.createdAt).getTime() < 24 * 3600 * 1000
}
// ── akceptacje klienta ──
const approvalOpen = ref(false)
/** prośby o zgodę na prace dodatkowe (kosztorys ma własną kartę) */
const requestApprovals = computed(() => (order.value?.approvals ?? []).filter(a => a.kind === 'work_requests'))
const pendingRequestIds = computed(() => new Set(requestApprovals.value
  .filter(a => a.status === 'pending' && !a.expired)
  .flatMap(a => a.items.map(i => i.requestId))))
const quotedForApproval = computed(() => (order.value?.requests ?? [])
  .filter(r => r.status === 'quoted' && !pendingRequestIds.value.has(r.id)))
const requestTitles = computed(() => new Map((order.value?.requests ?? []).map(r => [r.id, r.title])))
const channelIcon = { sms: 'i-lucide-message-square', email: 'i-lucide-mail', link: 'i-lucide-link' } as const

type ApprovalState = 'pending' | 'answered' | 'cancelled' | 'expired'
function approvalState(a: { status: 'pending' | 'answered' | 'cancelled', expired: boolean }): ApprovalState {
  return a.status === 'pending' && a.expired ? 'expired' : a.status
}
const approvalColor = { pending: 'warning', answered: 'success', cancelled: 'neutral', expired: 'neutral' } as const

async function cancelApproval(approvalId: string) {
  try {
    await $fetch(`/api/approvals/${approvalId}/cancel`, { method: 'POST' })
    await refresh()
    toast.add({ title: t('approvals.cancelled'), color: 'success', icon: 'i-lucide-ban' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
}

async function removeAttachment(attachmentId: string) {
  try {
    await $fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: t('attachments.deleted'), color: 'success', icon: 'i-lucide-trash-2' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
}

const progress = computed(() => {
  const all = (order.value?.tasks ?? []).flatMap(task => [task, ...task.subtasks]).filter(task => task.status !== 'cancelled')
  return { done: all.filter(task => task.status === 'done').length, total: all.length }
})

const vehicleIdentifier = computed(() => {
  const v = order.value?.vehicle
  if (!v) return null
  if (v.vin) return { label: t('vehicles.vin'), value: v.vin }
  if (v.serialNumber) return { label: v.type === 'bicycle' || v.type === 'ebike' ? t('vehicles.frame') : t('vehicles.serial'), value: v.serialNumber }
  return null
})

useHead({ title: () => order.value?.number ?? t('orders.title') })
</script>

<template>
  <UDashboardPanel id="order">
    <template #header>
      <UDashboardNavbar :title="order?.number">
        <template #leading>
          <UButton
            to="/app/orders"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            :aria-label="$t('common.back')"
          />
        </template>
        <template #trailing>
          <StatusBadge
            v-if="order"
            kind="order"
            :status="order.status"
          />
        </template>
        <template #right>
          <USelect
            v-if="order?.can.update"
            :model-value="order.status"
            :items="statusItems"
            :disabled="busy"
            class="w-52"
            :aria-label="$t('orders.status')"
            @update:model-value="value => setOrderStatus(value as WorkOrderStatus)"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div
        v-if="order"
        class="grid gap-6 lg:grid-cols-3"
      >
        <div class="space-y-6 lg:col-span-2">
          <UAlert
            v-if="closed"
            color="neutral"
            variant="subtle"
            icon="i-lucide-lock"
            :title="$t('orders.closedInfo')"
          />

          <UPageCard :title="$t('orders.description')">
            <template v-if="editingDescription">
              <UTextarea
                v-model="descriptionDraft"
                :rows="3"
                autoresize
                autofocus
                class="w-full"
              />
              <div class="flex justify-end gap-2">
                <UButton
                  color="neutral"
                  variant="ghost"
                  :label="$t('common.cancel')"
                  @click="editingDescription = false"
                />
                <UButton
                  :loading="busy"
                  :label="$t('common.save')"
                  @click="saveDescription"
                />
              </div>
            </template>
            <template v-else>
              <p
                class="whitespace-pre-line"
                :class="{ 'text-muted': !order.description }"
              >
                {{ order.description || $t('orders.noDescription') }}
              </p>
              <div
                v-if="order.can.update && !closed"
                class="flex justify-end"
              >
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :label="$t('common.edit')"
                  @click="startEditDescription"
                />
              </div>
            </template>
          </UPageCard>

          <UPageCard
            :title="$t('tasks.title')"
            :description="order.timeSpentSeconds
              ? `${$t(`tasks.policy.${order.assignmentPolicy}`)} ${$t('timer.total', { time: formatDuration(order.timeSpentSeconds) })}.`
              : $t(`tasks.policy.${order.assignmentPolicy}`)"
          >
            <div
              v-if="progress.total"
              class="flex items-center gap-3"
            >
              <UProgress
                :model-value="progress.done"
                :max="progress.total"
                size="sm"
                class="flex-1"
              />
              <span class="text-sm text-muted">{{ $t('orders.tasksProgress', progress) }}</span>
            </div>

            <p
              v-if="!order.tasks.length"
              class="text-sm text-muted"
            >
              {{ $t('tasks.empty') }}
            </p>
            <div
              v-else
              class="divide-y divide-default"
            >
              <TaskItem
                v-for="task in order.tasks"
                :key="task.id"
                :task="task"
                :permissions="order.can"
                :members="members"
                :me-id="meId"
                :readonly="closed || busy"
                @status="setTaskStatus"
                @assign="assign"
                @unassign="unassign"
                @remove="removeTask"
                @add-subtask="addSubtask"
                @work="work"
                @report="openReport"
              />
            </div>

            <form
              v-if="order.can.createTask && !closed"
              class="flex gap-2"
              @submit.prevent="addTask"
            >
              <UInput
                v-model="newTaskTitle"
                :placeholder="$t('tasks.titlePlaceholder')"
                class="flex-1"
              />
              <UButton
                type="submit"
                icon="i-lucide-plus"
                :disabled="!newTaskTitle.trim()"
                :loading="busy"
                :label="$t('tasks.add')"
              />
            </form>
          </UPageCard>

          <UPageCard
            v-if="order.requests.length || (order.can.reportNeeds && !closed)"
            :title="$t('requests.section')"
            :description="$t('requests.sectionHint')"
          >
            <div
              v-if="order.requests.length"
              class="space-y-3"
            >
              <WorkRequestCard
                v-for="r in order.requests"
                :key="r.id"
                :request="r"
                :permissions="order.can"
                :attachments="requestAttachments(r.id)"
                :task-title="r.taskId ? taskTitles.get(r.taskId) : null"
                :awaiting-customer="pendingRequestIds.has(r.id)"
                :readonly="closed"
                @changed="refresh"
              />
            </div>

            <div
              v-if="requestApprovals.length"
              class="space-y-2"
            >
              <h3 class="text-sm font-medium">
                {{ $t('approvals.title') }}
              </h3>
              <div
                v-for="a in requestApprovals"
                :key="a.id"
                class="flex flex-wrap items-start justify-between gap-3 rounded-md border border-default p-3 text-sm"
              >
                <div class="min-w-0 space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <UIcon
                      :name="channelIcon[a.channel]"
                      class="size-4 text-muted"
                    />
                    <UBadge
                      :color="approvalColor[approvalState(a)]"
                      variant="subtle"
                      :label="$t(`approvals.status.${approvalState(a)}`)"
                    />
                    <span class="font-medium">{{ n(a.totalGrossCents / 100, 'currency') }}</span>
                  </div>
                  <p class="text-xs text-muted">
                    {{ $t('approvals.sentBy', { name: a.sentByName ?? '—', date: d(new Date(a.createdAt), 'long') }) }}
                    <template v-if="a.recipient">
                      · {{ a.recipient }}
                    </template>
                    <template v-if="a.viewedAt">
                      · {{ $t('approvals.viewed', { date: d(new Date(a.viewedAt), 'long') }) }}
                    </template>
                    <template v-if="a.answeredAt">
                      · {{ $t('approvals.answered', { date: d(new Date(a.answeredAt), 'long') }) }}
                    </template>
                  </p>
                  <ul
                    v-if="a.status === 'answered'"
                    class="text-xs"
                  >
                    <li
                      v-for="item in a.items"
                      :key="item.requestId"
                      class="flex items-center gap-1"
                    >
                      <UIcon
                        :name="item.decision === 'approved' ? 'i-lucide-check' : 'i-lucide-x'"
                        :class="item.decision === 'approved' ? 'text-success' : 'text-muted'"
                        class="size-3.5"
                      />
                      {{ requestTitles.get(item.requestId) }} –
                      {{ item.decision === 'approved' ? $t('approvals.decisionApproved') : $t('approvals.decisionRejected') }}
                    </li>
                  </ul>
                  <p
                    v-if="a.customerNote"
                    class="text-xs"
                  >
                    {{ $t('approvals.customerNote', { note: a.customerNote }) }}
                  </p>
                </div>
                <UButton
                  v-if="a.status === 'pending' && order.can.decide && !closed"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-ban"
                  :label="$t('approvals.cancel')"
                  @click="cancelApproval(a.id)"
                />
              </div>
            </div>

            <UButton
              v-if="order.can.decide && !closed && quotedForApproval.length"
              icon="i-lucide-send"
              :label="$t('approvals.sendButton')"
              class="self-start justify-self-start"
              @click="approvalOpen = true"
            />
            <UButton
              v-if="order.can.reportNeeds && !closed"
              icon="i-lucide-message-square-warning"
              color="neutral"
              variant="outline"
              :label="$t('requests.new')"
              class="self-start justify-self-start"
              @click="openReport()"
            />
          </UPageCard>

          <EstimateCard
            v-if="order.estimate"
            :work-order-id="order.id"
            :estimate="order.estimate"
            :can-edit="order.can.editBilling"
            :closed="closed"
            :customer-email="order.customer.email"
            :customer-phone="order.customer.phone"
            @updated="onEstimateUpdated"
            @refresh="refresh()"
          />

          <UPageCard
            :title="$t('attachments.title')"
            :description="order.can.uploadFiles && !closed ? $t('attachments.privacy') : undefined"
          >
            <AttachmentGallery
              v-if="orderAttachments.length"
              :attachments="orderAttachments"
              :can-delete="canDeleteAttachment"
              @remove="removeAttachment"
            />
            <p
              v-else
              class="text-sm text-muted"
            >
              {{ $t('attachments.empty') }}
            </p>
            <AttachmentUploader
              v-if="order.can.uploadFiles && !closed"
              :work-order-id="order.id"
              class="self-start justify-self-start"
              @uploaded="() => refresh()"
            />
          </UPageCard>
        </div>

        <div class="space-y-6">
          <UPageCard :title="$t('orders.vehicle')">
            <VehicleLabel
              :vehicle="order.vehicle"
              class="font-medium"
            />
            <dl class="grid grid-cols-1 text-sm [&>dd]:mb-2 [&>dt]:text-xs">
              <dt class="text-muted">
                {{ $t('vehicles.type') }}
              </dt>
              <dd>{{ $t(`vehicleType.${order.vehicle.type}`) }}</dd>
              <template v-if="vehicleIdentifier">
                <dt class="text-muted">
                  {{ vehicleIdentifier.label }}
                </dt>
                <dd class="break-all font-mono">
                  {{ vehicleIdentifier.value }}
                </dd>
              </template>
              <template v-if="order.meterValue !== null && order.vehicle.meterUnit !== 'none'">
                <dt class="text-muted">
                  {{ $t('orders.meterValue') }}
                </dt>
                <dd>{{ n(order.meterValue) }} {{ $t(`meterUnit.${order.vehicle.meterUnit}`) }}</dd>
              </template>
            </dl>
            <UButton
              :to="`/app/vehicles/${order.vehicle.id}`"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-history"
              :label="$t('vehicles.history')"
              class="self-start justify-self-start"
            />
          </UPageCard>

          <UPageCard :title="$t('orders.customer')">
            <p class="font-medium">
              {{ order.customer.name }}
            </p>
            <div
              v-if="order.customer.phone || order.customer.email"
              class="space-y-1 text-sm"
            >
              <p v-if="order.customer.phone">
                <ULink :href="`tel:${order.customer.phone}`">
                  {{ order.customer.phone }}
                </ULink>
              </p>
              <p v-if="order.customer.email">
                <ULink :href="`mailto:${order.customer.email}`">
                  {{ order.customer.email }}
                </ULink>
              </p>
            </div>
            <p
              v-else-if="!me?.activeOrganization?.can.readCustomerContact"
              class="text-sm text-muted"
            >
              {{ $t('customers.contactHidden') }}
            </p>
            <UButton
              v-if="me?.activeOrganization?.can.readCustomers"
              :to="`/app/customers/${order.customer.id}`"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-user"
              :label="$t('common.details')"
              class="self-start justify-self-start"
            />
          </UPageCard>

          <UPageCard
            v-if="order.can.billing && order.estimate"
            :title="$t('settlement.title')"
          >
            <dl class="grid grid-cols-1 text-sm [&>dd]:mb-2 [&>dt]:text-xs">
              <dt class="text-muted">
                {{ $t('settlement.estimate') }}
              </dt>
              <dd class="font-medium tabular-nums">
                {{ order.estimate.items.length ? n(order.estimate.totals.grossCents / 100, 'currency') : $t('settlement.none') }}
              </dd>
              <dt class="text-muted">
                {{ $t('settlement.receipt') }}
              </dt>
              <dd>
                <template v-if="order.receiptNumber">
                  {{ order.receiptIssuedOn
                    ? $t('settlement.receiptValue', { number: order.receiptNumber, date: d(new Date(`${order.receiptIssuedOn}T12:00:00`), 'short') })
                    : $t('settlement.receiptNoDate', { number: order.receiptNumber }) }}
                </template>
                <span
                  v-else
                  class="text-muted"
                >{{ $t('settlement.none') }}</span>
              </dd>
            </dl>
            <UButton
              v-if="order.can.editBilling"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-receipt"
              :label="order.receiptNumber ? $t('settlement.editReceipt') : $t('settlement.addReceipt')"
              class="self-start justify-self-start"
              @click="openReceipt"
            />
          </UPageCard>

          <UPageCard :title="$t('orders.dates')">
            <dl class="grid grid-cols-1 text-sm [&>dd]:mb-2 [&>dt]:text-xs">
              <dt class="text-muted">
                {{ $t('orders.receivedAt') }}
              </dt>
              <dd>{{ d(new Date(order.receivedAt), 'long') }}</dd>
              <dt class="text-muted">
                {{ $t('orders.promisedAt') }}
              </dt>
              <dd>
                <UInput
                  v-if="order.can.update && !closed"
                  type="datetime-local"
                  :model-value="toDateTimeLocal(order.promisedAt)"
                  size="sm"
                  :disabled="busy"
                  @change="(event: Event) => setPromisedAt((event.target as HTMLInputElement).value)"
                />
                <span v-else>{{ order.promisedAt ? d(new Date(order.promisedAt), 'long') : '—' }}</span>
              </dd>
              <template v-if="order.closedAt">
                <dt class="text-muted">
                  {{ $t('orders.closedAt') }}
                </dt>
                <dd>{{ d(new Date(order.closedAt), 'long') }}</dd>
              </template>
            </dl>
          </UPageCard>
        </div>
      </div>

      <UModal
        v-if="order"
        v-model:open="approvalOpen"
        :title="$t('approvals.sendTitle')"
        :description="`${order.number} · ${order.customer.name}`"
      >
        <template #body>
          <ApprovalSendForm
            :work-order-id="order.id"
            :requests="quotedForApproval"
            :customer-email="order.customer.email"
            :customer-phone="order.customer.phone"
            @sent="refresh()"
            @close="approvalOpen = false"
          />
        </template>
      </UModal>

      <UModal
        v-if="order"
        v-model:open="closeOpen"
        :title="receiptMode === 'close' ? $t('closeOrder.title') : $t('closeOrder.receiptTitle')"
        :description="`${order.number} · ${order.customer.name}`"
      >
        <template #body>
          <CloseOrderForm
            :mode="receiptMode"
            :can-receipt="order.can.editBilling"
            :estimate-total-cents="order.estimate?.items.length ? order.estimate.totals.grossCents : null"
            :receipt-number="order.receiptNumber"
            :receipt-issued-on="order.receiptIssuedOn"
            :loading="busy"
            @submit="submitClose"
            @cancel="closeOpen = false"
          />
        </template>
      </UModal>

      <UModal
        v-model:open="reportOpen"
        :title="$t('requests.new')"
        :description="order ? `${order.number} · ${order.vehicle.make ?? ''} ${order.vehicle.model ?? ''}` : undefined"
      >
        <template #body>
          <WorkRequestForm
            :tasks="taskOptions"
            :task-id="reportTaskId"
            :loading="reporting"
            @submit="sendNeed"
            @cancel="reportOpen = false"
          />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
