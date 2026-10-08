<script setup lang="ts">
/** Strona główna: prezentacja produktu i zachęta do założenia konta warsztatu; odsyła do stron dla warsztatów i klientów. */
import { WORKSHOP_STORY } from '~/utils/marketing-story'

definePageMeta({ layout: 'marketing' })

const { t } = useI18n()
useSeoMeta({
  title: () => t('marketing.home.seo.title'),
  description: () => t('marketing.home.seo.description'),
  ogTitle: () => t('marketing.home.seo.title'),
  ogDescription: () => t('marketing.home.seo.description'),
  ogType: 'website',
})

const problem = ['phone', 'wait', 'dispute'] as const
const problemIcons = { phone: 'i-lucide-phone-missed', wait: 'i-lucide-hourglass', dispute: 'i-lucide-circle-help' } as const
const chain = ['photo', 'quote', 'link', 'decision', 'record'] as const
const promises = [
  { key: 'approvals', icon: 'i-lucide-badge-check' },
  { key: 'status', icon: 'i-lucide-bell-ring' },
  { key: 'team', icon: 'i-lucide-users' },
] as const
const journey = [
  { key: 'intake', icon: 'i-lucide-clipboard-check' },
  { key: 'work', icon: 'i-lucide-wrench' },
  { key: 'finding', icon: 'i-lucide-camera' },
  { key: 'quote', icon: 'i-lucide-calculator' },
  { key: 'consent', icon: 'i-lucide-badge-check' },
  { key: 'pickup', icon: 'i-lucide-flag' },
] as const
const numbers = [
  { key: 'vehicles', value: '19' },
  { key: 'roles', value: '3' },
  { key: 'notifications', value: '10' },
  { key: 'install', value: '0' },
] as const
const trust = [
  { key: 'isolation', icon: 'i-lucide-shield-check' },
  { key: 'audit', icon: 'i-lucide-scroll-text' },
  { key: 'minimal', icon: 'i-lucide-eye-off' },
  { key: 'links', icon: 'i-lucide-link' },
] as const
const roadmap = ['protocol', 'inspection', 'invoices', 'hub'] as const
const points = ['install', 'devices', 'locale'] as const
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="mk-hero">
      <UContainer>
        <div class="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
          <div class="space-y-6">
            <p
              class="mk-eyebrow mk-rise"
            >
              {{ $t('marketing.home.hero.eyebrow') }}
            </p>
            <h1
              class="mk-h1 mk-rise"
              style="--mk-delay: 80ms"
            >
              {{ $t('marketing.home.hero.title') }}
            </h1>
            <p
              class="mk-lead mk-rise"
              style="--mk-delay: 160ms"
            >
              {{ $t('marketing.home.hero.lead') }}
            </p>
            <div
              class="flex flex-wrap gap-3 mk-rise"
              style="--mk-delay: 240ms"
            >
              <UButton
                to="/register"
                size="xl"
                trailing-icon="i-lucide-arrow-right"
                :label="$t('marketing.home.hero.primary')"
              />
              <UButton
                to="/dla-warsztatow#przebieg"
                size="xl"
                color="neutral"
                variant="subtle"
                icon="i-lucide-play"
                :label="$t('marketing.home.hero.secondary')"
              />
            </div>
            <ul
              class="mk-tick-list mk-rise"
              style="--mk-delay: 320ms"
            >
              <li
                v-for="point in points"
                :key="point"
              >
                <UIcon
                  name="i-lucide-check"
                  class="size-5"
                />
                <span>{{ $t(`marketing.home.hero.points.${point}`) }}</span>
              </li>
            </ul>
          </div>
          <div
            class="mk-rise"
            style="--mk-delay: 200ms"
          >
            <MarketingHeroLoop />
          </div>
        </div>
      </UContainer>
    </section>

    <!-- Problem -->
    <MarketingSection
      :eyebrow="$t('marketing.home.problem.eyebrow')"
      :title="$t('marketing.home.problem.title')"
      :description="$t('marketing.home.problem.description')"
    >
      <div class="grid gap-4 md:grid-cols-3">
        <article
          v-for="(key, i) in problem"
          :key="key"
          v-reveal="{ delay: i * 90 }"
          class="mk-card space-y-3"
        >
          <span class="mk-icon"><UIcon
            :name="problemIcons[key]"
            class="size-6"
          /></span>
          <h3>{{ $t(`marketing.home.problem.cards.${key}.title`) }}</h3>
          <p>{{ $t(`marketing.home.problem.cards.${key}.text`) }}</p>
        </article>
      </div>
      <div
        v-reveal
        class="mk-card mt-6 flex flex-col gap-4 lg:flex-row lg:items-center"
      >
        <p class="mk-eyebrow shrink-0">
          {{ $t('marketing.home.problem.with') }}
        </p>
        <ol class="flex flex-1 flex-wrap items-center gap-x-2 gap-y-3">
          <li
            v-for="(key, i) in chain"
            :key="key"
            class="flex items-center gap-2"
          >
            <span class="inline-flex items-center gap-2 rounded-full bg-elevated px-4 py-2 font-semibold text-default">
              <span class="grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-inverted">{{ i + 1 }}</span>
              {{ $t(`marketing.home.problem.chain.${key}`) }}
            </span>
            <UIcon
              v-if="i < chain.length - 1"
              name="i-lucide-arrow-right"
              class="size-4 text-muted"
            />
          </li>
        </ol>
      </div>
    </MarketingSection>

    <!-- Trzy obietnice -->
    <MarketingSection
      tone="muted"
      :eyebrow="$t('marketing.home.promises.eyebrow')"
      :title="$t('marketing.home.promises.title')"
    >
      <div class="grid gap-4 md:grid-cols-3">
        <article
          v-for="(item, i) in promises"
          :key="item.key"
          v-reveal="{ delay: i * 90 }"
          class="mk-card space-y-3"
        >
          <span class="mk-icon"><UIcon
            :name="item.icon"
            class="size-6"
          /></span>
          <h3>{{ $t(`marketing.home.promises.items.${item.key}.title`) }}</h3>
          <p>{{ $t(`marketing.home.promises.items.${item.key}.text`) }}</p>
        </article>
      </div>
    </MarketingSection>

    <!-- Dwie drogi -->
    <MarketingSection
      :eyebrow="$t('marketing.home.paths.eyebrow')"
      :title="$t('marketing.home.paths.title')"
      :description="$t('marketing.home.paths.description')"
    >
      <div class="grid gap-5 md:grid-cols-2">
        <NuxtLink
          v-reveal
          to="/dla-warsztatow"
          class="mk-card mk-card-link group"
        >
          <span class="mk-icon"><UIcon
            name="i-lucide-wrench"
            class="size-6"
          /></span>
          <p class="mk-eyebrow">
            {{ $t('marketing.home.paths.workshop.label') }}
          </p>
          <h3 class="mk-h3-lg">
            {{ $t('marketing.home.paths.workshop.title') }}
          </h3>
          <p class="flex-1">
            {{ $t('marketing.home.paths.workshop.text', { count: WORKSHOP_STORY.length }) }}
          </p>
          <span class="inline-flex items-center gap-2 font-semibold text-primary">
            {{ $t('marketing.home.paths.workshop.cta') }}
            <UIcon
              name="i-lucide-arrow-right"
              class="size-4 transition-transform group-hover:translate-x-1"
            />
          </span>
        </NuxtLink>
        <NuxtLink
          v-reveal="{ delay: 100 }"
          to="/dla-klientow"
          class="mk-card mk-card-link customer-card group"
        >
          <span class="mk-icon"><UIcon
            name="i-lucide-smartphone"
            class="size-6"
          /></span>
          <p class="mk-eyebrow">
            {{ $t('marketing.home.paths.customer.label') }}
          </p>
          <h3 class="mk-h3-lg">
            {{ $t('marketing.home.paths.customer.title') }}
          </h3>
          <p class="flex-1">
            {{ $t('marketing.home.paths.customer.text') }}
          </p>
          <span class="inline-flex items-center gap-2 font-semibold text-primary">
            {{ $t('marketing.home.paths.customer.cta') }}
            <UIcon
              name="i-lucide-arrow-right"
              class="size-4 transition-transform group-hover:translate-x-1"
            />
          </span>
        </NuxtLink>
      </div>
    </MarketingSection>

    <!-- Jedna naprawa -->
    <MarketingSection
      tone="muted"
      :eyebrow="$t('marketing.home.journey.eyebrow')"
      :title="$t('marketing.home.journey.title')"
    >
      <ol class="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <li
          v-for="(step, i) in journey"
          :key="step.key"
          v-reveal="{ delay: i * 70 }"
          class="relative space-y-2"
        >
          <div class="flex items-center gap-3">
            <span class="mk-icon"><UIcon
              :name="step.icon"
              class="size-6"
            /></span>
            <span
              v-if="i < journey.length - 1"
              class="hidden h-0.5 flex-1 bg-accented lg:block"
              aria-hidden="true"
            />
          </div>
          <h3 class="text-lg font-bold">
            {{ i + 1 }}. {{ $t(`marketing.home.journey.steps.${step.key}.title`) }}
          </h3>
          <p class="text-sm text-muted">
            {{ $t(`marketing.home.journey.steps.${step.key}.text`) }}
          </p>
        </li>
      </ol>
      <div class="mt-8">
        <UButton
          to="/dla-warsztatow#przebieg"
          color="neutral"
          variant="subtle"
          size="lg"
          trailing-icon="i-lucide-arrow-down"
          :label="$t('marketing.home.journey.link')"
        />
      </div>
    </MarketingSection>

    <!-- Konkrety -->
    <MarketingSection
      tone="brand"
      :eyebrow="$t('marketing.home.numbers.eyebrow')"
      :title="$t('marketing.home.numbers.title')"
    >
      <dl class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="(item, i) in numbers"
          :key="item.key"
          v-reveal="{ delay: i * 80 }"
          class="space-y-3 border-t border-white/20 pt-5"
        >
          <dt class="mk-stat-value">
            {{ item.value }}
          </dt>
          <dd class="text-lg text-white/80">
            {{ $t(`marketing.home.numbers.items.${item.key}`) }}
          </dd>
        </div>
      </dl>
    </MarketingSection>

    <!-- Zaufanie -->
    <MarketingSection
      :eyebrow="$t('marketing.home.trust.eyebrow')"
      :title="$t('marketing.home.trust.title')"
      :description="$t('marketing.home.trust.description')"
    >
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article
          v-for="(item, i) in trust"
          :key="item.key"
          v-reveal="{ delay: i * 80 }"
          class="mk-card space-y-3"
        >
          <span class="mk-icon"><UIcon
            :name="item.icon"
            class="size-6"
          /></span>
          <h3>{{ $t(`marketing.home.trust.items.${item.key}.title`) }}</h3>
          <p>{{ $t(`marketing.home.trust.items.${item.key}.text`) }}</p>
        </article>
      </div>
      <div class="mt-8">
        <UButton
          to="/bezpieczenstwo"
          color="neutral"
          variant="subtle"
          size="lg"
          trailing-icon="i-lucide-arrow-right"
          :label="$t('marketing.home.trust.cta')"
        />
      </div>
    </MarketingSection>

    <!-- Obok programu + plan -->
    <MarketingSection
      tone="muted"
      :eyebrow="$t('marketing.shared.alongside.eyebrow')"
      :title="$t('marketing.shared.alongside.title')"
    >
      <div class="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <p
          v-reveal
          class="mk-lead"
        >
          {{ $t('marketing.shared.alongside.text') }}
        </p>
        <div
          v-reveal="{ delay: 100 }"
          class="mk-card space-y-3"
        >
          <p class="mk-eyebrow">
            {{ $t('marketing.shared.alongside.roadmapTitle') }}
          </p>
          <ul class="flex flex-wrap gap-2">
            <li
              v-for="item in roadmap"
              :key="item"
            >
              <span class="mk-soon">
                <UIcon
                  name="i-lucide-clock"
                  class="size-4"
                />
                {{ $t(`marketing.shared.roadmap.${item}`) }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </MarketingSection>

    <MarketingCta
      :title="$t('marketing.home.cta.title')"
      :description="$t('marketing.home.cta.description')"
      :primary="{ label: $t('marketing.home.cta.primary'), to: '/register' }"
      :secondary="{ label: $t('marketing.home.cta.secondary'), to: '/login' }"
    />
  </div>
</template>
