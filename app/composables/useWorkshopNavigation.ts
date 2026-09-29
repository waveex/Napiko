import type { NavigationMenuItem } from '@nuxt/ui'

export function useWorkshopNavigation() {
  const { t } = useI18n()
  const { data: me } = useMe()
  const org = computed(() => me.value?.activeOrganization)
  const work = computed<NavigationMenuItem[]>(() => {
    const can = org.value?.can
    return [
      { label: t('nav.dashboard'), icon: 'i-lucide-layout-dashboard', to: '/app', exact: true },
      ...(can?.workOnTasks ? [{ label: t('nav.myTasks'), icon: 'i-lucide-wrench', to: '/app/my-tasks' }] : []),
      ...(can?.readOrders ? [{ label: t('nav.orders'), icon: 'i-lucide-clipboard-list', to: '/app/orders' }] : []),
      ...(can?.quoteRequests ? [{ label: t('ui.requests'), icon: 'i-lucide-message-square-warning', to: '/app/requests' }] : []),
      ...(can?.readCustomers ? [{ label: t('nav.customers'), icon: 'i-lucide-contact', to: '/app/customers' }] : []),
    ]
  })
  const management = computed<NavigationMenuItem[]>(() => org.value
    ? [
        ...(org.value.can.readBilling ? [{ label: t('nav.priceList'), icon: 'i-lucide-tags', to: '/app/price-list' }] : []),
        { label: t('nav.team'), icon: 'i-lucide-users', to: '/app/team' },
        { label: t('nav.settings'), icon: 'i-lucide-settings', to: '/app/settings' },
        ...(org.value.can.readAudit ? [{ label: t('nav.audit'), icon: 'i-lucide-scroll-text', to: '/app/audit' }] : []),
      ]
    : [])
  const mobile = computed(() => {
    const mechanic = org.value?.can.workOnTasks && !org.value.can.createOrders
    const paths = mechanic ? ['/app', '/app/my-tasks', '/app/orders'] : ['/app', '/app/orders', '/app/requests', '/app/customers']
    return work.value.filter(item => paths.includes(String(item.to))).map(item => ({
      ...item, label: item.to === '/app/my-tasks' ? t('ui.tasks') : item.label,
    }))
  })
  const more = computed(() => [...work.value.filter(item => !mobile.value.some(link => link.to === item.to)), ...management.value])
  return { org, work, management, mobile, more }
}
