<script setup lang="ts">
import { z } from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ middleware: 'guest' })

const { t } = useI18n()
const schema = z.object({ email: z.email() })
type Schema = z.output<typeof schema>

const fields = computed<AuthFormField[]>(() => [
  { name: 'email', type: 'email', label: t('common.email'), placeholder: 'jan@warsztat.pl', required: true },
])

const loading = ref(false)
const sent = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  await authClient.requestPasswordReset({ email: event.data.email, redirectTo: '/reset-password' })
  loading.value = false
  sent.value = true
}
</script>

<template>
  <UContainer class="py-16 flex justify-center">
    <UPageCard class="w-full max-w-md">
      <UEmpty
        v-if="sent"
        icon="i-lucide-mail-check"
        :title="$t('auth.checkInbox')"
        :description="$t('auth.forgotSent')"
        :actions="[{ label: $t('common.login'), to: '/login' }]"
      />
      <UAuthForm
        v-else
        :schema="schema"
        :fields="fields"
        :title="$t('auth.forgotTitle')"
        :description="$t('auth.forgotDescription')"
        icon="i-lucide-key-round"
        :submit="{ label: $t('auth.sendLink'), block: true }"
        :loading="loading"
        @submit="onSubmit"
      >
        <template #footer>
          <ULink
            to="/login"
            class="text-primary font-medium"
          >{{ $t('common.back') }}</ULink>
        </template>
      </UAuthForm>
    </UPageCard>
  </UContainer>
</template>
