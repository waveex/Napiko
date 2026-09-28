<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import {
  grossCents, toCents, URGENCY_COLOR, WORK_REQUEST_STATUS_COLOR,
  type WorkRequestKind, type WorkRequestStatus, type WorkRequestUrgency,
} from '#shared/workshop'
import type { WorkRequestAction } from '#shared/schemas'

interface RequestView {
  id: string
  kind: WorkRequestKind
  title: string
  description: string | null
  urgency: WorkRequestUrgency
  status: WorkRequestStatus
  partsNet: string | null
  laborNet: string | null
  vatRate: string
  officeNote: string | null
  decisionNote: string | null
  reporterName: string | null
  createdAt: string
}

interface Attachment {
  id: string
  contentType: string
  fileName: string
  url: string
  caption: string | null
  authorName: string | null
  createdAt: string
  createdBy: string | null
}

const props = defineProps<{
  request: RequestView
  permissions: { quote: boolean, decide: boolean }
  attachments?: Attachment[]
  /** Tytuł zadania, przy którym zgłoszono potrzebę. */
  taskTitle?: string | null
  /** Pozycja jest w prośbie o akceptację, na którą klient jeszcze nie odpowiedział. */
  awaitingCustomer?: boolean
  readonly?: boolean
}>()
const emit = defineEmits<{ changed: [] }>()

const { t, d, n } = useI18n()
const toast = useToast()

const busy = ref(false)
const quoteOpen = ref(false)
const decision = ref<'approved' | 'rejected' | null>(null)
const decisionNote = ref('')

const hasQuote = computed(() => props.request.partsNet !== null || props.request.laborNet !== null)
const net = computed(() => toCents(props.request.partsNet) + toCents(props.request.laborNet))
const gross = computed(() => grossCents(props.request.partsNet, props.request.laborNet, props.request.vatRate))
const pending = computed(() => props.request.status === 'open' || props.request.status === 'quoted')
const approveBlocked = computed(() => props.request.kind === 'extra_work' && props.request.status !== 'quoted')

async function act(body: WorkRequestAction, success: string) {
  busy.value = true
  try {
    await $fetch(`/api/requests/${props.request.id}`, { method: 'PATCH', body })
    toast.add({ title: success, color: 'success', icon: 'i-lucide-check' })
    quoteOpen.value = false
    decision.value = null
    emit('changed')
  }
  catch (error) {
    toast.add({ title: apiErrorMessage(error, t('common.error')), color: 'error' })
  }
  finally {
    busy.value = false
  }
}

function saveQuote(data: { partsNet: number | null, laborNet: number | null, vatRate: number, officeNote: string | null }) {
  act({ action: 'quote', ...data }, t('requests.quoted'))
}

function openDecision(value: 'approved' | 'rejected') {
  decisionNote.value = ''
  decision.value = value
}

function saveDecision() {
  if (!decision.value) return
  act({ action: 'decide', decision: decision.value, decisionNote: decisionNote.value || null }, t('requests.decided'))
}

const decisionOpen = computed({
  get: () => decision.value !== null,
  set: (value) => {
    if (!value) decision.value = null
  },
})

const moreItems = computed<DropdownMenuItem[]>(() => {
  const items: DropdownMenuItem[] = []
  const s = props.request.status
  if (props.request.kind === 'part' && ['open', 'quoted', 'approved'].includes(s)) {
    items.push({ label: t('requests.markOrdered'), icon: 'i-lucide-truck', onSelect: () => act({ action: 'status', status: 'ordered' }, t('requests.statusChanged')) })
  }
  if (['approved', 'ordered'].includes(s)) {
    items.push({ label: t('requests.markDone'), icon: 'i-lucide-check-check', onSelect: () => act({ action: 'status', status: 'done' }, t('requests.statusChanged')) })
  }
  if (['open', 'quoted', 'approved', 'ordered'].includes(s)) {
    items.push({ label: t('requests.cancel'), icon: 'i-lucide-ban', color: 'error', onSelect: () => act({ action: 'status', status: 'cancelled' }, t('requests.statusChanged')) })
  }
  return items
})
</script>

