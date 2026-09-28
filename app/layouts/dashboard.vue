<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = useI18n()
const { data: me } = await useMe()

// Po zalogowaniu sesja nie ma jeszcze aktywnej organizacji – wybieramy pierwszą z listy.
onMounted(() => {
  const first = me.value?.organizations[0]
  if (me.value && !me.value.activeOrganization && first) {
    switchOrganization(first.id, useRoute().fullPath)
  }
})

const items = computed<NavigationMenuItem[]>(() => {
  const org = me.value?.activeOrganization
  const links: NavigationMenuItem[] = [{ label: t('nav.dashboard'), icon: 'i-lucide-layout-dashboard', to: '/app', exact: true }]
  if (org) {
    if (org.can.workOnTasks) links.push({ label: t('nav.myTasks'), icon: 'i-lucide-wrench', to: '/app/my-tasks' })
    if (org.can.readOrders) links.push({ label: t('nav.orders'), icon: 'i-lucide-kanban', to: '/app/orders' })
    if (org.can.quoteRequests) links.push({ label: t('nav.requests'), icon: 'i-lucide-message-square-warning', to: '/app/requests' })
    if (org.can.readCustomers) links.push({ label: t('nav.customers'), icon: 'i-lucide-contact', to: '/app/customers' })
    if (org.can.readBilling) links.push({ label: t('nav.priceList'), icon: 'i-lucide-tags', to: '/app/price-list' })
    links.push(
      { label: t('nav.team'), icon: 'i-lucide-users', to: '/app/team' },
      { label: t('nav.settings'), icon: 'i-lucide-settings', to: '/app/settings' },
    )
    if (org.can.readAudit) links.push({ label: t('nav.audit'), icon: 'i-lucide-scroll-text', to: '/app/audit' })
  }
  return links
})
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar
      collapsible
      resizable
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <OrgSwitcher :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="items"
          orientation="vertical"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
