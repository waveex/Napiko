<script setup lang="ts">
import { CUSTOMER_NOTIFICATION_STATUS_COLOR, type AutoCustomerEvent } from '#shared/notifications'

const props = defineProps<{
  workOrderId: string
  closed?: boolean
  /** zmiana wartości odświeża kartę (np. po zmianie statusu zlecenia) */
  refreshKey?: number
}>()

const { t, d } = useI18n()
const toast = useToast()
const { data: panel, refresh, error, status } = await useFetch(() => `/api/work-orders/${props.workOrderId}/customer-notifications`, {
  key: `customer-notifications-${props.workOrderId}`,
})
watch(() => props.refreshKey, () => refresh())

const busy = ref(false)

// ── link do statusu naprawy ──
async function createLink(rotate = false) {
  busy.value = true
  try {
    await $fetch(`/api/work-orders/${props.workOrderId}/status-link`, { method: 'POST', body: { rotate } })
    await refresh()
    if (rotate) toast.add({ title: t('customerNotifications.rotated'), color: 'success', icon: 'i-lucide-refresh-ccw' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    busy.value = false
    rotateOpen.value = false
  }
}
const rotateOpen = ref(false)

async function copyLink() {
  const url = panel.value?.statusLink?.url
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    toast.add({ title: t('customerNotifications.copied'), color: 'success', icon: 'i-lucide-copy-check' })
  }
  catch {
    toast.add({ title: t('customerNotifications.copyFailed'), description: url, color: 'warning' })
  }
}

// ── ręczna wysyłka ──
const sendOpen = ref(false)
const form = reactive<{ event: AutoCustomerEvent, phone: boolean, email: boolean }>({ event: 'order_ready', phone: true, email: true })
function openSend() {
  const ready = panel.value?.orderStatus === 'ready' || panel.value?.orderStatus === 'closed'
  form.event = ready ? 'order_ready' : 'order_received'
  const rule = panel.value?.settings[form.event]
  form.phone = !!panel.value?.customer.hasPhone && (rule?.phone ?? true)
  form.email = !!panel.value?.customer.hasEmail && (rule?.email ?? true)
  sendOpen.value = true
}
const eventItems = computed(() => (['order_received', 'order_ready'] as const).map(value => ({
  value,
  label: t(`customerNotifications.events.${value}`),
  description: panel.value?.lastSent[value]
    ? t('customerNotifications.lastSent', { date: d(new Date(panel.value.lastSent[value]!), 'long') })
    : t('customerNotifications.neverSent'),
})))

async function send() {
  if (!form.phone && !form.email) return
  busy.value = true
  try {
    const result = await $fetch(`/api/work-orders/${props.workOrderId}/customer-notifications`, {
      method: 'POST',
      body: { event: form.event, phone: form.phone, email: form.email },
    })
    panel.value = result
    sendOpen.value = false
    const skipped = result.queued.filter(q => q.status === 'skipped')
    if (skipped.length === result.queued.length) {
      toast.add({ title: t('customerNotifications.notSent'), description: skipped.map(s => t(`customerNotifications.skip.${s.skipReason}`)).join(', '), color: 'warning' })
    }
    else {
      toast.add({ title: t('customerNotifications.sent'), color: 'success', icon: 'i-lucide-send' })
    }
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    busy.value = false
  }
}

const viaIcon = { push: 'i-lucide-smartphone', sms: 'i-lucide-message-square', email: 'i-lucide-mail' } as const
function itemIcon(item: { deliveredVia: 'push' | 'sms' | 'email' | null, channel: 'phone' | 'email' }) {
  return item.deliveredVia ? viaIcon[item.deliveredVia] : item.channel === 'email' ? viaIcon.email : viaIcon.sms
}
</script>

<template>
  <UPageCard
    :title="$t('customerNotifications.title')"
    :description="$t('customerNotifications.description')"
  >
    <LoadState
      :error="error"
      :pending="status === 'pending' && !panel"
      @retry="refresh()"
    />

    <template v-if="panel">
      <section class="space-y-2">
        <h3 class="text-sm font-medium">
          {{ $t('customerNotifications.statusLink') }}
        </h3>
        <template v-if="panel.statusLink?.url">
          <div class="flex flex-wrap gap-2">
            <UButton
              size="sm"
              icon="i-lucide-copy"
              :label="$t('customerNotifications.copyLink')"
              @click="copyLink"
            />
            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              icon="i-lucide-external-link"
              :to="panel.statusLink.url"
              target="_blank"
              :label="$t('customerNotifications.openLink')"
            />
            <UButton
              v-if="panel.can.send"
              size="sm"
              color="neutral"
              variant="ghost"
              icon="i-lucide-refresh-ccw"
              :label="$t('customerNotifications.rotateLink')"
              @click="rotateOpen = true"
            />
          </div>
          <p class="text-xs text-muted">
            {{ panel.statusLink.lastViewedAt
              ? $t('customerNotifications.views', { count: panel.statusLink.viewCount, date: d(new Date(panel.statusLink.lastViewedAt), 'long') })
              : $t('customerNotifications.notViewed') }}
          </p>
        </template>
        <template v-else>
          <p class="text-sm text-muted">
            {{ $t('customerNotifications.statusLinkNone') }}
          </p>
          <UButton
            v-if="panel.can.send"
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-link"
            :loading="busy"
            :label="$t('customerNotifications.createLink')"
            class="self-start"
            @click="createLink()"
          />
        </template>
      </section>

      <ul class="space-y-1 text-sm">
        <li
          v-if="panel.customer.pushActive"
          class="flex items-start gap-2"
        >
          <UIcon
            name="i-lucide-smartphone"
            class="mt-0.5 size-4 shrink-0 text-success"
          />{{ $t('customerNotifications.pushActive') }}
        </li>
        <li
          v-if="!panel.customer.hasPhone"
          class="flex items-start gap-2 text-muted"
        >
          <UIcon
            name="i-lucide-phone-off"
            class="mt-0.5 size-4 shrink-0"
          />{{ $t('customerNotifications.noPhone') }}
        </li>
        <li
          v-else-if="!panel.customer.notifySms"
          class="flex items-start gap-2 text-muted"
        >
          <UIcon
            name="i-lucide-message-square-off"
            class="mt-0.5 size-4 shrink-0"
          />{{ $t('customerNotifications.optedOutSms') }}
        </li>
        <li
          v-if="!panel.customer.hasEmail"
          class="flex items-start gap-2 text-muted"
        >
          <UIcon
            name="i-lucide-mail-x"
            class="mt-0.5 size-4 shrink-0"
          />{{ $t('customerNotifications.noEmail') }}
        </li>
        <li
          v-else-if="!panel.customer.notifyEmail"
          class="flex items-start gap-2 text-muted"
        >
          <UIcon
            name="i-lucide-mail-x"
            class="mt-0.5 size-4 shrink-0"
          />{{ $t('customerNotifications.optedOutEmail') }}
        </li>
      </ul>

      <UAlert
        v-if="panel.smsProvider === 'log'"
        color="warning"
        variant="subtle"
        icon="i-lucide-message-square-dashed"
        :title="$t('customerNotifications.smsLog')"
      />

      <section class="space-y-2">
        <h3 class="text-sm font-medium">
          {{ $t('customerNotifications.history') }}
        </h3>
        <p
          v-if="!panel.items.length"
          class="text-sm text-muted"
        >
          {{ $t('customerNotifications.empty') }}
        </p>
        <ul
          v-else
          class="divide-y divide-default"
        >
          <li
            v-for="item in panel.items"
            :key="item.id"
            class="flex gap-3 py-2"
          >
            <UIcon
              :name="itemIcon(item)"
              class="mt-0.5 size-4 shrink-0 text-muted"
            />
            <div class="min-w-0 flex-1 space-y-0.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-medium">{{ $t(`customerNotifications.events.${item.event}`) }}</span>
                <UBadge
                  size="sm"
                  variant="subtle"
                  :color="CUSTOMER_NOTIFICATION_STATUS_COLOR[item.status]"
                  :label="$t(`customerNotifications.status.${item.status}`)"
                />
              </div>
              <p class="text-xs text-muted break-words">
                <template v-if="item.deliveredVia">
                  {{ $t(`customerNotifications.via.${item.deliveredVia}`) }} ·
                </template>
                <template v-if="item.recipient">
                  {{ item.recipient }} ·
                </template>
                {{ d(new Date(item.sentAt ?? item.createdAt), 'long') }} ·
                {{ item.trigger === 'auto' ? $t('customerNotifications.trigger.auto') : (item.sentByName ?? $t('customerNotifications.trigger.manual')) }}
              </p>
              <p
                v-if="item.skipReason"
                class="text-xs text-muted"
              >
                {{ $t(`customerNotifications.skip.${item.skipReason}`) }}
              </p>
              <p
                v-if="item.error"
                class="text-xs break-words"
                :class="item.status === 'failed' ? 'text-error' : 'text-muted'"
              >
                {{ item.error }}
              </p>
            </div>
          </li>
        </ul>
      </section>

      <UButton
        v-if="panel.can.send && !closed && panel.orderStatus !== 'cancelled'"
        icon="i-lucide-send"
        color="neutral"
        variant="outline"
        :label="$t('customerNotifications.send')"
        class="self-start justify-self-start"
        @click="openSend"
      />
    </template>

    <UModal
      v-model:open="sendOpen"
      :title="$t('customerNotifications.sendTitle')"
      :description="$t('customerNotifications.sendHint')"
    >
      <template #body>
        <div
          v-if="panel"
          class="space-y-5"
        >
          <URadioGroup
            v-model="form.event"
            :legend="$t('customerNotifications.sendEvent')"
            :items="eventItems"
            variant="card"
            :ui="{ fieldset: 'flex-col gap-2' }"
          />
          <fieldset class="space-y-1">
            <legend class="mb-1 text-base font-medium">
              {{ $t('customerNotifications.sendChannels') }}
            </legend>
            <UCheckbox
              v-model="form.phone"
              :disabled="!panel.customer.hasPhone"
              :label="$t('customerNotifications.channelPhone')"
              :description="!panel.customer.hasPhone ? $t('customerNotifications.noPhone')
                : panel.customer.pushActive ? $t('customerNotifications.pushActive')
                  : !panel.customer.notifySms ? $t('customerNotifications.optedOutSms') : panel.customer.phone ?? undefined"
            />
            <UCheckbox
              v-model="form.email"
              :disabled="!panel.customer.hasEmail"
              :label="$t('customerNotifications.channelEmail')"
              :description="!panel.customer.hasEmail ? $t('customerNotifications.noEmail')
                : !panel.customer.notifyEmail ? $t('customerNotifications.optedOutEmail') : panel.customer.email ?? undefined"
            />
          </fieldset>
          <p
            v-if="!form.phone && !form.email"
            class="text-sm text-warning"
          >
            {{ $t('customerNotifications.noChannel') }}
          </p>
        </div>
      </template>
      <template #footer>
        <UButton
          color="neutral"
          variant="outline"
          :label="$t('common.cancel')"
          @click="sendOpen = false"
        />
        <UButton
          icon="i-lucide-send"
          :loading="busy"
          :disabled="!form.phone && !form.email"
          :label="$t('customerNotifications.sendButton')"
          @click="send"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="rotateOpen"
      :title="$t('customerNotifications.rotateTitle')"
      :description="$t('customerNotifications.rotateHint')"
    >
      <template #footer>
        <UButton
          color="neutral"
          variant="outline"
          :label="$t('common.cancel')"
          @click="rotateOpen = false"
        />
        <UButton
          icon="i-lucide-refresh-ccw"
          :loading="busy"
          :label="$t('customerNotifications.rotateConfirm')"
          @click="createLink(true)"
        />
      </template>
    </UModal>
  </UPageCard>
</template>
