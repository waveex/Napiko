<script setup lang="ts">
/**
 * Pulpit właściciela i biura – kroki potrzebne do pracy z klientami (znika, gdy wszystko gotowe albo po ukryciu).
 * Na telefonie widać tylko kroki do zrobienia; postęp pokazuje pasek.
 */
import type { DashboardSetup } from '~/composables/useDashboard'

defineProps<{ setup: DashboardSetup }>()
const emit = defineEmits<{ hide: [] }>()

const links: Record<string, string> = {
  company: '/app/settings',
  laborRate: '/app/settings',
  priceList: '/app/price-list',
  team: '/app/team',
  firstOrder: '/app/orders/new',
}
</script>

<template>
  <section class="napiko-surface p-4 sm:p-5">
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold">
          {{ $t('dashboard.setup.title') }}
        </h2>
        <p class="text-sm text-muted">
          {{ $t('dashboard.setup.description') }}
        </p>
      </div>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        :aria-label="$t('dashboard.setup.hide')"
        :title="$t('dashboard.setup.hide')"
        @click="emit('hide')"
      />
    </header>
    <div class="mt-3 flex items-center gap-3">
      <UProgress
        :model-value="setup.completed"
        :max="setup.total"
        size="sm"
        class="flex-1"
        :aria-label="$t('dashboard.setup.progress', { done: setup.completed, total: setup.total })"
      />
      <span class="shrink-0 text-sm font-medium">{{ $t('dashboard.setup.progress', { done: setup.completed, total: setup.total }) }}</span>
    </div>
    <ul class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <li
        v-for="step in setup.steps"
        :key="step.key"
        :class="{ 'max-sm:hidden': step.done }"
      >
        <div
          v-if="step.done"
          class="flex min-h-12 items-center gap-3 rounded-xl bg-elevated px-3 py-2 text-muted"
        >
          <UIcon
            name="i-lucide-circle-check"
            class="size-5 shrink-0 text-success"
          />
          <span class="min-w-0 flex-1">{{ $t(`dashboard.setup.steps.${step.key}`) }}</span>
          <span class="sr-only">{{ $t('dashboard.setup.done') }}</span>
        </div>
        <NuxtLink
          v-else
          :to="links[step.key]"
          class="flex min-h-12 items-center gap-3 rounded-xl border border-default px-3 py-2 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          <UIcon
            name="i-lucide-circle-dashed"
            class="size-5 shrink-0 text-muted"
          />
          <span class="min-w-0 flex-1 font-medium">{{ $t(`dashboard.setup.steps.${step.key}`) }}</span>
          <UIcon
            name="i-lucide-arrow-right"
            class="size-4 shrink-0 text-muted"
          />
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
