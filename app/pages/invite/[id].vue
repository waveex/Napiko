<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const route = useRoute()
const invitationId = computed(() => String(route.params.id))

const { data: invitation, status } = await useAsyncData(`invitation-${invitationId.value}`, async () => {
  const { data } = await authClient.organization.getInvitation({ query: { id: invitationId.value } })
  return data
}, { server: false })

const working = ref(false)
const rejected = ref(false)

async function accept() {
  working.value = true
  const { data, error } = await authClient.organization.acceptInvitation({ invitationId: invitationId.value })
  if (error || !data) {
    working.value = false
    useToast().add({ title: error?.message || t('common.error'), color: 'error' })
    return
  }
  await switchOrganization(data.invitation.organizationId, '/app')
}

async function reject() {
  working.value = true
  await authClient.organization.rejectInvitation({ invitationId: invitationId.value })
  working.value = false
  rejected.value = true
}
</script>

<template>
  <UContainer class="py-16 flex justify-center">
    <UPageCard
      class="w-full max-w-md"
      :title="$t('invite.title')"
      icon="i-lucide-mail-open"
    >
      <USkeleton
        v-if="status === 'pending'"
        class="h-16"
      />
      <UEmpty
        v-else-if="rejected"
        icon="i-lucide-circle-x"
        :title="$t('invite.rejected')"
        :actions="[{ label: $t('nav.dashboard'), to: '/app' }]"
      />
      <UEmpty
        v-else-if="!invitation"
        icon="i-lucide-circle-help"
        :description="$t('invite.notFound')"
        :actions="[{ label: $t('nav.dashboard'), to: '/app' }]"
      />
      <template v-else>
        <p>
          {{ $t('invite.description', {
            inviter: invitation.inviterEmail,
            organization: invitation.organizationName,
            role: $t(`roles.${invitation.role}`),
          }) }}
        </p>
        <div class="flex gap-2 mt-6">
          <UButton
            :loading="working"
            icon="i-lucide-check"
            :label="$t('invite.accept')"
            @click="accept"
          />
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="working"
            :label="$t('invite.reject')"
            @click="reject"
          />
        </div>
      </template>
    </UPageCard>
  </UContainer>
</template>
