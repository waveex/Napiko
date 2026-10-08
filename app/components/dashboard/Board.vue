<script setup lang="ts">
/**
 * Pulpit biura – tablica zleceń w skrócie: liczba zleceń w każdej kolumnie.
 * Jedna seria, więc jeden kolor słupków; status nazywa etykieta, a liczba stoi przy słupku.
 */
import { BOARD_STATUSES } from '#shared/workshop'
import type { DashboardOffice } from '~/composables/useDashboard'

const props = defineProps<{ board: DashboardOffice['board'] }>()

const total = computed(() => BOARD_STATUSES.reduce((sum, s) => sum + props.board[s], 0))
const max = computed(() => Math.max(1, ...BOARD_STATUSES.map(s => props.board[s])))
const width = (count: number) => (count ? `max(0.5rem, ${(count / max.value) * 100}%)` : '0')
</script>

<template>
  <article class="napiko-surface flex min-w-0 flex-col p-4">
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <h3 class="font-semibold">
        {{ $t('dashboard.board.title') }}
      </h3>
      <span class="text-sm text-muted">{{ $t('dashboard.board.total', { n: total }) }}</span>
    </header>
    <ul class="mt-3 space-y-1">
      <li
        v-for="status in BOARD_STATUSES"
        :key="status"
      >
        <NuxtLink
          to="/app/orders"
          class="-mx-2 grid min-h-11 grid-cols-[minmax(0,11rem)_minmax(0,1fr)_2.5rem] items-center gap-3 rounded-lg px-2 transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span class="min-w-0"><StatusBadge
            kind="order"
            :status="status"
            class="max-w-full"
          /></span>
          <span
            class="block h-2"
            aria-hidden="true"
          ><span
            class="block h-2 rounded-e bg-primary"
            :style="{ width: width(board[status]) }"
          /></span>
          <span class="text-end font-semibold tabular-nums">{{ board[status] }}</span>
        </NuxtLink>
      </li>
    </ul>
  </article>
</template>
