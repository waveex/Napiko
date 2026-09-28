<script setup lang="ts">
import { z } from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

const { t } = useI18n()
const route = useRoute()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const invalid = computed(() => !token.value || typeof route.query.error === 'string')

const schema = computed(() => z.object({ password: z.string().min(10, t('auth.passwordHint')) }))
type Schema = z.output<typeof schema.value>

const fields = computed<AuthFormField[]>(() => [
  { name: 'password', type: 'password', label: t('auth.newPassword'), help: t('auth.passwordHint'), required: true },
])

const loading = ref(false)
const done = ref(false)
const errorMessage = ref<string | null>(null)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  const { error } = await authClient.resetPassword({ newPassword: event.data.password, token: token.value })
  loading.value = false
  if (error) {
    errorMessage.value = t('auth.resetInvalid')
    return
  }
  done.value = true
}
</script>

<template>
  <UContainer class="py-16 flex justify-center">
    <UPageCard class="w-full max-w-md">
      <UEmpty
        v-if="done || invalid"
        :icon="done ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
        :title="done ? $t('auth.resetDone') : $t('auth.resetInvalid')"
        :actions="[done ? { label: $t('common.login'), to: '/login' } : { label: $t('auth.sendLink'), to: '/forgot-password' }]"
      />
      <UAuthForm
        v-else
        :schema="schema"
        :fields="fields"
        :title="$t('auth.resetTitle')"
        icon="i-lucide-key-round"
        :submit="{ label: $t('common.save'), block: true }"
        :loading="loading"
        @submit="onSubmit"
      >
        <template #validation>
          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="errorMessage"
          />
        </template>
      </UAuthForm>
    </UPageCard>
  </UContainer>
</template>
