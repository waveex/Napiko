<script setup lang="ts">
/**
 * Zapętlona animacja w hero strony głównej (czysty CSS, ~12 s): biuro wysyła wycenę, klient dostaje wiadomość,
 * akceptuje i wysyła decyzję, biuro widzi skutek, a zgoda zostaje zapisana. Dekoracja (`aria-hidden`);
 * przy `prefers-reduced-motion` zostaje stan końcowy.
 */
const { n } = useI18n()
const money = (value: number) => n(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
</script>

<template>
  <div
    class="hl-wrap"
    aria-hidden="true"
  >
    <div class="hl hl-stage">
      <div class="hl-window">
        <MarketingWindow :url="$t('marketing.scene.quote.url')">
          <div class="sc-head">
            <h4 class="sc-title">
              {{ $t('marketing.scene.approval.item') }}
            </h4>
            <span class="sc-chip sc-chip-danger">{{ $t('marketing.scene.urgent') }}</span>
          </div>
          <p class="sc-line">
            <UIcon
              name="i-lucide-car"
              class="size-3.5"
            />
            <b>{{ $t('marketing.scene.vehicle') }}</b>
            <span class="sc-plate">{{ $t('marketing.scene.plate') }}</span>
            <span class="sc-sub">· {{ $t('marketing.scene.order') }}</span>
          </p>
          <div class="sc-grid-2">
            <MarketingPhoto class="sc-photo-mini" />
            <dl class="sc-sums">
              <div>
                <dt>{{ $t('marketing.scene.quote.parts') }}</dt>
                <dd>{{ money(320) }}</dd>
              </div>
              <div>
                <dt>{{ $t('marketing.scene.quote.labor') }}</dt>
                <dd>{{ money(120) }}</dd>
              </div>
              <div>
                <dt>{{ $t('marketing.scene.quote.vat') }}</dt>
                <dd>23%</dd>
              </div>
              <div class="is-total">
                <dt>{{ $t('marketing.scene.quote.gross') }}</dt>
                <dd>{{ money(541.2) }} {{ $t('marketing.scene.currency') }}</dd>
              </div>
            </dl>
          </div>
          <span class="sc-btn sc-btn-primary hl-btn">{{ $t('marketing.scene.quote.send') }}</span>
          <p class="sc-toast hl-toast-1">
            <UIcon
              name="i-lucide-send"
              class="size-4"
            />{{ $t('marketing.scene.quote.sent') }}
          </p>
          <p class="sc-toast hl-toast-2">
            <UIcon
              name="i-lucide-badge-check"
              class="size-4"
            />{{ $t('marketing.hero.loop.replied') }}
          </p>
        </MarketingWindow>
      </div>

      <span class="hl-packet"><UIcon
        name="i-lucide-link"
        class="size-4"
      /></span>

      <div class="hl-phone">
        <MarketingPhone ctx="customer">
          <div class="sc-layer hl-ph-lock">
            <div class="sc-lock">
              <p class="sc-lock-time">
                14:20
              </p>
            </div>
          </div>
          <div class="sc-layer hl-notice">
            <div class="sc-lock">
              <p class="sc-lock-time">
                14:20
              </p>
            </div>
            <div class="sc-notice">
              <p class="sc-strong">
                <UIcon
                  name="i-lucide-bell-ring"
                  class="size-3.5"
                /> {{ $t('marketing.scene.shop') }}
              </p>
              <p class="sc-text">
                {{ $t('marketing.scene.alert.push') }}
              </p>
            </div>
          </div>
          <div class="sc-layer hl-ph-ask">
            <div class="sc-page-inner">
              <h4 class="sc-title">
                {{ $t('marketing.scene.approval.title') }}
              </h4>
              <div class="sc-card">
                <MarketingPhoto class="sc-photo-mini" />
                <p class="sc-strong">
                  {{ $t('marketing.scene.approval.item') }}
                </p>
                <p class="sc-price">
                  {{ money(541.2) }} <small>{{ $t('marketing.scene.currency') }}</small>
                </p>
                <div class="sc-btn-row">
                  <span class="sc-btn sc-btn-ghost hl-accept">{{ $t('marketing.scene.approval.yes') }}</span>
                  <span class="sc-btn sc-btn-ghost">{{ $t('marketing.scene.approval.no') }}</span>
                </div>
              </div>
              <div class="sc-check">
                <span class="sc-check-box hl-consent"><UIcon
                  name="i-lucide-check"
                  class="size-3.5"
                /></span>
                <p class="sc-sub">
                  {{ $t('marketing.scene.approval.consent', { total: money(541.2) }) }}
                </p>
              </div>
              <span class="sc-btn sc-btn-primary sc-btn-block hl-submit">{{ $t('marketing.scene.approval.submit') }}</span>
            </div>
          </div>
          <div class="sc-layer hl-ph-thanks">
            <div class="sc-page-inner">
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
            </div>
          </div>
        </MarketingPhone>
      </div>

      <p class="hl-proof">
        <UIcon
          name="i-lucide-shield-check"
          class="size-4"
        />{{ $t('marketing.hero.loop.proof') }}
      </p>
    </div>
  </div>
</template>
