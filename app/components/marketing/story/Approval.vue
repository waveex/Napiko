<script setup lang="ts">
/**
 * Strona prośby o zgodę na pracę dodatkową na telefonie klienta (odwzorowanie /approve/<token>):
 * zdjęcie, cena brutto, „Akceptuję / Nie teraz”, zgoda na kwotę, „Wyślij decyzję”.
 * `local` (0–1) steruje kolejnością: wybór, przewinięcie, zgoda, wysłanie; `thanks` wymusza ekran po wysłaniu.
 */
import { storyRamp } from '~/utils/marketing-story'

const props = withDefaults(defineProps<{ local: number, thanks?: boolean }>(), { thanks: false })

const { n } = useI18n()
const money = (value: number) => n(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const on = (at: number) => props.local >= at

const accepted = computed(() => on(0.3))
const consent = computed(() => on(0.62))
const pressed = computed(() => on(0.86))
const sent = computed(() => props.thanks || on(0.94))
const scroll = computed(() => (sent.value ? 0 : storyRamp(props.local, 0.42, 0.6) * 11.5))
</script>

<template>
  <div
    class="sc-page"
    :style="{ '--sc-scroll': scroll }"
  >
    <div class="sc-page-inner">
      <header class="sc-card sc-card-accent">
        <p class="sc-sub">
          {{ $t('marketing.scene.from') }}
        </p>
        <p class="sc-strong">
          {{ $t('marketing.scene.shop') }}
        </p>
        <h4 class="sc-title">
          {{ thanks || sent ? $t('marketing.scene.approval.thanksTitle') : $t('marketing.scene.approval.title') }}
        </h4>
        <p class="sc-line">
          <UIcon
            name="i-lucide-car"
            class="size-3.5"
          />
          <b>{{ $t('marketing.scene.vehicle') }}</b>
          <span class="sc-plate">{{ $t('marketing.scene.plate') }}</span>
        </p>
      </header>

      <template v-if="!(thanks || sent)">
        <div class="sc-card">
          <MarketingPhoto class="sc-photo-wide" />
          <div class="sc-line sc-line-between">
            <p class="sc-strong">
              {{ $t('marketing.scene.approval.item') }}
            </p>
            <span class="sc-chip sc-chip-danger">{{ $t('marketing.scene.urgent') }}</span>
          </div>
          <p class="sc-sub">
            {{ $t('marketing.scene.approval.itemHint') }}
          </p>
          <p class="sc-price">
            {{ money(541.2) }} <small>{{ $t('marketing.scene.currency') }} {{ $t('marketing.scene.approval.gross') }}</small>
          </p>
          <p class="sc-sub">
            {{ $t('marketing.scene.approval.split', { parts: money(393.6), labor: money(147.6) }) }}
          </p>
          <div class="sc-btn-row">
            <span
              class="sc-btn"
              :class="accepted ? 'sc-btn-primary' : 'sc-btn-ghost'"
            >
              <UIcon
                name="i-lucide-check"
                class="size-4"
              />{{ $t('marketing.scene.approval.yes') }}
            </span>
            <span class="sc-btn sc-btn-ghost">{{ $t('marketing.scene.approval.no') }}</span>
          </div>
        </div>

        <div class="sc-card">
          <p class="sc-sub">
            {{ $t('marketing.scene.approval.summary', { count: accepted ? 1 : 0, total: money(accepted ? 541.2 : 0) }) }}
          </p>
          <div class="sc-check">
            <span
              class="sc-check-box"
              :data-on="consent"
            >
              <UIcon
                name="i-lucide-check"
                class="size-3.5"
              />
            </span>
            <p class="sc-strong">
              {{ $t('marketing.scene.approval.consent', { total: money(541.2) }) }}
            </p>
          </div>
          <span
            class="sc-btn sc-btn-primary sc-btn-block"
            :class="{ 'is-pressed': pressed }"
          >{{ $t('marketing.scene.approval.submit') }}</span>
          <p class="sc-sub">
            {{ $t('marketing.scene.approval.legal') }}
          </p>
        </div>
      </template>

      <template v-else>
        <div class="sc-card sc-thanks">
          <span class="sc-thanks-icon"><UIcon
            name="i-lucide-check"
            class="size-6"
          /></span>
          <p class="sc-strong">
            {{ $t('marketing.scene.approval.thanks') }}
          </p>
          <p class="sc-sub">
            {{ $t('marketing.scene.approval.thanksHint') }}
          </p>
        </div>
        <div class="sc-card">
          <p class="sc-strong">
            {{ $t('marketing.scene.approval.item') }}
          </p>
          <div class="sc-line sc-line-between">
            <span class="sc-chip sc-chip-ok">{{ $t('marketing.scene.approval.approved') }}</span>
            <span class="sc-strong">{{ money(541.2) }} {{ $t('marketing.scene.currency') }}</span>
          </div>
          <p class="sc-mono">
            {{ $t('marketing.scene.approval.recorded') }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
