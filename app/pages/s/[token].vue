<script setup lang="ts">
/**
 * Status naprawy dla klienta (link z SMS-a / e-maila, bez logowania): etap naprawy z datami, termin, postęp,
 * kontakt do warsztatu i ustawienia powiadomień (push w tym telefonie zamiast SMS-a, rezygnacja z SMS / e-maili).
 */
import { STATUS_STEPS, type StatusStep } from '#shared/notifications'
import { VEHICLE_TYPE_INFO, type VehicleType } from '#shared/workshop'
import { brandIcon } from '#shared/brand'
import type { PushSupport } from '~/utils/push'

definePageMeta({ layout: 'public', themeContext: 'customer' })

const route = useRoute()
const token = route.params.token as string
const { t, d } = useI18n()
const toast = useToast()

useHead({
  link: [
    { rel: 'manifest', href: `/api/public/status/${token}/manifest` },
    { rel: 'apple-touch-icon', href: brandIcon('customer-apple-touch-icon') },
  ],
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
  ],
})

// Tylko w przeglądarce: podglądy linków w komunikatorach nie liczą się jako wyświetlenie
const { data, error, status, refresh } = useFetch(`/api/public/status/${token}`, { server: false })
const fetchedAt = ref<Date | null>(null)
watch(data, () => {
  fetchedAt.value = new Date()
})

useHead({ title: () => (data.value ? t('statusPage.pageTitle', { name: data.value.organization.name }) : t('statusPage.title')) })

const vehicleTitle = computed(() => {
  const v = data.value?.vehicle
  if (!v) return ''
  return [v.make, v.model].filter(Boolean).join(' ') || t(`vehicleType.${v.type}`)
})
const stepIndex = computed(() => (data.value ? STATUS_STEPS.indexOf(data.value.order.step) : -1))
function stepState(step: StatusStep) {
  const index = STATUS_STEPS.indexOf(step)
  if (index < stepIndex.value || data.value?.order.step === 'closed') return 'done'
  return index === stepIndex.value ? 'current' : 'todo'
}
const stepIcon: Record<StatusStep, string> = {
  received: 'i-lucide-clipboard-check',
  in_progress: 'i-lucide-wrench',
  ready: 'i-lucide-flag',
  closed: 'i-lucide-car-front',
}

// Odświeżanie co minutę przy otwartej stronie – status zmienia się w trakcie dnia
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    if (document.visibilityState === 'visible' && !error.value) refresh()
  }, 60_000)
})
onBeforeUnmount(() => clearInterval(timer))

// ── powiadomienia ──
const pushKey = `napiko-status-push:${token}`
const pushState = ref<'loading' | 'on' | 'off' | 'denied' | PushSupport>('loading')
const busy = ref<string | null>(null)

async function checkPush() {
  const support = pushSupport()
  if (support !== 'supported') {
    pushState.value = support
    return
  }
  if (Notification.permission === 'denied') {
    pushState.value = 'denied'
    return
  }
  registerServiceWorker().catch(() => undefined)
  const subscription = await currentPushSubscription().catch(() => null)
  let saved: string | null = null
  try {
    saved = localStorage.getItem(pushKey)
  }
  catch {
    saved = null
  }
  pushState.value = subscription && saved === subscription.endpoint && (data.value?.push.devices ?? 0) > 0 ? 'on' : 'off'
}
watch(() => data.value?.push.devices, () => checkPush())
onMounted(checkPush)

