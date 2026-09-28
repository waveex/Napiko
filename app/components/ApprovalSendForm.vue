<script setup lang="ts">
import { APPROVAL_EXPIRY_DAYS, type ApprovalCreateInput, type EstimateApprovalCreateInput } from '#shared/schemas'
import { grossCents } from '#shared/workshop'

interface QuotedRequest {
  id: string
  title: string
  partsNet: string | null
  laborNet: string | null
  vatRate: string
}

const props = withDefaults(defineProps<{
  /** requests – wycenione prace dodatkowe (decyzja przy każdej pozycji), estimate – cały kosztorys */
  mode?: 'requests' | 'estimate'
  workOrderId: string
  requests: QuotedRequest[]
  estimateSummary?: { count: number, totalGrossCents: number } | null
  customerEmail: string | null
  customerPhone: string | null
}>(), { mode: 'requests', estimateSummary: null })
const emit = defineEmits<{ sent: [], close: [] }>()

const { t, n, d } = useI18n()
const toast = useToast()

const selected = ref<string[]>(props.requests.map(r => r.id))
const channel = ref<'link' | 'email' | 'sms'>(props.customerPhone ? 'sms' : props.customerEmail ? 'email' : 'link')
const recipient = ref<string>('')
const message = ref<string | null>(null)
const expiresInDays = ref<number>(3)
const saving = ref(false)
const result = ref<{ url: string, expiresAt: string } | null>(null)

watch(channel, (value) => {
  recipient.value = value === 'email' ? (props.customerEmail ?? '') : value === 'sms' ? (props.customerPhone ?? '') : ''
}, { immediate: true })

const channelItems = computed(() => [
  { value: 'sms', label: t('approvals.channel.sms'), description: t('approvals.channelHint.sms'), icon: 'i-lucide-message-square' },
  { value: 'email', label: t('approvals.channel.email'), description: t('approvals.channelHint.email'), icon: 'i-lucide-mail' },
  { value: 'link', label: t('approvals.channel.link'), description: t('approvals.channelHint.link'), icon: 'i-lucide-link' },
])
const expiryItems = computed(() => APPROVAL_EXPIRY_DAYS.map(days => ({ value: days as number, label: t('approvals.days', { n: days }, days) })))

const total = computed(() => props.requests
  .filter(r => selected.value.includes(r.id))
  .reduce((sum, r) => sum + grossCents(r.partsNet, r.laborNet, r.vatRate), 0))

function toggle(id: string, value: boolean | 'indeterminate') {
  selected.value = value === true ? [...selected.value, id] : selected.value.filter(x => x !== id)
}

const ready = computed(() => (props.mode === 'estimate' ? !!props.estimateSummary?.count : selected.value.length > 0)
  && (channel.value === 'link' || !!recipient.value.trim()))

async function send() {
  saving.value = true
  try {
    const delivery: EstimateApprovalCreateInput = {
      channel: channel.value,
      recipient: channel.value === 'link' ? null : recipient.value,
      message: message.value,
      expiresInDays: expiresInDays.value,
    }
    const created = props.mode === 'estimate'
      ? await $fetch(`/api/work-orders/${props.workOrderId}/estimate-approval`, { method: 'POST', body: delivery })
      : await $fetch(`/api/work-orders/${props.workOrderId}/approvals`, { method: 'POST', body: { ...delivery, requestIds: selected.value } satisfies ApprovalCreateInput })
    result.value = { url: created.url, expiresAt: String(created.expiresAt) }
    toast.add({ title: t(`approvals.sentVia.${channel.value}`), color: 'success', icon: 'i-lucide-send' })
    emit('sent')
  }
  catch (error) {
    toast.add({ title: apiErrorMessage(error, t('common.error')), color: 'error' })
  }
  finally {
    saving.value = false
  }
}

