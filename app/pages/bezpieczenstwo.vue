<script setup lang="ts">
/** Bezpieczeństwo i zaufanie: co działa dziś, co jest w przygotowaniu (bez deklaracji, których aplikacja jeszcze nie spełnia). */
definePageMeta({ layout: 'marketing', alias: ['/security'] })

const { t } = useI18n()
useSeoMeta({
  title: () => t('marketing.security.seo.title'),
  description: () => t('marketing.security.seo.description'),
  ogTitle: () => t('marketing.security.seo.title'),
  ogDescription: () => t('marketing.security.seo.description'),
  ogType: 'website',
})

const cards = [
  { key: 'isolation', icon: 'i-lucide-database-zap' },
  { key: 'integrity', icon: 'i-lucide-link-2' },
  { key: 'audit', icon: 'i-lucide-scroll-text' },
  { key: 'minimal', icon: 'i-lucide-eye-off' },
  { key: 'links', icon: 'i-lucide-key-round' },
  { key: 'queue', icon: 'i-lucide-bell-ring' },
] as const
const proofRows = ['content', 'decision', 'context', 'audit'] as const
const plan = ['gdpr', 'hosting', 'access', 'data'] as const
const faqKeys = ['other', 'where', 'legal', 'gdpr', 'mechanic'] as const
</script>

<template>
  <div>
    <section class="mk-hero">
      <UContainer>
        <div class="max-w-4xl space-y-6">
          <p class="mk-eyebrow mk-rise">
            {{ $t('marketing.security.hero.eyebrow') }}
          </p>
          <h1
            class="mk-h1 mk-rise"
            style="--mk-delay: 80ms"
          >
            {{ $t('marketing.security.hero.title') }}
          </h1>
          <p
            class="mk-lead mk-rise"
            style="--mk-delay: 160ms"
          >
            {{ $t('marketing.security.hero.lead') }}
          </p>
        </div>
      </UContainer>
    </section>

    <MarketingSection
      tone="muted"
      :eyebrow="$t('marketing.security.cards.eyebrow')"
      :title="$t('marketing.security.cards.title')"
    >
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="(card, i) in cards"
          :key="card.key"
          v-reveal="{ delay: (i % 3) * 90 }"
          class="mk-card space-y-3"
        >
          <span class="mk-icon"><UIcon
            :name="card.icon"
            class="size-6"
          /></span>
          <h3>{{ $t(`marketing.security.cards.items.${card.key}.title`) }}</h3>
          <p>{{ $t(`marketing.security.cards.items.${card.key}.text`) }}</p>
        </article>
      </div>
    </MarketingSection>

    <MarketingSection
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

    <MarketingSection
      tone="muted"
      :eyebrow="$t('marketing.security.plan.eyebrow')"
      :title="$t('marketing.security.plan.title')"
      :description="$t('marketing.security.plan.description')"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <article
          v-for="(item, i) in plan"
          :key="item"
          v-reveal="{ delay: (i % 2) * 90 }"
          class="mk-card space-y-2"
        >
          <span class="mk-soon">
            <UIcon
              name="i-lucide-clock"
              class="size-4"
            />
            {{ $t('marketing.security.plan.label') }}
          </span>
          <h3>{{ $t(`marketing.security.plan.items.${item}.title`) }}</h3>
          <p>{{ $t(`marketing.security.plan.items.${item}.text`) }}</p>
        </article>
      </div>
    </MarketingSection>

    <MarketingSection
      :eyebrow="$t('marketing.security.faq.eyebrow')"
      :title="$t('marketing.security.faq.title')"
    >
      <MarketingFaq
        prefix="marketing.security.faq.items"
        :keys="faqKeys"
      />
    </MarketingSection>

    <MarketingCta
      :title="$t('marketing.security.cta.title')"
      :description="$t('marketing.security.cta.description')"
      :primary="{ label: $t('marketing.security.cta.primary'), to: '/dla-warsztatow#przebieg' }"
      :secondary="{ label: $t('marketing.security.cta.secondary'), to: '/register' }"
    />
  </div>
</template>
