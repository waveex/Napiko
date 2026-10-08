<script setup lang="ts">
/**
 * Sceny historii „Naprawa oczami klienta” (strona dla klientów): wszystko na jednym telefonie, w palecie
 * klienta. `local` (0–1) to postęp przewijania wewnątrz kroku.
 */
import { storyRamp } from '~/utils/marketing-story'

const props = defineProps<{ index: number, local: number }>()
const on = (at: number) => props.local >= at

/** Zadania z trzech zrobione na stronie statusu: w trakcie kroku przechodzi z 1 na 2. */
const done = computed(() => (on(0.5) ? 2 : 1))
const settingsScroll = computed(() => storyRamp(props.local, 0.08, 0.38) * 12)
</script>

<template>
  <Transition name="scene">
    <!-- 1. SMS z linkiem -->
    <MarketingPhone
      v-if="index === 0"
      key="arrive"
      ctx="customer"
    >
      <div
        class="sc-layer"
        :class="{ 'is-off': on(0.5) }"
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
        :class="{ 'is-on': on(0.5) }"
      >
        <MarketingStoryStatus
          :step="0"
          :contact="false"
        />
      </div>
    </MarketingPhone>

    <!-- 2. Status naprawy -->
    <MarketingPhone
      v-else-if="index === 1"
      key="status"
      ctx="customer"
    >
      <MarketingStoryStatus
        :step="1"
        :done="done"
      >
        <p
          class="sc-callout mk-pop"
          :class="{ 'is-on': on(0.3) }"
        >
          <UIcon
            name="i-lucide-eye-off"
            class="size-4 shrink-0"
          />{{ $t('marketing.scene.status.privacy') }}
        </p>
      </MarketingStoryStatus>
    </MarketingPhone>

    <!-- 3. Powiadomienie: warsztat czeka na decyzję -->
    <MarketingPhone
      v-else-if="index === 2"
      key="alert"
      ctx="customer"
    >
      <div
        class="sc-layer"
        :class="{ 'is-off': on(0.5) }"
      >
        <div class="sc-lock">
          <p class="sc-lock-time">
            14:20
          </p>
        </div>
        <div
          class="sc-notice mk-pop"
          :class="{ 'is-on': on(0.08) }"
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
            {{ $t('marketing.scene.alert.push') }}
          </p>
        </div>
        <p
          class="sc-hint mk-pop"
          :class="{ 'is-on': on(0.28) }"
        >
          <UIcon
            name="i-lucide-mouse-pointer-click"
            class="size-4"
          />{{ $t('marketing.scene.alert.hint') }}
        </p>
      </div>
      <div
        class="sc-layer sc-layer-in"
        :class="{ 'is-on': on(0.5) }"
      >
        <MarketingStoryStatus
          :step="1"
          :done="2"
          waiting
          :contact="false"
        />
      </div>
    </MarketingPhone>

    <!-- 4. Decyzja -->
    <MarketingPhone
      v-else-if="index === 3"
      key="decision"
      ctx="customer"
    >
      <MarketingStoryApproval :local="local" />
    </MarketingPhone>

    <!-- 5. Warsztat dostał decyzję -->
    <MarketingPhone
      v-else-if="index === 4"
      key="sent"
      ctx="customer"
    >
      <MarketingStoryApproval
        :local="1"
        thanks
      />
    </MarketingPhone>

    <!-- 6. Push zamiast SMS-a -->
    <MarketingPhone
      v-else-if="index === 5"
      key="push"
      ctx="customer"
    >
      <MarketingStoryStatus
        :step="1"
        :done="2"
        settings
        :push-on="on(0.52)"
        :scroll="settingsScroll"
        :contact="false"
      />
      <p
        class="sc-toast sc-toast-float mk-pop"
        :class="{ 'is-on': on(0.62) }"
      >
        <UIcon
          name="i-lucide-bell-ring"
          class="size-4"
        />{{ $t('marketing.scene.status.pushEnabled') }}
      </p>
    </MarketingPhone>

    <!-- 7. Gotowe do odbioru -->
    <MarketingPhone
      v-else-if="index === 6"
      key="ready"
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

    <!-- 8. Odebrane -->
    <MarketingPhone
      v-else
      key="done"
      ctx="customer"
    >
      <MarketingStoryStatus
        :step="3"
        :done="3"
        :contact="false"
      >
        <div
          class="sc-card mk-pop"
          :class="{ 'is-on': on(0.2) }"
        >
          <p class="sc-line">
            <UIcon
              name="i-lucide-clock"
              class="size-4"
            />
            <b>{{ $t('marketing.scene.done.linkTitle') }}</b>
          </p>
          <p class="sc-sub">
            {{ $t('marketing.scene.done.linkHint') }}
          </p>
        </div>
        <div
          class="sc-card mk-pop"
          :class="{ 'is-on': on(0.5) }"
        >
          <p class="sc-line sc-line-between">
            <b>{{ $t('marketing.scene.done.hubTitle') }}</b>
            <span class="sc-chip sc-chip-neutral">{{ $t('marketing.scene.done.soon') }}</span>
          </p>
          <p class="sc-sub">
            {{ $t('marketing.scene.done.hubHint') }}
          </p>
        </div>
      </MarketingStoryStatus>
    </MarketingPhone>
  </Transition>
</template>