<template>
  <article class="space-y-3 rounded-lg border border-default p-4">
    <header class="flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1 space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge
            :color="URGENCY_COLOR[request.urgency]"
            variant="solid"
            size="sm"
            :label="$t(`urgency.${request.urgency}`)"
          />
          <h3 class="font-medium">
            {{ request.title }}
          </h3>
        </div>
        <p class="text-xs text-muted">
          {{ $t(`requestKind.${request.kind}`) }}
          · {{ $t('requests.reportedBy', { name: request.reporterName ?? '—' }) }}
          · {{ d(new Date(request.createdAt), 'long') }}
          <template v-if="taskTitle">
            · {{ $t('requests.atTask', { title: taskTitle }) }}
          </template>
        </p>
        <slot name="context" />
      </div>
      <div class="flex shrink-0 flex-col items-end gap-1">
        <UBadge
          :color="WORK_REQUEST_STATUS_COLOR[request.status]"
          variant="subtle"
          :label="$t(`requestStatus.${request.status}`)"
        />
        <UBadge
          v-if="awaitingCustomer"
          color="warning"
          variant="outline"
          size="sm"
          icon="i-lucide-hourglass"
          :label="$t('approvals.waiting')"
        />
      </div>
    </header>

    <p
      v-if="request.description"
      class="whitespace-pre-line text-sm"
    >
      {{ request.description }}
    </p>

    <AttachmentGallery
      v-if="attachments?.length"
      :attachments="attachments"
      compact
    />

    <div
      v-if="permissions.quote && hasQuote"
      class="rounded-md bg-elevated p-3 text-sm"
    >
      <p>
        <template v-if="request.partsNet !== null">
          {{ $t('requests.parts') }}: {{ n(Number(request.partsNet), 'currency') }}
        </template>
        <template v-if="request.partsNet !== null && request.laborNet !== null">
          ·
        </template>
        <template v-if="request.laborNet !== null">
          {{ $t('requests.labor') }}: {{ n(Number(request.laborNet), 'currency') }}
        </template>
        <span class="ms-1 text-muted">({{ $t('requests.netShort') }})</span>
      </p>
      <p class="font-medium">
        {{ $t('requests.total', { net: n(net / 100, 'currency'), gross: n(gross / 100, 'currency') }) }} ({{ $t('requests.vatRate') }} {{ Number(request.vatRate) }}%)
      </p>
      <p
        v-if="request.officeNote"
        class="mt-1 text-muted"
      >
        {{ request.officeNote }}
      </p>
    </div>
    <p
      v-if="request.decisionNote"
      class="text-sm text-muted"
    >
      <UIcon
        name="i-lucide-message-square-quote"
        class="me-1 size-4 align-[-3px]"
      />{{ request.decisionNote }}
    </p>

    <footer
      v-if="!readonly && (permissions.quote || permissions.decide)"
      class="flex flex-wrap items-center gap-2"
    >
      <UButton
        v-if="permissions.quote && pending"
        icon="i-lucide-calculator"
        size="sm"
        :variant="hasQuote ? 'outline' : 'solid'"
        :color="hasQuote ? 'neutral' : 'primary'"
        :label="hasQuote ? $t('requests.requote') : $t('requests.quote')"
        :disabled="busy"
        @click="quoteOpen = true"
      />
      <template v-if="permissions.decide && pending">
        <UTooltip
          :text="$t('requests.needsQuote')"
          :disabled="!approveBlocked"
        >
          <UButton
            icon="i-lucide-check"
            size="sm"
            color="success"
            variant="soft"
            :label="$t('requests.approve')"
            :disabled="busy || approveBlocked"
            @click="openDecision('approved')"
          />
        </UTooltip>
        <UButton
          icon="i-lucide-x"
          size="sm"
          color="neutral"
          variant="soft"
          :label="$t('requests.reject')"
          :disabled="busy"
          @click="openDecision('rejected')"
        />
      </template>
      <UDropdownMenu
        v-if="permissions.quote && moreItems.length"
        :items="moreItems"
      >
        <UButton
          icon="i-lucide-ellipsis"
          size="sm"
          color="neutral"
          variant="ghost"
          :aria-label="$t('common.actions')"
          :disabled="busy"
        />
      </UDropdownMenu>
    </footer>

    <UModal
      v-model:open="quoteOpen"
      :title="`${$t('requests.quoteTitle')}: ${request.title}`"
    >
      <template #body>
        <QuoteForm
          :initial="request"
          :loading="busy"
          @submit="saveQuote"
          @cancel="quoteOpen = false"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="decisionOpen"
      :title="decision === 'approved' ? $t('requests.decideApprove') : $t('requests.decideReject')"
      :description="request.title"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="saveDecision"
        >
          <UFormField
            :label="$t('requests.decisionNote')"
            :help="$t('requests.decisionHint')"
          >
            <UInput
              v-model="decisionNote"
              :placeholder="$t('requests.decisionNotePlaceholder')"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UAlert
            v-if="decision === 'approved' && request.kind === 'extra_work'"
            color="info"
            variant="subtle"
            icon="i-lucide-list-plus"
            :title="$t('requests.approveExtraHint')"
          />
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              :label="$t('common.cancel')"
              @click="decision = null"
            />
            <UButton
              type="submit"
              :color="decision === 'approved' ? 'success' : 'neutral'"
              :loading="busy"
              :label="decision === 'approved' ? $t('requests.approve') : $t('requests.reject')"
            />
          </div>
        </form>
      </template>
    </UModal>
  </article>
</template>
