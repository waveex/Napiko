<script setup lang="ts">
/**
 * Strona dla klientów warsztatu: ta sama naprawa oczami klienta (animacja sterowana przewijaniem),
 * co klient dostaje i czego nie traci (dane, decyzja), pytania oraz zachęta, by pokazać Napiko swojemu warsztatowi.
 * Paleta klienta (fiolet) jest wybierana przez themeContext – tak samo jak na stronach /s/ i /approve/.
 */
import { CUSTOMER_STORY, CUSTOMER_STORY_ACTORS } from '~/utils/marketing-story'
import type { StoryStepView } from '~/components/marketing/ScrollStory.vue'

definePageMeta({ layout: 'marketing', themeContext: 'customer', alias: ['/for-customers'] })

const { t, te } = useI18n()
const toast = useToast()
useSeoMeta({
  title: () => t('marketing.customers.seo.title'),
  description: () => t('marketing.customers.seo.description'),
  ogTitle: () => t('marketing.customers.seo.title'),
  ogDescription: () => t('marketing.customers.seo.description'),
  ogType: 'website',
})

const steps = computed<StoryStepView[]>(() => CUSTOMER_STORY.map((step) => {
  const base = `marketing.customers.story.steps.${step.key}`
  return {
    ...step,
    tag: t(`${base}.tag`),
    title: t(`${base}.title`),
    text: t(`${base}.text`),
    proof: te(`${base}.proof`) ? t(`${base}.proof`) : undefined,
  }
}))

const chips = [
  { key: 'account', icon: 'i-lucide-user-round-x' },
  { key: 'app', icon: 'i-lucide-smartphone' },
  { key: 'link', icon: 'i-lucide-link' },
] as const
const guarantees = [
  { key: 'noAccount', icon: 'i-lucide-user-round-x' },
  { key: 'privacy', icon: 'i-lucide-eye-off' },
  { key: 'masked', icon: 'i-lucide-phone-off' },
  { key: 'expiry', icon: 'i-lucide-timer' },
  { key: 'optout', icon: 'i-lucide-bell-off' },
  { key: 'token', icon: 'i-lucide-key-round' },
] as const
const faqKeys = ['install', 'account', 'refuse', 'silence', 'data', 'sms'] as const

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    toast.add({ title: t('marketing.customers.refer.copied'), color: 'success', icon: 'i-lucide-check' })
  }
  catch {
    toast.add({ title: t('marketing.customers.refer.failed'), color: 'warning' })
  }
}
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="mk-hero">
      <UContainer>
        <div class="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-8">
          <div class="space-y-6">
            <p class="mk-eyebrow mk-rise">
              {{ $t('marketing.customers.hero.eyebrow') }}
            </p>
            <h1
              class="mk-h1 mk-rise"
              style="--mk-delay: 80ms"
            >
              {{ $t('marketing.customers.hero.title') }}
            </h1>
            <p
              class="mk-lead mk-rise"
              style="--mk-delay: 160ms"
            >
              {{ $t('marketing.customers.hero.lead') }}
            </p>
            <div
              class="flex flex-wrap gap-3 mk-rise"
              style="--mk-delay: 240ms"
            >
              <UButton
                to="#przebieg"
                size="xl"
                trailing-icon="i-lucide-arrow-down"
                :label="$t('marketing.customers.hero.primary')"
              />
              <UButton
                to="/dla-warsztatow"
                size="xl"
                color="neutral"
                variant="subtle"
                :label="$t('marketing.customers.hero.secondary')"
              />
            </div>
            <ul
              class="flex flex-wrap gap-2 mk-rise"
              style="--mk-delay: 320ms"
            >
              <li
                v-for="chip in chips"
                :key="chip.key"
              >
                <span class="mk-soon mk-soon-solid">
                  <UIcon
                    :name="chip.icon"
                    class="size-4"
                  />
                  {{ $t(`marketing.customers.hero.chips.${chip.key}`) }}
                </span>
              </li>
            </ul>
          </div>
          <div
            class="mk-hero-phone mk-rise"
            style="--mk-delay: 200ms"
            aria-hidden="true"
          >
            <MarketingPhone ctx="customer">
              <MarketingStoryStatus
                :step="1"
                :done="2"
                waiting
                :contact="false"
              />
            </MarketingPhone>
          </div>
        </div>
      </UContainer>
    </section>

    <!-- Animowany przebieg naprawy oczami klienta -->
    <MarketingScrollStory
      id="przebieg"
      :steps="steps"
      :actors="CUSTOMER_STORY_ACTORS"
      actor-labels="marketing.customers.story.actors"
      :label="$t('marketing.customers.story.label')"
      :note="$t('marketing.customers.story.note')"
    >
      <template #intro>
        <div class="story-intro">
          <p class="mk-eyebrow">
            {{ $t('marketing.customers.story.eyebrow') }}
          </p>
          <h2 class="mk-h2 story-title">
            {{ $t('marketing.customers.story.title') }}
          </h2>
        </div>
      </template>
      <template #stage="{ index, local }">
        <MarketingStoryCustomer
          :index="index"
          :local="local"
        />
      </template>
    </MarketingScrollStory>

    <!-- Gwarancje -->
    <MarketingSection
      tone="muted"
      :eyebrow="$t('marketing.customers.guarantees.eyebrow')"
      :title="$t('marketing.customers.guarantees.title')"
    >
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="(item, i) in guarantees"
          :key="item.key"
          v-reveal="{ delay: (i % 3) * 90 }"
          class="mk-card space-y-3"
        >
          <span class="mk-icon"><UIcon
            :name="item.icon"
            class="size-6"
          /></span>
          <h3>{{ $t(`marketing.customers.guarantees.items.${item.key}.title`) }}</h3>
          <p>{{ $t(`marketing.customers.guarantees.items.${item.key}.text`) }}</p>
        </article>
      </div>
    </MarketingSection>

    <!-- FAQ -->
    <MarketingSection
      :eyebrow="$t('marketing.customers.faq.eyebrow')"
      :title="$t('marketing.customers.faq.title')"
    >
      <MarketingFaq
        prefix="marketing.customers.faq.items"
        :keys="faqKeys"
      />
    </MarketingSection>

    <!-- Polecenie warsztatowi -->
    <MarketingSection tone="muted">
      <div
        v-reveal
        class="grid items-center gap-6 lg:grid-cols-[1.4fr_1fr]"
      >
        <div class="space-y-3">
          <p class="mk-eyebrow">
            {{ $t('marketing.customers.refer.eyebrow') }}
          </p>
          <h2 class="mk-h2">
            {{ $t('marketing.customers.refer.title') }}
          </h2>
          <p class="mk-lead">
            {{ $t('marketing.customers.refer.text') }}
          </p>
        </div>
        <div class="flex flex-wrap gap-3 lg:justify-end">
          <UButton
            size="xl"
            icon="i-lucide-copy"
            :label="$t('marketing.customers.refer.copy')"
            @click="copyLink"
          />
        </div>
      </div>
    </MarketingSection>

    <MarketingCta
      :title="$t('marketing.customers.cta.title')"
      :description="$t('marketing.customers.cta.description')"
      :primary="{ label: $t('marketing.customers.cta.primary'), to: '/dla-warsztatow' }"
    />
  </div>
</template>