async function enablePush() {
  const key = data.value?.push.publicKey
  if (!key) return
  busy.value = 'push'
  try {
    const subscription = await subscribeToPush(key)
    await $fetch(`/api/public/status/${token}/push`, { method: 'POST', body: { action: 'subscribe', subscription: subscription.toJSON() } })
    try {
      localStorage.setItem(pushKey, subscription.endpoint)
    }
    catch {
      // tryb prywatny – stan sprawdzimy przy następnym wejściu
    }
    await refresh()
    pushState.value = 'on'
    toast.add({ title: t('statusPage.notifications.pushEnabled'), color: 'success', icon: 'i-lucide-bell-ring' })
  }
  catch (err) {
    if (err instanceof PushPermissionError) {
      pushState.value = err.permission === 'denied' ? 'denied' : 'off'
      return
    }
    toast.add({ title: apiErrorMessage(err, t('statusPage.notifications.pushFailed')), color: 'error' })
  }
  finally {
    busy.value = null
  }
}

async function disablePush() {
  busy.value = 'push'
  try {
    const endpoint = await unsubscribeFromPush()
    if (endpoint) await $fetch(`/api/public/status/${token}/push`, { method: 'POST', body: { action: 'unsubscribe', endpoint } })
    try {
      localStorage.removeItem(pushKey)
    }
    catch {
      // bez znaczenia
    }
    await refresh()
    pushState.value = 'off'
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    busy.value = null
  }
}

