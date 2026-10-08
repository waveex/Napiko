<script setup lang="ts">
/**
 * Strona dla warsztatów (organizacji): hero, animowany przebieg jednej naprawy sterowany przewijaniem,
 * role, rodzaje pojazdów, dowód zgody, start, plan rozwoju i pytania.
 */
import { VEHICLE_TYPE_INFO, VEHICLE_TYPES } from '#shared/workshop'
import { WORKSHOP_STORY, WORKSHOP_STORY_ACTORS } from '~/utils/marketing-story'
import type { StoryStepView } from '~/components/marketing/ScrollStory.vue'

definePageMeta({ layout: 'marketing', alias: ['/for-workshops'] })

const { t, te } = useI18n()
useSeoMeta({
  title: () => t('marketing.workshops.seo.title'),
  description: () => t('marketing.workshops.seo.description'),
  ogTitle: () => t('marketing.workshops.seo.title'),
  ogDescription: () => t('marketing.workshops.seo.description'),
  ogType: 'website',
})

const steps = computed<StoryStepView[]>(() => WORKSHOP_STORY.map((step) => {
  const base = `marketing.workshops.story.steps.${step.key}`
  return {
    ...step,
    tag: t(`${base}.tag`),
    title: t(`${base}.title`),
    text: t(`${base}.text`),
    proof: te(`${base}.proof`) ? t(`${base}.proof`) : undefined,
  }
}))

