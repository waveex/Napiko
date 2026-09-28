<script setup lang="ts">
/**
 * Zamknięcie zlecenia z numerem paragonu z kasy fiskalnej (decyzja D4a – numer wpisywany ręcznie).
 * W trybie „receipt” tylko uzupełnia albo poprawia paragon (także w zamkniętym zleceniu).
 */
const props = withDefaults(defineProps<{
  mode?: 'close' | 'receipt'
  /** czy użytkownik może wpisywać paragon (dostęp do rozliczeń) */
  canReceipt: boolean
  estimateTotalCents?: number | null
  receiptNumber?: string | null
  receiptIssuedOn?: string | null
  loading?: boolean
}>(), { mode: 'close', estimateTotalCents: null, receiptNumber: null, receiptIssuedOn: null })
const emit = defineEmits<{
  submit: [data: { receiptNumber?: string | null, receiptIssuedOn?: string | null }]
  cancel: []
}>()

const { n } = useI18n()

function today() {
  const now = new Date()
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const number = ref(props.receiptNumber ?? '')
const issuedOn = ref(props.receiptIssuedOn ?? today())

function submit() {
  if (props.loading) return
  if (!props.canReceipt) {
    emit('submit', {})
    return
  }
  const value = number.value.trim()
  emit('submit', { receiptNumber: value || null, receiptIssuedOn: value ? (issuedOn.value || null) : null })
}
</script>

<template>
  <form
    class="space-y-4"
    @submit.prevent="submit"
  >
    <p
      v-if="props.canReceipt"
      class="rounded-md bg-elevated p-3 text-sm font-medium"
    >
      {{ props.estimateTotalCents !== null
        ? $t('closeOrder.total', { total: n(props.estimateTotalCents / 100, 'currency') })
        : $t('closeOrder.noEstimate') }}
    </p>

    <template v-if="props.canReceipt">
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField :label="$t('closeOrder.receiptNumber')">
          <UInput
            v-model="number"
            maxlength="40"
            :placeholder="$t('closeOrder.receiptNumberPlaceholder')"
            class="w-full"
            autofocus
          />
        </UFormField>
        <UFormField :label="$t('closeOrder.receiptDate')">
          <UInput
            v-model="issuedOn"
            type="date"
            :disabled="!number.trim()"
            class="w-full"
          />
        </UFormField>
      </div>
      <p class="text-xs text-muted">
        {{ $t('closeOrder.receiptHint') }}
      </p>
    </template>

    <div class="flex justify-end gap-2">
      <UButton
        color="neutral"
        variant="ghost"
        :label="$t('common.cancel')"
        @click="emit('cancel')"
      />
      <UButton
        type="submit"
        :icon="props.mode === 'close' ? 'i-lucide-lock' : 'i-lucide-receipt'"
        :loading="props.loading"
        :label="props.mode === 'close' ? $t('closeOrder.confirm') : $t('closeOrder.saveReceipt')"
      />
    </div>
  </form>
</template>
