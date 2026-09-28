<script setup lang="ts">
import { z } from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ middleware: 'guest' })

const { t } = useI18n()
const route = useRoute()

const schema = computed(() => z.object({
  name: z.string().trim().min(2),
  email: z.email(),
  password: z.string().min(10, t('auth.passwordHint')),
}))
type Schema = z.output<typeof schema.value>

const fields = computed<AuthFormField[]>(() => [
  { name: 'name', type: 'text', label: t('common.name'), placeholder: 'Jan Kowalski', required: true },
  { name: 'email', type: 'email', label: t('common.email'), placeholder: 'jan@warsztat.pl', required: true },
  { name: 'password', type: 'password', label: t('common.password'), help: t('auth.passwordHint'), required: true },
])

const redirectTo = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/app'
})

const loading = ref(false)
const errorMessage = ref<string | null>(null)
const sentTo = ref<string | null>(null)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  errorMessage.value = null
  const { data, error } = await authClient.signUp.email({
    name: event.data.name,
    email: event.data.email,
    password: event.data.password,
    callbackURL: redirectTo.value,
  })
  loading.value = false
  if (error) {
    errorMessage.value = error.code?.startsWith('USER_ALREADY_EXISTS') ? t('auth.emailTaken') : (error.message || t('common.error'))
    return
  }
  if (data?.token) {
    reloadNuxtApp({ path: redirectTo.value })
    return
  }
  sentTo.value = event.data.email
}
</script>

<template>
  <UContainer class="py-16 flex justify-center">
    <UPageCard class="w-full max-w-md">
      <UEmpty
        v-if="sentTo"
        icon="i-lucide-mail-check"
        :title="$t('auth.checkInbox')"
        :description="$t('auth.checkInboxDescription', { email: sentTo })"
        :actions="[{ label: $t('common.login'), to: { path: '/login', query: route.query } }]"
      />
      <UAuthForm
        v-else
        :schema="schema"
        :fields="fields"
        :title="$t('auth.registerTitle')"
        :description="$t('auth.registerDescription')"
        icon="i-lucide-user-plus"
        :submit="{ label: $t('common.register'), block: true }"
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
        <template #footer>
          {{ $t('auth.haveAccount') }}
          <ULink
            :to="{ path: '/login', query: route.query }"
            class="text-primary font-medium"
          >{{ $t('common.login') }}</ULink>
        </template>
      </UAuthForm>
    </UPageCard>
  </UContainer>
</template>
