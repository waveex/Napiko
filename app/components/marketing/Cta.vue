<script setup lang="ts">
/** Zamykający pas z wezwaniem do działania (tło w kolorze marki). */
defineProps<{
  title: string
  description?: string
  primary?: { label: string, to: string }
  secondary?: { label: string, to: string }
}>()
</script>

<template>
  <section class="mk-cta">
    <UContainer>
      <div
        v-reveal
        class="mk-cta-box"
      >
        <div class="space-y-3">
          <h2 class="mk-h2 mk-cta-title">
            {{ title }}
          </h2>
          <p
            v-if="description"
            class="mk-cta-text"
          >
            {{ description }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            v-if="primary"
            :to="primary.to"
            size="xl"
            color="neutral"
            variant="solid"
            class="mk-cta-primary"
            trailing-icon="i-lucide-arrow-right"
            :label="primary.label"
          />
          <UButton
            v-if="secondary"
            :to="secondary.to"
            size="xl"
            color="neutral"
            variant="outline"
            class="mk-cta-secondary"
            :label="secondary.label"
          />
          <slot />
        </div>
      </div>
    </UContainer>
  </section>
</template>
