<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { ORG_ROLES, parseRoles } from '#shared/permissions'

const { t, d } = useI18n()
const toast = useToast()
const { data: me } = await useMe()

const canInvite = computed(() => !!me.value?.activeOrganization?.can.inviteMembers)

const { data: org, refresh } = await useAsyncData('full-organization', async () => {
  const { data } = await authClient.organization.getFullOrganization()
  return data
}, { server: false })

const members = computed(() => org.value?.members ?? [])
const invitations = computed(() => (org.value?.invitations ?? []).filter(i => i.status === 'pending'))

function roleLabel(role: string | null | undefined) {
  return parseRoles(role).map(r => t(`roles.${r}`)).join(', ') || role || ''
}

const roleItems = computed(() => ORG_ROLES.filter(r => r !== 'owner').map(value => ({ value, label: t(`roles.${value}`) })))

const schema = z.object({
  email: z.email(),
  role: z.enum(['office', 'mechanic']),
})
type Schema = z.output<typeof schema>
const state = reactive<Schema>({ email: '', role: 'mechanic' })
const inviting = ref(false)

async function onInvite(event: FormSubmitEvent<Schema>) {
  inviting.value = true
  const { error } = await authClient.organization.inviteMember({ email: event.data.email, role: event.data.role })
  inviting.value = false
  if (error) {
    toast.add({ title: error.message || t('common.error'), color: 'error' })
    return
  }
  toast.add({ title: t('team.invited', { email: event.data.email }), color: 'success', icon: 'i-lucide-send' })
  state.email = ''
  await refresh()
}

async function cancelInvitation(invitationId: string) {
  await authClient.organization.cancelInvitation({ invitationId })
  await refresh()
}
</script>

<template>
  <UDashboardPanel id="team">
    <template #header>
      <UDashboardNavbar :title="$t('team.title')" />
    </template>

    <template #body>
      <div class="max-w-3xl space-y-6">
        <UPageCard
          v-if="canInvite"
          :title="$t('team.inviteTitle')"
        >
          <UForm
            :schema="schema"
            :state="state"
            class="flex flex-col sm:flex-row gap-3 sm:items-start"
            @submit="onInvite"
          >
            <UFormField
              name="email"
              class="flex-1"
            >
              <UInput
                v-model="state.email"
                type="email"
                :placeholder="$t('common.email')"
                class="w-full"
              />
            </UFormField>
            <UFormField name="role">
              <USelect
                v-model="state.role"
                :items="roleItems"
                class="w-40"
              />
            </UFormField>
            <UButton
              type="submit"
              icon="i-lucide-send"
              :loading="inviting"
              :label="$t('team.invite')"
            />
          </UForm>
        </UPageCard>

        <UPageCard :title="$t('team.members')">
          <ul class="divide-y divide-default">
            <li
              v-for="m in members"
              :key="m.id"
              class="py-3 flex items-center justify-between gap-4"
            >
              <UUser
                :name="m.user.name + (m.userId === me?.user.id ? ` (${$t('team.you')})` : '')"
                :description="m.user.email"
                :avatar="{ icon: 'i-lucide-user' }"
              />
              <UBadge
                variant="subtle"
                :label="roleLabel(m.role)"
              />
            </li>
          </ul>
        </UPageCard>

        <UPageCard :title="$t('team.invitations')">
          <p
            v-if="!invitations.length"
            class="text-sm text-muted"
          >
            {{ $t('team.noInvitations') }}
          </p>
          <ul
            v-else
            class="divide-y divide-default"
          >
            <li
              v-for="i in invitations"
              :key="i.id"
              class="py-3 flex items-center justify-between gap-4"
            >
              <div>
                <p class="font-medium">
                  {{ i.email }}
                </p>
                <p class="text-sm text-muted">
                  {{ roleLabel(i.role) }} · {{ $t('team.expires') }} {{ d(new Date(i.expiresAt), 'short') }}
                </p>
              </div>
              <UButton
                v-if="canInvite"
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                :label="$t('team.cancelInvite')"
                @click="cancelInvitation(i.id)"
              />
            </li>
          </ul>
        </UPageCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