const chips = [
  { key: 'mechanic', icon: 'i-lucide-smartphone' },
  { key: 'office', icon: 'i-lucide-monitor' },
  { key: 'customer', icon: 'i-lucide-link' },
] as const
const roles = [
  { key: 'mechanic', icon: 'i-lucide-wrench', points: ['tasks', 'photos', 'hidden'] },
  { key: 'office', icon: 'i-lucide-headset', points: ['intake', 'approvals', 'attention'] },
  { key: 'owner', icon: 'i-lucide-chart-column', points: ['all', 'results', 'team'] },
] as const
const proofRows = ['content', 'decision', 'context', 'audit'] as const
const setup = ['account', 'company', 'prices', 'team', 'first'] as const
const roadmap = ['protocol', 'inspection', 'invoices', 'hub'] as const
const faqKeys = ['install', 'writing', 'invoices', 'program', 'sms', 'noreply', 'legal', 'offline', 'price'] as const
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="mk-hero">
      <UContainer>
        <div class="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
          <div class="space-y-6">
            <p class="mk-eyebrow mk-rise">
              {{ $t('marketing.workshops.hero.eyebrow') }}
            </p>
            <h1
              class="mk-h1 mk-rise"
              style="--mk-delay: 80ms"
            >
              {{ $t('marketing.workshops.hero.title') }}
            </h1>
            <p
              class="mk-lead mk-rise"
              style="--mk-delay: 160ms"
            >
              {{ $t('marketing.workshops.hero.lead') }}
            </p>
            <div
              class="flex flex-wrap gap-3 mk-rise"
              style="--mk-delay: 240ms"
            >
              <UButton
                to="/register"
                size="xl"
                trailing-icon="i-lucide-arrow-right"
                :label="$t('marketing.workshops.hero.primary')"
              />
              <UButton
                to="#przebieg"
                size="xl"
                color="neutral"
                variant="subtle"
                trailing-icon="i-lucide-arrow-down"
                :label="$t('marketing.workshops.hero.secondary')"
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
                  {{ $t(`marketing.workshops.hero.chips.${chip.key}`) }}
                </span>
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

    <!-- Animowany przebieg naprawy -->
    <MarketingScrollStory
      id="przebieg"
      :steps="steps"
      :actors="WORKSHOP_STORY_ACTORS"
      actor-labels="marketing.workshops.story.actors"
      :label="$t('marketing.workshops.story.label')"
      :note="$t('marketing.workshops.story.note')"
    >
      <template #intro>
        <div class="story-intro">
          <p class="mk-eyebrow">
            {{ $t('marketing.workshops.story.eyebrow') }}
          </p>
          <h2 class="mk-h2 story-title">
            {{ $t('marketing.workshops.story.title') }}
          </h2>
        </div>
      </template>
      <template #stage="{ index, local }">
        <MarketingStoryWorkshop
          :index="index"
          :local="local"
        />
      </template>
    </MarketingScrollStory>

    <!-- Role -->
    <MarketingSection
      tone="muted"
      :eyebrow="$t('marketing.workshops.roles.eyebrow')"
      :title="$t('marketing.workshops.roles.title')"
      :description="$t('marketing.workshops.roles.description')"
    >
      <div class="grid gap-4 md:grid-cols-3">
        <article
          v-for="(role, i) in roles"
          :key="role.key"
          v-reveal="{ delay: i * 90 }"
          class="mk-card space-y-4"
        >
          <span class="mk-icon"><UIcon
            :name="role.icon"
            class="size-6"
          /></span>
          <h3>{{ $t(`marketing.workshops.roles.items.${role.key}.title`) }}</h3>
          <ul class="mk-tick-list">
            <li
              v-for="point in role.points"
              :key="point"
            >
              <UIcon
                name="i-lucide-check"
                class="size-4"
              />
              <span>{{ $t(`marketing.workshops.roles.items.${role.key}.points.${point}`) }}</span>
            </li>
          </ul>
        </article>
      </div>
      <p
        v-reveal
        class="mt-6 flex items-start gap-3 text-muted"
      >
        <UIcon
          name="i-lucide-arrow-left-right"
          class="mt-1 size-5 shrink-0 text-primary"
        />
        <span>{{ $t('marketing.workshops.roles.solo') }}</span>
      </p>
    </MarketingSection>

    <!-- Pojazdy -->
    <MarketingSection
      :eyebrow="$t('marketing.workshops.vehicles.eyebrow')"
      :title="$t('marketing.workshops.vehicles.title')"
      :description="$t('marketing.workshops.vehicles.description')"
    >
      <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <li
          v-for="(type, i) in VEHICLE_TYPES"
          :key="type"
          v-reveal="{ delay: (i % 8) * 40 }"
          class="mk-vehicle"
        >
          <UIcon
            :name="VEHICLE_TYPE_INFO[type].icon"
            class="size-5"
          />
          {{ $t(`vehicleType.${type}`) }}
        </li>
      </ul>
    </MarketingSection>

    <!-- Dowód zgody -->
    <MarketingSection
      tone="muted"
      :eyebrow="$t('marketing.shared.proof.eyebrow')"
      :title="$t('marketing.shared.proof.title')"
      :description="$t('marketing.shared.proof.description')"
    >
      <table
        v-reveal
        class="mk-proof-table"
      >
        <tbody>
          <tr
            v-for="row in proofRows"
            :key="row"
          >
            <th scope="row">
              {{ $t(`marketing.shared.proof.rows.${row}.title`) }}
            </th>
            <td>{{ $t(`marketing.shared.proof.rows.${row}.text`) }}</td>
          </tr>
        </tbody>
      </table>
      <p class="mt-4 flex items-start gap-3 text-sm text-muted">
        <UIcon
          name="i-lucide-scale"
          class="mt-0.5 size-4 shrink-0"
        />
        <span>{{ $t('marketing.shared.proof.legal') }}</span>
      </p>
    </MarketingSection>

    <!-- Start -->
    <MarketingSection
      :eyebrow="$t('marketing.workshops.setup.eyebrow')"
      :title="$t('marketing.workshops.setup.title')"
      :description="$t('marketing.workshops.setup.description')"
    >
      <ol class="grid gap-4 md:grid-cols-5">
        <li
          v-for="(step, i) in setup"
          :key="step"
          v-reveal="{ delay: i * 80 }"
          class="mk-card space-y-2"
        >
          <span class="grid size-9 place-items-center rounded-full bg-primary text-sm font-bold text-inverted">{{ i + 1 }}</span>
          <h3 class="mk-h3-sm">
            {{ $t(`marketing.workshops.setup.steps.${step}.title`) }}
          </h3>
          <p class="text-sm">
            {{ $t(`marketing.workshops.setup.steps.${step}.text`) }}
          </p>
        </li>
      </ol>
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

    <!-- FAQ -->
    <MarketingSection
      :eyebrow="$t('marketing.workshops.faq.eyebrow')"
      :title="$t('marketing.workshops.faq.title')"
    >
      <MarketingFaq
        prefix="marketing.workshops.faq.items"
        :keys="faqKeys"
      />
    </MarketingSection>

    <MarketingCta
      :title="$t('marketing.workshops.cta.title')"
      :description="$t('marketing.workshops.cta.description')"
      :primary="{ label: $t('marketing.workshops.cta.primary'), to: '/register' }"
      :secondary="{ label: $t('marketing.workshops.cta.secondary'), to: '/dla-klientow' }"
    />
  </div>
</template>
