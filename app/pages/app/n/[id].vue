<script setup lang="ts">
/**
 * Otwarcie powiadomienia z push albo z e-maila: oznacza je jako przeczytane i przechodzi do jego miejsca
 * w aplikacji – także gdy dotyczy innego warsztatu tej samej osoby (przełączenie warsztatu).
 */
const route = useRoute()
const id = route.params.id as string
const failed = ref(false)

onMounted(async () => {
  try {
    const target = await $fetch(`/api/notifications/${id}/target`)
    if (target.switchOrganization) {
      await authClient.organization.setActive({ organizationId: target.orgId })
      reloadNuxtApp({ path: target.link })
      return
    }
    await navigateTo(target.link, { replace: true })
  }
  catch {
    failed.value = true
  }
})
</script>

<template>
  <UDashboardPanel id="notification-redirect">
    <template #header>
      <UDashboardNavbar :title="$t('notifications.title')" />
    </template>
    <template #body>
      <UEmpty
        v-if="failed"
        icon="i-lucide-bell-off"
        :title="$t('notifications.notFound')"
        :description="$t('notifications.notFoundHint')"
        :actions="[{ label: $t('notifications.showAll'), to: '/app/notifications', icon: 'i-lucide-list' }]"
      />
      <div
        v-else
        role="status"
        class="flex items-center gap-3 p-6 text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin"
        />
        {{ $t('notifications.redirecting') }}
      </div>
    </template>
  </UDashboardPanel>
</template>
