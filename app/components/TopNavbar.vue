<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// Górny pasek nawigacji (komputer ≥ 1024 px). Na telefonie i tablecie działa dolna nawigacja z layoutu.
// Zagęszczanie: < 1280 px same ikony, 1280–1535 px same etykiety, ≥ 1536 px ikony i etykiety.
defineProps<{ notifications?: boolean }>()

const route = useRoute()
const { t } = useI18n()
const { work, management } = useWorkshopNavigation()

function inside(path: unknown) {
  return route.path === path || route.path.startsWith(`${String(path)}/`)
}

// Sekcje zarządzania (cennik, zespół, ustawienia, dziennik) chowamy pod jedną pozycją, żeby pasek się mieścił
const items = computed<NavigationMenuItem[]>(() => [
  ...work.value,
  ...(management.value.length
    ? [{
        label: t('ui.organization'),
        icon: 'i-lucide-building-2',
        active: management.value.some(item => inside(item.to)),
        children: management.value.map(({ label, icon, to }) => ({ label, icon, to })),
      }]
    : []),
])
</script>

<template>
  <header class="napiko-topbar">
    <NapikoBrand class="shrink-0" />
    <div class="napiko-topbar-org">
      <OrgSwitcher />
    </div>
    <UNavigationMenu
      :items="items"
      orientation="horizontal"
      content-orientation="vertical"
      :aria-label="$t('ui.mainNavigation')"
      :ui="{ root: 'shrink-0', link: 'px-3 max-xl:px-3.5 gap-2 text-sm', linkLabel: 'max-xl:sr-only', linkLeadingIcon: 'xl:max-2xl:hidden' }"
    />
    <div class="ms-auto flex shrink-0 items-center gap-1">
      <NotificationBell v-if="notifications" />
      <UserMenu topbar />
    </div>
  </header>
</template>
