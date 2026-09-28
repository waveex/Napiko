<script setup lang="ts">
const { data: me } = await useMe()
const route = useRoute()
const { work, management, mobile, more } = useWorkshopNavigation()
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
</script>

<template>
  <UDashboardGroup class="oxy-dashboard">
    <UDashboardSidebar
      :collapsible="false"
      :resizable="false"
      :ui="{ root: 'bg-default', header: 'h-auto flex-col items-stretch gap-5 py-6', footer: 'border-t border-default flex-col items-stretch gap-3 p-4' }"
    >
      <template #header>
        <OxyBrand class="px-3" />
        <OrgSwitcher />
      </template>
      <template #default>
        <p class="px-3 pb-2 text-xs font-semibold uppercase tracking-widest text-muted">
          {{ $t('ui.work') }}
        </p>
        <UNavigationMenu
          :items="work"
          orientation="vertical"
        />
        <template v-if="management.length">
          <p class="px-3 pb-2 pt-8 text-xs font-semibold uppercase tracking-widest text-muted">
            {{ $t('ui.organization') }}
          </p>
          <UNavigationMenu
            :items="management"
            orientation="vertical"
          />
        </template>
      </template>
      <template #footer>
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm text-muted">{{ $t('theme.title') }}</span><ThemeSwitcher />
        </div>
        <UserMenu />
      </template>
    </UDashboardSidebar>
    <slot />
    <nav
      class="oxy-bottom-nav"
      :aria-label="$t('ui.mainNavigation')"
    >
      <NuxtLink
        v-for="item in mobile"
        :key="String(item.to)"
        :to="item.to"
        class="oxy-bottom-item"
        :aria-current="active(item.to) ? 'page' : undefined"
      >
        <UIcon
          :name="item.icon!"
          class="size-6"
        /><span>{{ item.label }}</span>
      </NuxtLink>
      <button
        type="button"
        class="oxy-bottom-item"
        :aria-expanded="moreOpen"
        aria-controls="oxy-more-menu"
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
          id="oxy-more-menu"
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
