<script setup lang="ts">
/**
 * Zmiana statusu na „Gotowe do odbioru” z pytaniem o powiadomienie klienta (SMS / push i e-mail według ustawień
 * warsztatu). Pole jest domyślnie zaznaczone, gdy warsztat proponuje tę wiadomość, a klient jej jeszcze nie dostał.
 */
const props = defineProps<{ order: { id: string, number: string } | null, loading?: boolean }>()
const emit = defineEmits<{ confirm: [notifyCustomer: boolean | undefined], cancel: [] }>()

const { t, d } = useI18n()
const { data: me } = useMe()
const canNotify = computed(() => !!me.value?.activeOrganization?.can.notifyCustomers)

type Panel = Awaited<ReturnType<typeof loadPanel>>
async function loadPanel(id: string) {
  return $fetch(`/api/work-orders/${id}/customer-notifications`)
}
const panel = ref<Panel | null>(null)
const checking = ref(false)
const notify = ref(false)

/** kanały z ustawień warsztatu, którymi faktycznie da się dotrzeć do klienta */
const channels = computed(() => {
  const p = panel.value
  if (!p) return []
  const rule = p.settings.order_ready
  const list: string[] = []
  if (rule.phone && p.customer.hasPhone && (p.customer.pushActive || p.customer.notifySms)) {
    list.push(p.customer.pushActive ? t('customerNotifications.via.push') : t('customerNotifications.via.sms'))
  }
  if (rule.email && p.customer.hasEmail && p.customer.notifyEmail) list.push(t('customerNotifications.via.email'))
  return list
})

watch(() => props.order?.id, async (id) => {
  panel.value = null
  notify.value = false
  if (!id || !canNotify.value) return
  checking.value = true
  try {
    panel.value = await loadPanel(id)
    const rule = panel.value.settings.order_ready
    notify.value = rule.auto && !panel.value.lastSent.order_ready && channels.value.length > 0
  }
  catch {
    panel.value = null
  }
  finally {
    checking.value = false
  }
}, { immediate: true })

const open = computed({
  get: () => !!props.order,
  set: (value) => {
    if (!value) emit('cancel')
  },
})

function confirm() {
  // bez uprawnień do wiadomości – decyzja zostaje przy ustawieniach warsztatu (serwer)
  emit('confirm', canNotify.value && panel.value ? notify.value : undefined)
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="$t('customerNotifications.readyTitle')"
    :description="order ? $t('customerNotifications.readyDescription', { number: order.number }) : undefined"
  >
    <template #body>
      <div
        v-if="canNotify"
        class="space-y-3"
      >
        <div
          v-if="checking"
          class="flex items-center gap-2 text-muted"
          role="status"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-5 animate-spin"
          />{{ $t('ui.loading') }}
        </div>
        <template v-else-if="panel">
          <UCheckbox
            v-model="notify"
            :disabled="!channels.length"
            :label="$t('customerNotifications.notifyOnReady')"
            :description="channels.length
              ? $t('customerNotifications.notifyChannels', { channels: channels.join(', ') })
              : $t('customerNotifications.notifyNoChannels')"
          />
          <p
            v-if="panel.lastSent.order_ready"
            class="text-sm text-muted"
          >
            {{ $t('customerNotifications.alreadyNotified', { date: d(new Date(panel.lastSent.order_ready), 'long') }) }}
          </p>
          <UAlert
            v-if="notify && panel.smsProvider === 'log' && !panel.customer.pushActive && channels.includes($t('customerNotifications.via.sms'))"
            color="warning"
            variant="subtle"
            icon="i-lucide-message-square-dashed"
            :title="$t('customerNotifications.smsLog')"
          />
        </template>
      </div>
      <p
        v-else
        class="text-muted"
      >
        {{ $t('customerNotifications.readyNoPermission') }}
      </p>
    </template>
    <template #footer>
      <UButton
        color="neutral"
        variant="outline"
        :label="$t('common.cancel')"
        @click="emit('cancel')"
      />
      <UButton
        icon="i-lucide-flag"
        :loading="loading"
        :disabled="checking"
        :label="notify ? $t('customerNotifications.readyConfirmNotify') : $t('customerNotifications.readyConfirm')"
        @click="confirm"
      />
    </template>
  </UModal>
</template>
