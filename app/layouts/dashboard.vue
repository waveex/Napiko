<script setup lang="ts">
import { brandIcon } from '#shared/brand'

const { data: me } = await useMe()
const route = useRoute()
const { mobile, more } = useWorkshopNavigation()
const moreOpen = ref(false)
watch(() => route.fullPath, () => {
  moreOpen.value = false
})

function active(path: unknown) {
  return path === '/app' ? route.path === path : route.path === path || route.path.startsWith(`${String(path)}/`)
}

onMounted(() => {
  const first = me.value?.organizations[0]
  if (me.value && !me.value.activeOrganization && first) switchOrganization(first.id, route.fullPath)
})

// Powiadomienia: licznik w dzwonku (sprawdzany w tle) i service worker dla push
const hasOrganization = computed(() => !!me.value?.activeOrganization)
const notificationCenter = useNotificationCenter()
let stopPolling: (() => void) | undefined
onMounted(() => {
  if (hasOrganization.value) stopPolling = startNotificationPolling(notificationCenter)
  if (pushSupport() === 'supported') registerServiceWorker().catch(() => undefined)
})
onBeforeUnmount(() => stopPolling?.())

useHead({
  link: [
    { rel: 'manifest', href: '/manifest.webmanifest' },
    { rel: 'apple-touch-icon', href: brandIcon('apple-touch-icon') },
  ],
  meta: [
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-title', content: 'Napiko' },
  ],
})
</script>

<template>
  <UDashboardGroup class="napiko-dashboard flex-col">
    <TopNavbar :notifications="hasOrganization" />
    <slot />
    <NotificationBell
      v-if="hasOrganization"
      class="napiko-bell-mobile"
    />
    <NotificationsSlideover v-if="hasOrganization" />
    <nav
      class="napiko-bottom-nav"
      :aria-label="$t('ui.mainNavigation')"
    >
      <NuxtLink
        v-for="item in mobile"
        :key="String(item.to)"
        :to="item.to"
        class="napiko-bottom-item"
        :aria-current="active(item.to) ? 'page' : undefined"
      >
        <UIcon
          :name="item.icon!"
          class="size-6"
        /><span>{{ item.label }}</span>
      </NuxtLink>
      <button
        type="button"
        class="napiko-bottom-item"
        :aria-expanded="moreOpen"
        aria-controls="napiko-more-menu"
        :aria-current="more.some(item => active(item.to)) ? 'page' : undefined"
        @click="moreOpen = true"
      >
        <UIcon
          name="i-lucide-menu"
          class="size-6"
        /><span>{{ $t('ui.more') }}</span>
      </button>
    </nav>
    <UModal
      v-model:open="moreOpen"
      :title="$t('ui.more')"
      :description="me?.activeOrganization?.name"
    >
      <template #body>
        <div
          id="napiko-more-menu"
          class="space-y-6"
        >
          <UNavigationMenu
            :items="more"
            orientation="vertical"
          />
          <div class="border-t border-default pt-4">
            <OrgSwitcher />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span>{{ $t('theme.title') }}</span><ThemeSwitcher /><LocaleSwitcher />
          </div>
          <UserMenu />
        </div>
      </template>
      <template #footer>
        <UButton
          color="neutral"
          variant="outline"
          block
          icon="i-lucide-x"
          :label="$t('common.close')"
          @click="moreOpen = false"
        />
      </template>
    </UModal>
  </UDashboardGroup>
</template>
