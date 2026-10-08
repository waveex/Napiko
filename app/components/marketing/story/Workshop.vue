<script setup lang="ts">
/**
 * Sceny historii „Jedna naprawa od A do Z” (strona dla warsztatów). Każdy krok to jeden ekran: biuro (okno),
 * mechanik lub klient (telefon). `local` (0–1) to postęp przewijania wewnątrz kroku – elementy pojawiają się
 * po przekroczeniu progów, liczby rosną płynnie, więc przewijanie w górę cofa animację.
 */
import { storyRamp } from '~/utils/marketing-story'

const props = defineProps<{ index: number, local: number }>()

const { n, t } = useI18n()
const money = (value: number) => n(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const on = (at: number) => props.local >= at

// 3: licznik czasu pracy (przesuwa się z przewijaniem)
const clock = computed(() => {
  const total = Math.round(storyRamp(props.local, 0.12, 0.85) * 2537)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
})

// 4: opis wpisywany na żywo
const typed = computed(() => {
  const full = t('marketing.scene.finding.describeValue')
  return full.slice(0, Math.round(storyRamp(props.local, 0.28, 0.6) * full.length))
})

// 5: wycena – kwoty rosną, brutto liczone z VAT 23%
const parts = computed(() => 320 * storyRamp(props.local, 0.12, 0.4))
const labor = computed(() => 120 * storyRamp(props.local, 0.22, 0.5))
const gross = computed(() => (parts.value + labor.value) * 1.23)

// 9: wyniki miesiąca (dane przykładowe)
const ring = computed(() => storyRamp(props.local, 0.15, 0.7))
const ringValue = computed(() => Math.round(74 * ring.value))
const closed = computed(() => Math.round(27 * storyRamp(props.local, 0.1, 0.5)))
const hours = computed(() => Math.round(212 * storyRamp(props.local, 0.2, 0.6)))
</script>

<template>
  <Transition name="scene">
    <!-- 1. PRZYJĘCIE (biuro) -->
    <MarketingWindow
      v-if="index === 0"
      key="intake"
      :url="$t('marketing.scene.intake.url')"
    >
      <div class="sc-head">
        <h4 class="sc-title">
          {{ $t('marketing.scene.intake.title') }}
        </h4>
        <span
          class="sc-chip sc-chip-info mk-pop"
          :class="{ 'is-on': on(0.84) }"
        >{{ $t('marketing.scene.order') }}</span>
      </div>
      <div class="sc-grid-2">
        <div
          class="sc-field mk-pop is-on"
        >
          <span class="sc-label">{{ $t('marketing.scene.intake.customer') }}</span>
          <span class="sc-value"><UIcon
            name="i-lucide-user"
            class="size-4"
          />{{ $t('marketing.scene.customer') }}</span>
        </div>
        <div
          class="sc-field mk-pop"
          :class="{ 'is-on': on(0.1) }"
        >
          <span class="sc-label">{{ $t('marketing.scene.intake.vehicle') }}</span>
          <span class="sc-value"><UIcon
            name="i-lucide-car"
            class="size-4"
          />{{ $t('marketing.scene.vehicle') }} <span class="sc-plate">{{ $t('marketing.scene.plate') }}</span></span>
        </div>
      </div>
      <div
        class="sc-field mk-pop"
        :class="{ 'is-on': on(0.2) }"
      >
        <span class="sc-label">{{ $t('marketing.scene.intake.scope') }}</span>
        <span class="sc-value">{{ $t('marketing.scene.intake.scopeValue') }}</span>
      </div>
      <div
        class="sc-field mk-pop"
        :class="{ 'is-on': on(0.3) }"
      >
        <span class="sc-label">{{ $t('marketing.scene.intake.tasks') }}</span>
        <ul class="sc-tasks">
          <li>
            <UIcon
              name="i-lucide-circle-dot"
              class="size-4"
            />{{ $t('marketing.scene.intake.task1') }}
          </li>
          <li
            class="mk-pop"
            :class="{ 'is-on': on(0.4) }"
          >
            <UIcon
              name="i-lucide-circle-dot"
              class="size-4"
            />{{ $t('marketing.scene.intake.task2') }}
          </li>
        </ul>
      </div>
      <div
        class="sc-check mk-pop"
        :class="{ 'is-on': on(0.5) }"
      >
        <span
          class="sc-check-box"
          :data-on="on(0.58)"
        >
          <UIcon
            name="i-lucide-check"
            class="size-3.5"
          />
        </span>
        <p class="sc-strong">
          {{ $t('marketing.scene.intake.notify') }} <span class="sc-sub">· {{ $t('marketing.scene.intake.notifyVia') }}</span>
        </p>
      </div>
      <div class="sc-foot">
        <span
          class="sc-btn sc-btn-primary"
          :class="{ 'is-pressed': on(0.72) }"
        >{{ $t('marketing.scene.intake.create') }}</span>
      </div>
    </MarketingWindow>

    <!-- 2. STATUS (klient: SMS, potem strona statusu) -->
    <MarketingPhone
      v-else-if="index === 1"
      key="status"
      ctx="customer"
    >
      <div
        class="sc-layer"
        :class="{ 'is-off': on(0.46) }"
      >
        <div class="sc-lock">
          <p class="sc-lock-time">
            9:41
          </p>
          <p class="sc-sub">
            {{ $t('marketing.scene.sms.date') }}
          </p>
        </div>
        <div
          class="sc-notice mk-pop"
          :class="{ 'is-on': on(0.08) }"
        >
          <div class="sc-line sc-line-between">
            <p class="sc-strong">
              <UIcon
                name="i-lucide-message-square"
                class="size-3.5"
              /> SMS · {{ $t('marketing.scene.shop') }}
            </p>
            <span class="sc-sub">{{ $t('marketing.scene.sms.now') }}</span>
          </div>
          <p class="sc-text">
            {{ $t('marketing.scene.sms.text') }} <u>{{ $t('marketing.scene.sms.link') }}</u>
          </p>
        </div>
        <p
          class="sc-hint mk-pop"
          :class="{ 'is-on': on(0.26) }"
        >
          <UIcon
            name="i-lucide-mouse-pointer-click"
            class="size-4"
          />{{ $t('marketing.scene.sms.hint') }}
        </p>
      </div>
      <div
        class="sc-layer sc-layer-in"
        :class="{ 'is-on': on(0.46) }"
      >
        <MarketingStoryStatus
          :step="0"
          :contact="false"
        />
      </div>
    </MarketingPhone>

    <!-- 3. PRACA (mechanik) -->
    <MarketingPhone
      v-else-if="index === 2"
      key="work"
    >
      <div class="sc-page">
        <div class="sc-page-inner">
          <h4 class="sc-title">
            {{ $t('marketing.scene.work.title') }}
          </h4>
          <p class="sc-label">
            {{ on(0.14) ? $t('marketing.scene.work.nowWorking') : $t('marketing.scene.work.todo') }}
          </p>
          <div
            class="sc-card"
            :class="{ 'sc-card-live': on(0.14) }"
          >
            <p class="sc-strong">
              {{ $t('marketing.scene.intake.task1') }}
            </p>
            <p class="sc-sub">
              {{ $t('marketing.scene.vehicle') }} · {{ $t('marketing.scene.plate') }}
            </p>
            <p class="sc-clock">
              {{ clock }}
            </p>
            <div class="sc-btn-row">
              <template v-if="on(0.14)">
                <span class="sc-btn sc-btn-ghost sc-btn-tall"><UIcon
                  name="i-lucide-pause"
                  class="size-4"
                />{{ $t('marketing.scene.work.pause') }}</span>
                <span class="sc-btn sc-btn-ghost sc-btn-tall"><UIcon
                  name="i-lucide-square"
                  class="size-4"
                />{{ $t('marketing.scene.work.finish') }}</span>
              </template>
              <span
                v-else
                class="sc-btn sc-btn-primary sc-btn-tall sc-btn-block"
                :class="{ 'is-pressed': on(0.08) }"
              ><UIcon
                name="i-lucide-play"
                class="size-4"
              />{{ $t('marketing.scene.work.start') }}</span>
            </div>
          </div>
          <div
            class="sc-btn-row mk-pop"
            :class="{ 'is-on': on(0.3) }"
          >
            <span class="sc-btn sc-btn-ghost sc-btn-tall"><UIcon
              name="i-lucide-camera"
              class="size-4"
            />{{ $t('marketing.scene.work.photo') }}</span>
            <span
              class="sc-btn sc-btn-ghost sc-btn-tall"
              :class="{ 'sc-btn-pulse': on(0.7) }"
            ><UIcon
              name="i-lucide-triangle-alert"
              class="size-4"
            />{{ $t('marketing.scene.work.report') }}</span>
          </div>
          <div
            class="sc-card mk-pop"
            :class="{ 'is-on': on(0.5) }"
          >
            <p class="sc-label">
              {{ $t('marketing.scene.work.next') }}
            </p>
            <p class="sc-strong">
              {{ $t('marketing.scene.intake.task2') }}
            </p>
            <p class="sc-sub">
              {{ $t('marketing.scene.work.nextHint') }}
            </p>
          </div>
        </div>
      </div>
    </MarketingPhone>

    <!-- 4. ZNALEZIONA USTERKA (mechanik zgłasza potrzebę) -->
    <MarketingPhone
      v-else-if="index === 3"
      key="finding"
    >
      <div class="sc-page">
        <div class="sc-page-inner">
          <h4 class="sc-title">
            {{ $t('marketing.scene.finding.title') }}
          </h4>
          <div class="sc-seg">
            <span>{{ $t('marketing.scene.finding.part') }}</span>
            <span :data-on="on(0.1)">{{ $t('marketing.scene.finding.extra') }}</span>
          </div>
          <p class="sc-label">
            {{ $t('marketing.scene.finding.urgency') }}
          </p>
          <div class="sc-pills">
            <span
              class="sc-chip"
              :class="on(0.22) ? 'sc-chip-danger is-selected' : 'sc-chip-neutral'"
            >{{ $t('marketing.scene.urgent') }}</span>
            <span class="sc-chip sc-chip-neutral">{{ $t('marketing.scene.finding.recommended') }}</span>
            <span class="sc-chip sc-chip-neutral">{{ $t('marketing.scene.finding.canWait') }}</span>
          </div>
          <div class="sc-field">
            <span class="sc-label">{{ $t('marketing.scene.finding.describe') }}</span>
            <span class="sc-value sc-typed">{{ typed }}<i
              class="sc-caret"
              :class="{ 'is-on': !on(0.62) }"
            /></span>
          </div>
          <div
            class="mk-pop"
            :class="{ 'is-on': on(0.5) }"
          >
            <MarketingPhoto
              class="sc-photo-wide"
              :flash="on(0.5) && !on(0.58)"
            />
          </div>
          <div
            class="sc-check mk-pop"
            :class="{ 'is-on': on(0.64) }"
          >
            <span
              class="sc-check-box"
              :data-on="on(0.7)"
            >
              <UIcon
                name="i-lucide-check"
                class="size-3.5"
              />
            </span>
            <p class="sc-strong">
              {{ $t('marketing.scene.finding.block') }}
            </p>
          </div>
          <span
            class="sc-btn sc-btn-primary sc-btn-tall sc-btn-block"
            :class="{ 'is-pressed': on(0.84) }"
          >{{ $t('marketing.scene.finding.send') }}</span>
          <p
            class="sc-toast mk-pop"
            :class="{ 'is-on': on(0.93) }"
          >
            <UIcon
              name="i-lucide-send"
              class="size-4"
            />{{ $t('marketing.scene.finding.sent') }}
          </p>
        </div>
      </div>
    </MarketingPhone>

    <!-- 5. WYCENA (biuro) -->
    <MarketingWindow
      v-else-if="index === 4"
      key="quote"
      :url="$t('marketing.scene.quote.url')"
    >
      <template #bar>
        <span class="sc-bell mk-pop is-on">
          <UIcon
            name="i-lucide-bell"
            class="size-4"
          />
          <i>1</i>
        </span>
      </template>
      <div class="sc-split">
        <div class="sc-list">
          <p class="sc-label">
            {{ $t('marketing.scene.quote.list') }}
          </p>
          <div class="sc-list-item is-active">
            <p class="sc-strong">
              {{ $t('marketing.scene.approval.item') }}
            </p>
            <p class="sc-sub">
              {{ $t('marketing.scene.quote.by') }}
            </p>
            <span class="sc-chip sc-chip-danger">{{ $t('marketing.scene.urgent') }}</span>
          </div>
        </div>
        <div class="sc-detail">
          <MarketingPhoto class="sc-photo-mini" />
          <p class="sc-label">
            {{ $t('marketing.scene.quote.pricing') }}
          </p>
          <dl class="sc-sums">
            <div>
              <dt>{{ $t('marketing.scene.quote.parts') }}</dt>
              <dd>{{ money(parts) }}</dd>
            </div>
            <div>
              <dt>{{ $t('marketing.scene.quote.labor') }}</dt>
              <dd>{{ money(labor) }}</dd>
            </div>
            <div>
              <dt>{{ $t('marketing.scene.quote.vat') }}</dt>
              <dd>23%</dd>
            </div>
            <div class="is-total">
              <dt>{{ $t('marketing.scene.quote.gross') }}</dt>
              <dd>{{ money(gross) }} {{ $t('marketing.scene.currency') }}</dd>
            </div>
          </dl>
          <div
            class="sc-pills mk-pop"
            :class="{ 'is-on': on(0.5) }"
          >
            <span
              class="sc-chip"
              :class="on(0.58) ? 'sc-chip-info is-selected' : 'sc-chip-neutral'"
            >SMS</span>
            <span class="sc-chip sc-chip-neutral">{{ $t('common.email') }}</span>
            <span class="sc-chip sc-chip-neutral">{{ $t('marketing.scene.quote.manual') }}</span>
          </div>
          <span
            class="sc-btn sc-btn-primary sc-btn-block"
            :class="{ 'is-pressed': on(0.76) }"
          >{{ $t('marketing.scene.quote.send') }}</span>
          <p
            class="sc-toast mk-pop"
            :class="{ 'is-on': on(0.9) }"
          >
            <UIcon
              name="i-lucide-send"
              class="size-4"
            />{{ $t('marketing.scene.quote.sent') }}
          </p>
        </div>
      </div>
    </MarketingWindow>

    <!-- 6. ZGODA (klient decyduje przez link) -->
    <MarketingPhone
      v-else-if="index === 5"
      key="consent"
      ctx="customer"
    >
      <MarketingStoryApproval :local="local" />
    </MarketingPhone>

    <!-- 7. SKUTEK (biuro: wszystko dzieje się samo) -->
    <MarketingWindow
      v-else-if="index === 6"
      key="effect"
      :url="$t('marketing.scene.effect.url')"
    >
      <template #bar>
        <span class="sc-bell">
          <UIcon
            name="i-lucide-bell"
            class="size-4"
          />
          <i>1</i>
        </span>
      </template>
      <div class="sc-banner mk-pop is-on">
        <span class="sc-thanks-icon"><UIcon
          name="i-lucide-badge-check"
          class="size-5"
        /></span>
        <div>
          <p class="sc-strong">
            {{ $t('marketing.scene.effect.replied') }}
          </p>
          <p class="sc-sub">
            {{ $t('marketing.scene.effect.repliedHint') }}
          </p>
        </div>
      </div>
      <ul class="sc-effects">
        <li
          class="mk-pop"
          :class="{ 'is-on': on(0.16) }"
        >
          <UIcon
            name="i-lucide-user-round-check"
            class="sc-effects-icon"
          />
          <div>
            <p class="sc-strong">
              {{ $t('marketing.scene.effect.task') }}
            </p>
            <p class="sc-sub">
              {{ $t('marketing.scene.effect.taskHint') }}
            </p>
          </div>
        </li>
        <li
          class="mk-pop"
          :class="{ 'is-on': on(0.34) }"
        >
          <UIcon
            name="i-lucide-receipt"
            class="sc-effects-icon"
          />
          <div>
            <p class="sc-strong">
              {{ $t('marketing.scene.effect.estimate') }}
            </p>
            <p class="sc-sub">
              {{ $t('marketing.scene.effect.estimateHint', { total: money(541.2) }) }}
            </p>
          </div>
        </li>
        <li
          class="mk-pop"
          :class="{ 'is-on': on(0.52) }"
        >
          <UIcon
            name="i-lucide-wrench"
            class="sc-effects-icon"
          />
          <div>
            <p class="sc-strong">
              {{ $t('marketing.scene.effect.status') }}
            </p>
            <p class="sc-sub">
              {{ $t('marketing.scene.effect.statusHint') }}
            </p>
          </div>
        </li>
        <li
          class="mk-pop"
          :class="{ 'is-on': on(0.7) }"
        >
          <UIcon
            name="i-lucide-scroll-text"
            class="sc-effects-icon"
          />
          <div>
            <p class="sc-strong">
              {{ $t('marketing.scene.effect.audit') }}
            </p>
            <p class="sc-mono">
              {{ $t('marketing.scene.effect.hash') }}
            </p>
          </div>
        </li>
      </ul>
      <p
        class="sc-chip sc-chip-ok mk-pop"
        :class="{ 'is-on': on(0.88) }"
      >
        <UIcon
          name="i-lucide-link"
          class="size-3.5"
        />{{ $t('marketing.scene.effect.chain') }}
      </p>
    </MarketingWindow>

    <!-- 8. ODBIÓR (klient: gotowe) -->
    <MarketingPhone
      v-else-if="index === 7"
      key="pickup"
      ctx="customer"
    >
      <div
        class="sc-layer"
        :class="{ 'is-off': on(0.42) }"
      >
        <div class="sc-lock">
          <p class="sc-lock-time">
            16:05
          </p>
        </div>
        <div
          class="sc-notice mk-pop"
          :class="{ 'is-on': on(0.06) }"
        >
          <div class="sc-line sc-line-between">
            <p class="sc-strong">
              <UIcon
                name="i-lucide-bell-ring"
                class="size-3.5"
              /> {{ $t('marketing.scene.shop') }}
            </p>
            <span class="sc-sub">{{ $t('marketing.scene.sms.now') }}</span>
          </div>
          <p class="sc-text">
            {{ $t('marketing.scene.pickup.push') }}
          </p>
        </div>
      </div>
      <div
        class="sc-layer sc-layer-in"
        :class="{ 'is-on': on(0.42) }"
      >
        <MarketingStoryStatus
          :step="2"
          :done="3"
        />
      </div>
    </MarketingPhone>

    <!-- 9. WYNIKI (właściciel) -->
    <MarketingWindow
      v-else
      key="results"
      :url="$t('marketing.scene.results.url')"
    >
      <div class="sc-head">
        <h4 class="sc-title">
          {{ $t('marketing.scene.results.title') }}
        </h4>
        <span class="sc-chip sc-chip-neutral">{{ $t('marketing.scene.results.sample') }}</span>
      </div>
      <div class="sc-grid-2 sc-results">
        <div class="sc-card sc-card-ring">
          <div class="sc-ring-wrap">
            <svg
              viewBox="0 0 80 80"
              class="sc-ring"
              aria-hidden="true"
            >
              <circle
                cx="40"
                cy="40"
                r="32"
                class="sc-ring-bg"
              />
              <circle
                cx="40"
                cy="40"
                r="32"
                class="sc-ring-fg"
                pathLength="100"
                :style="{ strokeDasharray: `${74 * ring} 100` }"
              />
            </svg>
            <p class="sc-ring-value">
              {{ ringValue }}%
            </p>
          </div>
          <p class="sc-strong">
            {{ $t('marketing.scene.results.approved') }}
          </p>
          <p class="sc-sub">
            {{ $t('marketing.scene.results.approvedHint') }}
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <div class="sc-card">
            <p class="sc-label">
              {{ $t('marketing.scene.results.closed') }}
            </p>
            <p class="sc-stat">
              {{ closed }}
            </p>
          </div>
          <div class="sc-card">
            <p class="sc-label">
              {{ $t('marketing.scene.results.link') }}
            </p>
            <p class="sc-stat">
              {{ Math.round(81 * storyRamp(local, 0.25, 0.65)) }}%
            </p>
          </div>
          <div class="sc-card">
            <p class="sc-label">
              {{ $t('marketing.scene.results.hours') }}
            </p>
            <p class="sc-stat">
              {{ hours }} h
            </p>
          </div>
        </div>
      </div>
      <p
        class="sc-sub mk-pop"
        :class="{ 'is-on': on(0.8) }"
      >
        {{ $t('marketing.scene.results.hint') }}
      </p>
    </MarketingWindow>
  </Transition>
</template>
