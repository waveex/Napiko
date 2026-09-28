<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{ collapsed?: boolean }>()

const { t } = useI18n()
const { data: me } = await useMe()

async function signOut() {
  await authClient.signOut()
  reloadNuxtApp({ path: '/' })
}

const items = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: me.value?.user.email ?? '' }],
  [{ label: t('common.logout'), icon: 'i-lucide-log-out', onSelect: signOut }],
])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'start', side: 'top' }"
    :ui="{ content: 'w-60' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      icon="i-lucide-circle-user"
      :label="collapsed ? undefined : me?.user.name"
      class="data-[state=open]:bg-elevated"
    />
  </UDropdownMenu>
</template>
