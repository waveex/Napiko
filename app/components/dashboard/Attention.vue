<script setup lang="ts">
/**
 * Pulpit biura – „Wymaga uwagi”: sprawy czekające na reakcję, od najpilniejszych (terminy, pilne zgłoszenia,
 * odpowiedzi klientów) po informacyjne (na co czekamy). Liczniki obejmują wszystko; w kartach widać kilka
 * pierwszych pozycji z przejściem do zlecenia albo listy.
 */
import { URGENCY_COLOR } from '#shared/workshop'
import type { DashboardOffice } from '~/composables/useDashboard'

const props = defineProps<{ office: DashboardOffice, now: number }>()

const { t, n, d, locale } = useI18n()
const ago = (date: string) => formatRelative(date, props.now, locale.value)
const money = (cents: number) => n(cents / 100, 'currency')
const dotClass: Record<string, string> = { error: 'bg-error', warning: 'bg-warning', success: 'bg-success' }

const requests = computed(() => props.office.requests)
const approvals = computed(() => props.office.approvals)
const planning = computed(() => props.office.planning)

const anything = computed(() => [
  requests.value?.open.count,
  requests.value?.quoted.count,
  requests.value?.parts.toOrder,
  requests.value?.parts.ordered,
  approvals.value?.answered.count,
  approvals.value?.expired.count,
  approvals.value?.waiting.count,
  props.office.overdue.count,
  props.office.ready.count,
  planning.value?.count,
].some(Boolean))

type Approval = NonNullable<DashboardOffice['approvals']>['answered']['items'][number]
function answerSummary(a: Approval) {
  if (a.kind === 'estimate') return a.decision === 'approved' ? t('dashboard.attention.estimateApproved') : t('dashboard.attention.estimateRejected')
  return t('dashboard.attention.itemsDecided', { approved: a.approvedItems, rejected: a.rejectedItems })
}
</script>

