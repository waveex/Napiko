<script setup lang="ts">
/**
 * Karta klienta: zgoda na wiadomości o naprawie (SMS, e-mail) i telefony z włączonymi powiadomieniami push.
 * Klient może to zmienić także sam – na stronie statusu naprawy albo linkiem z e-maila.
 */
const props = defineProps<{
  customer: {
    id: string
    phone: string | null
    email: string | null
    notifySms: boolean
    notifyEmail: boolean
    pushDevices: { id: string, userAgent: string | null, createdAt: string | Date, lastSuccessAt: string | Date | null, active: boolean }[]
  }
  canEdit: boolean
}>()
const emit = defineEmits<{ changed: [] }>()

const { t, d } = useI18n()
const toast = useToast()
const busy = ref<string | null>(null)

async function setConsent(field: 'notifySms' | 'notifyEmail', value: boolean) {
  busy.value = field
  try {
    await $fetch(`/api/customers/${props.customer.id}`, { method: 'PATCH', body: { [field]: value } })
    emit('changed')
    toast.add({ title: t('common.saved'), color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    busy.value = null
  }
}

async function disableDevice(deviceId: string) {
  busy.value = deviceId
  try {
    await $fetch(`/api/customers/${props.customer.id}/push-devices/${deviceId}`, { method: 'DELETE' })
    emit('changed')
    toast.add({ title: t('customers.pushDisabled'), color: 'success', icon: 'i-lucide-bell-off' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    busy.value = null
  }
}

/** Krótki opis urządzenia z nagłówka przeglądarki („Android · Chrome”, „iPhone · Safari”). */
function deviceName(userAgent: string | null) {
  const ua = userAgent ?? ''
  const system = /iPhone|iPad/.test(ua) ? 'iPhone / iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : t('customers.pushDeviceUnknown')
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ''
  return [system, browser].filter(Boolean).join(' · ')
}
</script>

<template>
  <UPageCard
    :title="$t('customers.notifications')"
    :description="$t('customers.notificationsHint')"
  >
    <div class="space-y-1">
      <USwitch
        :model-value="customer.notifySms"
        :disabled="!canEdit || busy === 'notifySms'"
        :label="$t('customers.notifySms')"
        :description="customer.phone ? undefined : $t('customerNotifications.noPhone')"
        @update:model-value="value => setConsent('notifySms', value)"
      />
      <USwitch
        :model-value="customer.notifyEmail"
        :disabled="!canEdit || busy === 'notifyEmail'"
        :label="$t('customers.notifyEmail')"
        :description="customer.email ? undefined : $t('customerNotifications.noEmail')"
        @update:model-value="value => setConsent('notifyEmail', value)"
      />
    </div>

    <div
      v-if="customer.pushDevices.length"
      class="space-y-2"
    >
      <h3 class="text-sm font-medium">
        {{ $t('customers.pushDevices') }}
      </h3>
      <ul class="divide-y divide-default">
        <li
          v-for="device in customer.pushDevices"
          :key="device.id"
          class="flex flex-wrap items-center justify-between gap-2 py-2"
        >
          <div class="min-w-0 text-sm">
            <p class="font-medium">
              {{ deviceName(device.userAgent) }}
            </p>
            <p class="text-xs text-muted">
              {{ $t('customers.pushDeviceSince', { date: d(new Date(device.createdAt), 'short') }) }}
              <template v-if="!device.active">
                · {{ $t('customers.pushDeviceInactive') }}
              </template>
            </p>
          </div>
          <UButton
            v-if="canEdit"
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-bell-off"
            :loading="busy === device.id"
            :label="$t('customers.pushDisable')"
            @click="disableDevice(device.id)"
          />
        </li>
      </ul>
    </div>
  </UPageCard>
</template>
