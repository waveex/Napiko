<script setup lang="ts">
import { AUTO_CUSTOMER_EVENTS, type CustomerNotificationSettings } from '#shared/notifications'

const props = defineProps<{ canEdit: boolean }>()

const { t } = useI18n()
const toast = useToast()
const { data, refresh, error, status } = await useFetch('/api/org/notification-settings')

const state = reactive<CustomerNotificationSettings>({
  order_received: { auto: true, phone: true, email: true },
  order_ready: { auto: true, phone: true, email: true },
})
watchEffect(() => {
  if (!data.value) return
  for (const event of AUTO_CUSTOMER_EVENTS) Object.assign(state[event], data.value.customerNotifications[event])
})

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    await $fetch('/api/org/notification-settings', { method: 'PUT', body: { customerNotifications: state } })
    await refresh()
    toast.add({ title: t('common.saved'), color: 'success', icon: 'i-lucide-check' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UPageCard
    :title="$t('customerNotifications.settings.title')"
    :description="$t('customerNotifications.settings.description')"
    class="max-w-2xl"
  >
    <LoadState
      :error="error"
      :pending="status === 'pending' && !data"
      @retry="refresh()"
    />
    <form
      v-if="data"
      class="space-y-5"
      @submit.prevent="save"
    >
      <fieldset
        v-for="event in AUTO_CUSTOMER_EVENTS"
        :key="event"
        :disabled="!props.canEdit"
        class="space-y-2 rounded-xl border border-default p-4"
      >
        <legend class="px-1 text-base font-semibold">
          {{ $t(`customerNotifications.events.${event}`) }}
        </legend>
        <p class="text-sm text-muted">
          {{ $t(`customerNotifications.settings.hint.${event}`) }}
        </p>
        <USwitch
          v-model="state[event].auto"
          :label="$t('customerNotifications.settings.auto')"
          :description="$t('customerNotifications.settings.autoHint')"
        />
        <div class="flex flex-wrap gap-x-6">
          <UCheckbox
            v-model="state[event].phone"
            :label="$t('customerNotifications.channelPhone')"
          />
          <UCheckbox
            v-model="state[event].email"
            :label="$t('customerNotifications.channelEmail')"
          />
        </div>
      </fieldset>

      <ul class="space-y-2 text-sm text-muted">
        <li class="flex gap-2">
          <UIcon
            name="i-lucide-message-square"
            class="mt-0.5 size-4 shrink-0"
          />{{ $t('customerNotifications.settings.d5') }}
        </li>
        <li class="flex gap-2">
          <UIcon
            name="i-lucide-smartphone"
            class="mt-0.5 size-4 shrink-0"
          />{{ data.pushEnabled ? $t('customerNotifications.settings.pushOn') : $t('customerNotifications.settings.pushOff') }}
        </li>
        <li class="flex gap-2">
          <UIcon
            name="i-lucide-user-x"
            class="mt-0.5 size-4 shrink-0"
          />{{ $t('customerNotifications.settings.optOut') }}
        </li>
      </ul>
      <UAlert
        v-if="data.smsProvider === 'log'"
        color="warning"
        variant="subtle"
        icon="i-lucide-message-square-dashed"
        :title="$t('customerNotifications.smsLog')"
      />

      <UButton
        v-if="props.canEdit"
        type="submit"
        :loading="saving"
        :label="$t('common.save')"
      />
    </form>
  </UPageCard>
</template>