<template>
  <DashboardSection
    :title="$t('dashboard.attention.title')"
    :description="$t('dashboard.attention.description')"
  >
    <UEmpty
      v-if="!anything"
      icon="i-lucide-check-check"
      :title="$t('dashboard.attention.allClear')"
      :description="$t('dashboard.attention.allClearHint')"
    />
    <div
      v-else
      class="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3"
    >
      <DashboardAttentionCard
        v-if="office.overdue.count"
        icon="i-lucide-alarm-clock"
        tone="error"
        :title="$t('dashboard.attention.overdue')"
        :description="$t('dashboard.attention.overdueHint')"
        :count="office.overdue.count"
        to="/app/orders"
        :link-label="$t('dashboard.attention.showBoard')"
      >
        <DashboardItem
          v-for="o in office.overdue.items"
          :key="o.id"
          :to="`/app/orders/${o.id}`"
        >
          <div class="min-w-0 flex-1">
            <p><DashboardVehicle :vehicle="o.vehicle" /></p>
            <p class="text-sm">
              <span class="font-medium text-error">{{ $t('dashboard.attention.promised', { date: d(new Date(o.promisedAt!), 'long') }) }}</span>
              <span class="text-muted"> · {{ o.customerName }}</span>
            </p>
          </div>
          <StatusBadge
            kind="order"
            :status="o.status"
            class="shrink-0"
          />
        </DashboardItem>
      </DashboardAttentionCard>

      <DashboardAttentionCard
        v-if="requests?.open.count"
        icon="i-lucide-message-square-warning"
        :tone="requests.open.urgent ? 'error' : 'warning'"
        :title="$t('dashboard.attention.newRequests')"
        :description="requests.open.urgent ? $t('dashboard.attention.urgent', { n: requests.open.urgent }) : $t('dashboard.attention.newRequestsHint')"
        :count="requests.open.count"
        to="/app/requests"
        :link-label="$t('dashboard.attention.showRequests')"
      >
        <DashboardItem
          v-for="r in requests.open.items"
          :key="r.id"
          to="/app/requests"
        >
          <span
            class="size-2.5 shrink-0 rounded-full"
            :class="dotClass[URGENCY_COLOR[r.urgency]]"
            :title="$t(`urgency.${r.urgency}`)"
          />
          <span class="sr-only">{{ $t(`urgency.${r.urgency}`) }}</span>
          <div class="min-w-0 flex-1">
            <p class="font-medium break-words">
              {{ r.title }}
            </p>
            <p class="text-sm text-muted">
              <DashboardVehicle :vehicle="r.vehicle" />
              <span class="whitespace-nowrap"> · {{ r.reporterName ?? '—' }}</span>
              <span class="whitespace-nowrap"> · {{ ago(r.createdAt) }}</span>
            </p>
          </div>
        </DashboardItem>
      </DashboardAttentionCard>

      <DashboardAttentionCard
        v-if="approvals?.answered.count"
        icon="i-lucide-message-circle-reply"
        tone="info"
        :title="$t('dashboard.attention.answered')"
        :description="$t('dashboard.attention.answeredHint')"
        :count="approvals.answered.count"
      >
        <DashboardItem
          v-for="a in approvals.answered.items"
          :key="a.id"
          :to="`/app/orders/${a.order.id}`"
        >
          <div class="min-w-0 flex-1">
            <p><DashboardVehicle :vehicle="a.vehicle" /></p>
            <p class="text-sm text-muted">
              {{ $t(`approvals.kind.${a.kind}`) }} · {{ answerSummary(a) }} · {{ ago(a.answeredAt!) }}
            </p>
          </div>
          <span class="shrink-0 font-mono text-xs text-muted">{{ a.order.number }}</span>
        </DashboardItem>
      </DashboardAttentionCard>

      <DashboardAttentionCard
        v-if="approvals?.expired.count"
        icon="i-lucide-link-2-off"
        tone="warning"
        :title="$t('dashboard.attention.expired')"
        :description="$t('dashboard.attention.expiredHint')"
        :count="approvals.expired.count"
      >
        <DashboardItem
          v-for="a in approvals.expired.items"
          :key="a.id"
          :to="`/app/orders/${a.order.id}`"
        >
          <div class="min-w-0 flex-1">
            <p><DashboardVehicle :vehicle="a.vehicle" /></p>
            <p class="text-sm text-muted">
              {{ $t(`approvals.kind.${a.kind}`) }} · {{ $t('dashboard.attention.expiredAt', { when: ago(a.expiresAt) }) }}
            </p>
          </div>
          <span class="shrink-0 font-mono text-xs text-muted">{{ a.order.number }}</span>
        </DashboardItem>
      </DashboardAttentionCard>

      <DashboardAttentionCard
        v-if="requests?.quoted.count"
        icon="i-lucide-send"
        tone="warning"
        :title="$t('dashboard.attention.quoted')"
        :description="$t('dashboard.attention.quotedHint')"
        :count="requests.quoted.count"
        to="/app/requests"
        :link-label="$t('dashboard.attention.showRequests')"
      >
        <DashboardItem
          v-for="r in requests.quoted.items"
          :key="r.id"
          :to="`/app/orders/${r.order.id}`"
        >
          <div class="min-w-0 flex-1">
            <p class="font-medium break-words">
              {{ r.title }}
            </p>
            <p class="text-sm text-muted">
              <DashboardVehicle :vehicle="r.vehicle" />
            </p>
          </div>
          <span class="shrink-0 text-sm font-medium">{{ money(r.grossCents) }}</span>
        </DashboardItem>
      </DashboardAttentionCard>

      <DashboardAttentionCard
        v-if="requests && (requests.parts.toOrder || requests.parts.ordered)"
        icon="i-lucide-package"
        :tone="requests.parts.toOrder ? 'warning' : 'neutral'"
        :title="$t('dashboard.attention.parts')"
        :description="$t('dashboard.attention.partsHint', { toOrder: requests.parts.toOrder, ordered: requests.parts.ordered })"
        :count="requests.parts.toOrder + requests.parts.ordered"
        to="/app/requests"
        :link-label="$t('dashboard.attention.showRequests')"
      >
        <DashboardItem
          v-for="r in requests.parts.items"
          :key="r.id"
          to="/app/requests"
        >
          <div class="min-w-0 flex-1">
            <p class="font-medium break-words">
              {{ r.title }}
            </p>
            <p class="text-sm text-muted">
              <DashboardVehicle :vehicle="r.vehicle" />
            </p>
          </div>
          <UBadge
            :color="r.status === 'ordered' ? 'info' : 'warning'"
            variant="subtle"
            size="md"
            :label="r.status === 'ordered' ? $t('dashboard.attention.partOrdered') : $t('dashboard.attention.partToOrder')"
            class="shrink-0"
          />
        </DashboardItem>
      </DashboardAttentionCard>

      <DashboardAttentionCard
        v-if="office.ready.count"
        icon="i-lucide-car-front"
        tone="success"
        :title="$t('dashboard.attention.ready')"
        :description="$t('dashboard.attention.readyHint')"
        :count="office.ready.count"
        to="/app/orders"
        :link-label="$t('dashboard.attention.showBoard')"
      >
        <DashboardItem
          v-for="o in office.ready.items"
          :key="o.id"
          :to="`/app/orders/${o.id}`"
        >
          <div class="min-w-0 flex-1">
            <p><DashboardVehicle :vehicle="o.vehicle" /></p>
            <p class="text-sm text-muted">
              {{ o.customerName }}<template v-if="o.promisedAt">
                · {{ $t('dashboard.attention.promised', { date: d(new Date(o.promisedAt), 'long') }) }}
              </template>
            </p>
          </div>
          <span class="shrink-0 font-mono text-xs text-muted">{{ o.number }}</span>
        </DashboardItem>
      </DashboardAttentionCard>

      <DashboardAttentionCard
        v-if="planning?.count"
        icon="i-lucide-list-plus"
        tone="neutral"
        :title="$t('dashboard.attention.planning')"
        :description="$t('dashboard.attention.planningHint', { noTasks: planning.noTasks, unassigned: planning.unassignedTasks })"
        :count="planning.count"
      >
        <DashboardItem
          v-for="o in planning.items"
          :key="o.id"
          :to="`/app/orders/${o.id}`"
        >
          <div class="min-w-0 flex-1">
            <p><DashboardVehicle :vehicle="o.vehicle" /></p>
            <p class="text-sm text-muted">
              {{ o.reason === 'noTasks' ? $t('dashboard.attention.noTasks') : $t('dashboard.attention.unassigned', { n: o.unassigned }) }}
            </p>
          </div>
          <span class="shrink-0 font-mono text-xs text-muted">{{ o.number }}</span>
        </DashboardItem>
      </DashboardAttentionCard>

      <DashboardAttentionCard
        v-if="approvals?.waiting.count"
        icon="i-lucide-hourglass"
        tone="neutral"
        :title="$t('dashboard.attention.waiting')"
        :description="approvals.waiting.notViewed ? $t('dashboard.attention.waitingHintNotViewed', { n: approvals.waiting.notViewed }) : $t('dashboard.attention.waitingHint')"
        :count="approvals.waiting.count"
      >
        <DashboardItem
          v-for="a in approvals.waiting.items"
          :key="a.id"
          :to="`/app/orders/${a.order.id}`"
        >
          <div class="min-w-0 flex-1">
            <p><DashboardVehicle :vehicle="a.vehicle" /></p>
            <p class="text-sm text-muted">
              {{ $t(`approvals.kind.${a.kind}`) }} · {{ $t('dashboard.attention.sent', { when: ago(a.createdAt) }) }}
              · {{ a.viewedAt ? $t('dashboard.attention.viewed', { when: ago(a.viewedAt) }) : $t('dashboard.attention.notViewed') }}
            </p>
          </div>
          <span class="shrink-0 font-mono text-xs text-muted">{{ a.order.number }}</span>
        </DashboardItem>
      </DashboardAttentionCard>
    </div>
  </DashboardSection>
</template>
