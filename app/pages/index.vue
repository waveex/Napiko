<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => `Napiko – ${t('app.tagline')}`,
  description: () => t('landing.description'),
})

const features = computed(() => [
  { icon: 'i-lucide-clipboard-check', key: 'intake' },
  { icon: 'i-lucide-badge-check', key: 'approvals' },
  { icon: 'i-lucide-users', key: 'team' },
  { icon: 'i-lucide-history', key: 'history' },
].map(f => ({
  icon: f.icon,
  title: t(`landing.features.${f.key}.title`),
  description: t(`landing.features.${f.key}.description`),
})))
</script>

<template>
  <div>
    <UPageHero
      :title="$t('landing.title')"
      :description="$t('landing.description')"
      :links="[
        { label: $t('common.register'), to: '/register', trailingIcon: 'i-lucide-arrow-right', size: 'xl' },
        { label: $t('common.login'), to: '/login', color: 'neutral', variant: 'subtle', size: 'xl' },
      ]"
    />
    <UPageSection>
      <UPageGrid>
        <UPageCard
          v-for="feature in features"
          :key="feature.title"
          :icon="feature.icon"
          :title="feature.title"
          :description="feature.description"
        />
      </UPageGrid>
    </UPageSection>
  </div>
</template>
