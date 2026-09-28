<script setup lang="ts">
import { z } from 'zod'
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ middleware: 'guest' })

const { t } = useI18n()
const route = useRoute()
const toast = useToast()

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
})
type Schema = z.output<typeof schema>

const fields = computed<AuthFormField[]>(() => [
  { name: 'email', type: 'email', label: t('common.email'), placeholder: 'jan@warsztat.pl', required: true },
  { name: 'password', type: 'password', label: t('common.password'), required: true },
])

const redirectTo = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/app'
})

const loading = ref(false)
const errorMessage = ref<string | null>(null)
const unverifiedEmail = ref<string | null>(null)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  errorMessage.value = null
  unverifiedEmail.value = null
  const { error } = await authClient.signIn.email({ email: event.data.email, password: event.data.password })
  loading.value = false
  if (error) {
    if (error.status === 403) {
      unverifiedEmail.value = event.data.email
      return
    }
    errorMessage.value = error.status === 401 ? t('auth.invalidCredentials') : (error.message || t('common.error'))
    return
  }
  // Pełne przeładowanie: sesja trafia do renderowania po stronie serwera.
  reloadNuxtApp({ path: redirectTo.value })
}

async function resendVerification() {
  if (!unverifiedEmail.value) return
  await authClient.sendVerificationEmail({ email: unverifiedEmail.value, callbackURL: redirectTo.value })
  toast.add({ title: t('auth.resent'), color: 'success', icon: 'i-lucide-mail-check' })
}
</script>

<template>
  <UContainer class="py-16 flex justify-center">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        :schema="schema"
        :fields="fields"
        :title="$t('auth.loginTitle')"
        :description="$t('auth.loginDescription')"
        icon="i-lucide-lock"
        :submit="{ label: $t('common.login'), block: true }"
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
          <UAlert
            v-if="unverifiedEmail"
            color="warning"
            variant="subtle"
            icon="i-lucide-mail-warning"
            :title="$t('auth.emailNotVerified')"
            :actions="[{ label: $t('auth.resend'), color: 'warning', variant: 'outline', onClick: resendVerification }]"
          />
        </template>
        <template #footer>
          <div class="flex flex-col gap-1">
            <ULink
              to="/forgot-password"
              class="text-primary font-medium"
            >
              {{ $t('auth.forgot') }}
            </ULink>
            <span>
              {{ $t('auth.noAccount') }}
              <ULink
                :to="{ path: '/register', query: route.query }"
                class="text-primary font-medium"
              >{{ $t('common.register') }}</ULink>
            </span>
          </div>
        </template>
      </UAuthForm>
    </UPageCard>
  </UContainer>
</template>
