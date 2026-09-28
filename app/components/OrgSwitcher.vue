<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{ collapsed?: boolean }>()

const { t } = useI18n()
const { data: me } = await useMe()

const active = computed(() => me.value?.activeOrganization ?? null)

const items = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: t('nav.organizations') }],
  (me.value?.organizations ?? []).map(org => ({
    label: org.name,
    icon: org.kind === 'solo' ? 'i-lucide-user-cog' : 'i-lucide-warehouse',
    type: 'checkbox' as const,
    checked: org.id === active.value?.id,
    onSelect: () => {
      if (org.id !== active.value?.id) switchOrganization(org.id)
    },
  })),
  [{ label: t('nav.newOrganization'), icon: 'i-lucide-plus', to: '/app/organizations/new' }],
])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'start' }"
    :ui="{ content: 'w-64' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      :icon="active?.kind === 'solo' ? 'i-lucide-user-cog' : 'i-lucide-warehouse'"
      :label="collapsed ? undefined : (active?.name ?? t('nav.noOrganization'))"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
      class="data-[state=open]:bg-elevated"
      :ui="{ trailingIcon: 'text-dimmed ms-auto' }"
    />
  </UDropdownMenu>
</template>
