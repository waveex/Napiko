<script setup lang="ts">
/**
 * Pulpit właściciela – wyniki od początku miesiąca w porównaniu z tym samym okresem poprzedniego miesiąca.
 * Wartość zleceń liczymy z kosztorysów zamkniętych zleceń (faktury dojdą z integracją).
 */
import { formatDuration } from '#shared/workshop'
import type { DashboardReport } from '~/composables/useDashboard'

const props = defineProps<{ report: DashboardReport }>()

const { t, n } = useI18n()
const money = (cents: number) => n(cents / 100, 'currency')

/** Zmiana względem poprzedniego okresu – tylko gdy jest z czym porównać. */
function delta(current: number, previous: number) {
  if (!previous) return undefined
  const change = Math.round(((current - previous) / previous) * 100)
  return {
    label: t('dashboard.report.change', { change: `${change > 0 ? '+' : ''}${change}%` }),
    direction: change > 0 ? 'up' as const : change < 0 ? 'down' as const : 'flat' as const,
    good: change >= 0,
  }
}

const closed = computed(() => props.report.closedOrders)
const extra = computed(() => props.report.extraWork)
const decided = computed(() => extra.value.approved + extra.value.rejected)
const closedHint = computed(() => [
  closed.value.averageLeadHours !== null
    ? t('dashboard.report.leadTime', { hours: n(closed.value.averageLeadHours, { maximumFractionDigits: 1 }) })
    : null,
  closed.value.count ? t('dashboard.report.digital', { n: closed.value.digitalApproval, total: closed.value.count }) : null,
].filter(Boolean).join(' · ') || t('dashboard.report.noClosed'))
const extraHint = computed(() => decided.value
  ? t('dashboard.report.extraRate', {
      approved: extra.value.approved,
      total: decided.value,
      rate: Math.round((extra.value.approved / decided.value) * 100),
    })
  : t('dashboard.report.extraNone'))
</script>

<template>
  <DashboardSection
    :title="$t('dashboard.report.title')"
    :description="$t('dashboard.report.description')"
  >
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardStat
        :label="$t('dashboard.report.value')"
        :value="money(closed.grossCents)"
        icon="i-lucide-banknote"
        tone="primary"
        :delta="delta(closed.grossCents, closed.previousGrossCents)"
        :hint="$t('dashboard.report.previous', { value: money(closed.previousGrossCents) })"
      />
      <DashboardStat
        :label="$t('dashboard.report.closed')"
        :value="String(closed.count)"
        icon="i-lucide-clipboard-check"
        tone="primary"
        :delta="delta(closed.count, closed.previousCount)"
        :hint="closedHint"
      />
      <DashboardStat
        :label="$t('dashboard.report.extra')"
        :value="money(extra.approvedGrossCents)"
        icon="i-lucide-badge-plus"
        tone="primary"
        :hint="extraHint"
      />
      <DashboardStat
        :label="$t('dashboard.report.work')"
        :value="formatDuration(report.work.seconds)"
        icon="i-lucide-timer"
        tone="primary"
        :hint="$t('dashboard.report.workHint', { people: report.work.people, tasks: report.work.tasksDone })"
      />
    </div>
    <p
      v-if="closed.withoutEstimate"
      class="flex items-start gap-2 text-sm text-muted"
    >
      <UIcon
        name="i-lucide-info"
        class="mt-0.5 size-4 shrink-0"
      />
      {{ $t('dashboard.report.withoutEstimate', { n: closed.withoutEstimate }) }}
    </p>
  </DashboardSection>
</template>