async function copyLink() {
  if (!result.value) return
  try {
    await navigator.clipboard.writeText(result.value.url)
    toast.add({ title: t('approvals.copied'), color: 'success', icon: 'i-lucide-copy-check' })
  }
  catch {
    toast.add({ title: t('approvals.copyFailed'), color: 'warning' })
  }
}
</script>

<template>
  <div
    v-if="result"
    class="space-y-4"
  >
    <UAlert
      color="success"
      variant="subtle"
      icon="i-lucide-circle-check"
      :title="$t('approvals.readyTitle')"
      :description="$t('approvals.readyHint', { date: d(new Date(result.expiresAt), 'long') })"
    />
    <UFormField :label="$t('approvals.link')">
      <div class="flex gap-2">
        <UInput
          :model-value="result.url"
          readonly
          class="flex-1 font-mono text-xs"
          @focus="(event: FocusEvent) => (event.target as HTMLInputElement).select()"
        />
        <UButton
          icon="i-lucide-copy"
          :label="$t('approvals.copy')"
          @click="copyLink"
        />
      </div>
    </UFormField>
    <p class="text-xs text-muted">
      {{ $t('approvals.linkPrivacy') }}
    </p>
    <div class="flex justify-end gap-2">
      <UButton
        :to="result.url"
        target="_blank"
        color="neutral"
        variant="outline"
        icon="i-lucide-external-link"
        :label="$t('approvals.preview')"
      />
      <UButton
        :label="$t('common.close')"
        @click="emit('close')"
      />
    </div>
  </div>

  <form
    v-else
    class="space-y-4"
    @submit.prevent="send"
  >
    <p
      v-if="mode === 'estimate' && estimateSummary"
      class="rounded-md bg-elevated p-3 text-sm font-medium"
    >
      {{ $t('estimate.summary', { count: estimateSummary.count, total: n(estimateSummary.totalGrossCents / 100, 'currency') }) }}
    </p>
    <UFormField
      v-else
      :label="$t('approvals.items')"
    >
      <ul class="space-y-2">
        <li
          v-for="r in requests"
          :key="r.id"
          class="flex items-center justify-between gap-3 rounded-md border border-default p-2"
        >
          <UCheckbox
            :model-value="selected.includes(r.id)"
            :label="r.title"
            @update:model-value="value => toggle(r.id, value)"
          />
          <span class="shrink-0 text-sm font-medium">{{ n(grossCents(r.partsNet, r.laborNet, r.vatRate) / 100, 'currency') }}</span>
        </li>
      </ul>
      <p class="mt-2 text-sm">
        {{ $t('approvals.totalGross', { total: n(total / 100, 'currency') }) }}
      </p>
    </UFormField>

    <UFormField :label="$t('approvals.how')">
      <URadioGroup
        v-model="channel"
        :items="channelItems"
        variant="card"
        :ui="{ fieldset: 'grid gap-2' }"
      />
    </UFormField>

    <UFormField
      v-if="channel !== 'link'"
      :label="channel === 'email' ? $t('customers.email') : $t('customers.phone')"
      required
    >
      <UInput
        v-model="recipient"
        :type="channel === 'email' ? 'email' : 'tel'"
        class="w-full"
      />
    </UFormField>

    <UFormField
      :label="$t('approvals.message')"
      :help="$t('approvals.messageHint')"
    >
      <UTextarea
        v-model.nullable="message"
        :rows="2"
        autoresize
        :placeholder="$t('approvals.messagePlaceholder')"
        class="w-full"
      />
    </UFormField>

    <UFormField :label="$t('approvals.expires')">
      <USelect
        v-model="expiresInDays"
        :items="expiryItems"
        class="w-40"
      />
    </UFormField>

    <div class="flex justify-end gap-2">
      <UButton
        color="neutral"
        variant="ghost"
        :label="$t('common.cancel')"
        @click="emit('close')"
      />
      <UButton
        type="submit"
        icon="i-lucide-send"
        :disabled="!ready"
        :loading="saving"
        :label="channel === 'link' ? $t('approvals.createLink') : $t('approvals.send')"
      />
    </div>
  </form>
</template>
