<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// topbar: przycisk w górnym pasku – menu otwiera się w dół, a wybór wyglądu jest w menu (nie ma go na pasku)
const props = defineProps<{ collapsed?: boolean, topbar?: boolean }>()

const { t } = useI18n()
const { data: me } = await useMe()
const colorMode = useColorMode()

async function signOut() {
  // Powiadomienia push na tym urządzeniu należą do wylogowanej osoby – wyłączamy je (wspólne telefony w warsztacie)
  await disableTeamPushOnThisDevice()
  await authClient.signOut()
  reloadNuxtApp({ path: '/' })
}

const themeItems = computed<DropdownMenuItem[]>(() => [
  { value: 'light', icon: 'i-lucide-sun' },
  { value: 'dark', icon: 'i-lucide-moon' },
  { value: 'system', icon: 'i-lucide-monitor' },
].map(({ value, icon }) => ({
  label: t(`theme.${value}`),
  icon,
  type: 'checkbox' as const,
  checked: colorMode.preference === value,
  onSelect: (event: Event) => {
    event.preventDefault()
    colorMode.preference = value
  },
})))

const items = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: me.value?.user.email ?? '' }],
  ...(props.topbar ? [[{ type: 'label' as const, label: t('theme.title') }, ...themeItems.value]] : []),
  [{ label: t('notifications.settings'), icon: 'i-lucide-bell-ring', to: '/app/notifications?tab=settings' }],
  [{ label: t('common.logout'), icon: 'i-lucide-log-out', onSelect: signOut }],
])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="topbar ? { align: 'end', side: 'bottom' } : { align: 'start', side: 'top' }"
    :ui="{ content: 'w-60' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      :block="!topbar"
      :square="collapsed"
      icon="i-lucide-circle-user"
      :label="collapsed ? undefined : me?.user.name"
      :aria-label="topbar ? me?.user.name : undefined"
      class="data-[state=open]:bg-elevated"
      :ui="topbar ? { label: 'max-w-40 truncate max-2xl:sr-only' } : undefined"
    />
  </UDropdownMenu>
</template>