async function setChannel(channel: 'sms' | 'email', value: boolean) {
  busy.value = channel
  try {
    await $fetch(`/api/public/status/${token}/preferences`, { method: 'POST', body: { [channel]: value } })
    await refresh()
    toast.add({ title: t('statusPage.notifications.saved'), color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    busy.value = null
  }
}

// Link z e-maila („Nie chcę takich e-maili”) prowadzi prosto do ustawień powiadomień
watch(data, (value) => {
  if (value && route.hash === '#powiadomienia') {
    nextTick(() => document.getElementById('powiadomienia')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
}, { once: true })
</script>

<template>
  <UContainer class="max-w-2xl py-6 sm:py-10">
    <div
      v-if="!data && !error"
      class="flex justify-center py-24"
      role="status"
      :aria-label="$t('ui.loading')"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-muted"
      />
    </div>

    <UCard v-else-if="!data">
      <UEmpty
        icon="i-lucide-link-2-off"
        :title="$t('statusPage.invalidTitle')"
        :description="apiErrorMessage(error, $t('statusPage.invalid'))"
      />
    </UCard>

    <div
      v-else
      class="space-y-6"
    >
      <header class="napiko-surface space-y-4 border-t-4 border-t-primary p-5 sm:p-7">
        <div class="flex items-center gap-3">
          <img
            v-if="data.organization.logoUrl"
            :src="data.organization.logoUrl"
            :alt="data.organization.name"
            class="size-12 rounded-md object-contain"
          >
          <div class="min-w-0">
            <p class="text-sm text-muted">
              {{ $t('statusPage.from') }}
            </p>
            <p class="text-lg font-semibold break-words">
              {{ data.organization.name }}
            </p>
          </div>
        </div>
        <h1 class="text-2xl font-bold">
          {{ $t('statusPage.title') }}
        </h1>
        <p
          v-if="data.vehicle"
          class="flex flex-wrap items-center gap-2 text-sm"
        >
          <UIcon
            :name="VEHICLE_TYPE_INFO[data.vehicle.type as VehicleType]?.icon ?? 'i-lucide-wrench'"
            class="size-4 text-muted"
          />
          <span class="font-medium">{{ vehicleTitle }}</span>
          <span
            v-if="data.vehicle.registrationNumber"
            class="rounded border border-default bg-default px-1.5 font-mono text-xs leading-5"
          >{{ data.vehicle.registrationNumber }}</span>
        </p>
        <p class="text-sm text-muted">
          {{ $t('statusPage.order', { number: data.order.number }) }}
        </p>
      </header>

      <UAlert
        v-if="data.preview"
        color="info"
        variant="subtle"
        icon="i-lucide-eye"
        :title="$t('statusPage.preview')"
        :description="$t('statusPage.previewHint')"
      />

      <UAlert
        v-if="data.order.cancelled"
        color="neutral"
        variant="subtle"
        icon="i-lucide-ban"
        :title="$t('statusPage.cancelled')"
        :description="$t('statusPage.cancelledHint')"
      />

      <template v-else>
        <UAlert
          v-if="data.order.step === 'ready'"
          color="success"
          variant="subtle"
          icon="i-lucide-flag"
          :title="$t('statusPage.readyTitle')"
          :description="data.organization.address ? $t('statusPage.readyHint', { address: data.organization.address }) : $t('statusPage.readyHintNoAddress')"
        />
        <UAlert
          v-if="data.waitingForCustomer"
          color="warning"
          variant="subtle"
          icon="i-lucide-hourglass"
          :title="$t('statusPage.waiting')"
          :description="$t('statusPage.waitingHint')"
        />

        <section
          class="napiko-surface p-5 sm:p-7"
          :aria-label="$t('statusPage.stepsLabel')"
        >
          <ol class="space-y-0">
            <li
              v-for="(step, index) in STATUS_STEPS"
              :key="step"
              class="relative flex gap-4 pb-6 last:pb-0"
              :aria-current="stepState(step) === 'current' ? 'step' : undefined"
            >
              <span
                v-if="index < STATUS_STEPS.length - 1"
                class="absolute start-5 top-10 bottom-0 w-0.5 -translate-x-1/2"
                :class="stepState(step) === 'done' ? 'bg-primary' : 'bg-accented'"
                aria-hidden="true"
              />
              <span
                class="relative grid size-10 shrink-0 place-items-center rounded-full border-2"
                :class="{
                  'border-primary bg-primary text-inverted': stepState(step) === 'done',
                  'border-primary bg-default text-primary': stepState(step) === 'current',
                  'border-accented bg-default text-muted': stepState(step) === 'todo',
                }"
                aria-hidden="true"
              >
                <UIcon
                  :name="stepState(step) === 'done' ? 'i-lucide-check' : stepIcon[step]"
                  class="size-5"
                />
              </span>
              <div class="min-w-0 pt-1.5">
                <p
                  class="font-semibold"
                  :class="{ 'text-muted': stepState(step) === 'todo' }"
                >
                  {{ $t(`statusPage.steps.${step}`) }}
                  <span
                    v-if="stepState(step) === 'current'"
                    class="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                  >{{ $t('statusPage.current') }}</span>
                </p>
                <p
                  v-if="data.order.steps[step]"
                  class="text-sm text-muted"
                >
                  {{ d(new Date(data.order.steps[step]!), 'long') }}
                </p>
                <p
                  v-if="stepState(step) === 'current'"
                  class="mt-1 text-sm"
                >
                  {{ $t(`statusPage.stepHints.${step}`) }}
                </p>
                <div
                  v-if="step === 'in_progress' && stepState(step) === 'current' && data.progress.total"
                  class="mt-3 max-w-sm space-y-1"
                >
                  <UProgress
                    :model-value="data.progress.done"
                    :max="data.progress.total"
                    size="sm"
                  />
                  <p class="text-xs text-muted">
                    {{ $t('statusPage.progress', data.progress) }}
                  </p>
                </div>
              </div>
            </li>
          </ol>
          <p
            v-if="data.order.promisedAt && data.order.step !== 'closed'"
            class="mt-6 flex items-center gap-2 border-t border-default pt-4 text-sm"
          >
            <UIcon
              name="i-lucide-calendar-clock"
              class="size-4 text-muted"
            />
            {{ $t('statusPage.promised', { date: d(new Date(data.order.promisedAt), 'long') }) }}
          </p>
        </section>
      </template>

      <section
        v-if="data.organization.phone || data.organization.email || data.organization.address"
        class="napiko-surface space-y-3 p-5 sm:p-7"
      >
        <h2 class="text-lg font-semibold">
          {{ $t('statusPage.contact') }}
        </h2>
        <p
          v-if="data.organization.address"
          class="flex items-start gap-2 text-sm"
        >
          <UIcon
            name="i-lucide-map-pin"
            class="mt-0.5 size-4 shrink-0 text-muted"
          />{{ data.organization.address }}
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="data.organization.phone"
            :href="`tel:${data.organization.phone.replace(/\s/g, '')}`"
            icon="i-lucide-phone"
            :label="$t('statusPage.call', { phone: data.organization.phone })"
          />
          <UButton
            v-if="data.organization.email"
            :href="`mailto:${data.organization.email}`"
            color="neutral"
            variant="outline"
            icon="i-lucide-mail"
            :label="$t('statusPage.write')"
          />
        </div>
      </section>

      <section
        id="powiadomienia"
        class="napiko-surface scroll-mt-6 space-y-4 p-5 sm:p-7"
      >
        <div>
          <h2 class="text-lg font-semibold">
            {{ $t('statusPage.notifications.title') }}
          </h2>
          <p class="text-sm text-muted">
            {{ $t('statusPage.notifications.description') }}
          </p>
        </div>

        <div
          v-if="data.push.enabled"
          class="space-y-2 rounded-xl border border-default p-4"
        >
          <p class="flex items-center gap-2 font-medium">
            <UIcon
              name="i-lucide-smartphone"
              class="size-5 text-primary"
            />{{ $t('statusPage.notifications.push') }}
          </p>
          <p class="text-sm text-muted">
            {{ $t('statusPage.notifications.pushHint') }}
          </p>
          <template v-if="!data.preview">
            <div
              v-if="pushState === 'on'"
              class="flex flex-wrap items-center gap-2"
            >
              <UBadge
                color="success"
                variant="subtle"
                size="lg"
                icon="i-lucide-bell-ring"
                :label="$t('statusPage.notifications.pushOn')"
              />
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-bell-off"
                :loading="busy === 'push'"
                :label="$t('statusPage.notifications.pushDisable')"
                @click="disablePush"
              />
            </div>
            <UButton
              v-else-if="pushState === 'off'"
              icon="i-lucide-bell-ring"
              :loading="busy === 'push'"
              :label="$t('statusPage.notifications.pushEnable')"
              @click="enablePush"
            />
            <p
              v-else-if="pushState === 'ios-install'"
              class="rounded-lg bg-elevated p-3 text-sm"
            >
              {{ $t('statusPage.notifications.iosInstall') }}
            </p>
            <p
              v-else-if="pushState === 'denied'"
              class="text-sm text-warning"
            >
              {{ $t('statusPage.notifications.denied') }}
            </p>
            <p
              v-else-if="pushState === 'unsupported'"
              class="text-sm text-muted"
            >
              {{ $t('statusPage.notifications.unsupported') }}
            </p>
          </template>
        </div>

        <div class="space-y-1">
          <USwitch
            v-if="data.notifications.sms.available"
            :model-value="data.notifications.sms.enabled"
            :disabled="data.preview || busy === 'sms'"
            :label="$t('statusPage.notifications.sms', { to: data.notifications.sms.to })"
            :description="$t('statusPage.notifications.smsHint')"
            @update:model-value="value => setChannel('sms', value)"
          />
          <USwitch
            v-if="data.notifications.email.available"
            :model-value="data.notifications.email.enabled"
            :disabled="data.preview || busy === 'email'"
            :label="$t('statusPage.notifications.email', { to: data.notifications.email.to })"
            :description="$t('statusPage.notifications.emailHint')"
            @update:model-value="value => setChannel('email', value)"
          />
        </div>
      </section>

      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        icon="i-lucide-wifi-off"
        :title="$t('statusPage.refreshFailed')"
      />

      <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>
          <template v-if="fetchedAt">{{ $t('statusPage.updated', { date: d(fetchedAt, 'long') }) }} · </template>{{ $t('statusPage.privacy') }}
        </span>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-refresh-cw"
          :loading="status === 'pending'"
          :label="$t('statusPage.refresh')"
          @click="refresh()"
        />
      </div>
    </div>
  </UContainer>
</template>
