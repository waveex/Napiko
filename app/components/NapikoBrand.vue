<script setup lang="ts">
import { BRAND_LOGO_SIZE, brandLogoFiles, type BrandVariant } from '#shared/brand'

/**
 * Znak i napis NAPIKO (SVG z public/brand/). Wariant wynika z kontekstu strony (themeContext), a jasność przełącza CSS
 * (dwa obrazy), więc HTML z serwera nie zależy od trybu i nie ma migotania ani rozjazdu hydratacji.
 * Cel linku: warsztat → pulpit, klient → strona publiczna (klient nie ma konta, pulpit wymagałby logowania).
 */
const props = withDefaults(defineProps<{ variant?: BrandVariant, to?: string }>(), { variant: 'full', to: undefined })

const route = useRoute()
const context = computed(() => resolveThemeContext(route.meta.themeContext))
const files = computed(() => brandLogoFiles(props.variant, context.value))
const link = computed(() => props.to ?? (context.value === 'customer' ? '/' : '/app'))
const size = computed(() => BRAND_LOGO_SIZE[props.variant])
</script>

<template>
  <NuxtLink
    :to="link"
    class="napiko-brand"
    aria-label="Napiko"
  >
    <img
      v-for="tone in (['light', 'dark'] as const)"
      :key="tone"
      class="napiko-logo"
      :data-tone="tone"
      :data-variant="variant"
      :src="files[tone]"
      alt=""
      :width="size.width"
      :height="size.height"
    >
  </NuxtLink>
</template>
