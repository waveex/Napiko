<script setup lang="ts">
import { toCents, URGENCY_COLOR, VEHICLE_TYPE_INFO, type VehicleType } from '#shared/workshop'

definePageMeta({ layout: 'public' })
useHead({
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
  ],
})

const route = useRoute()
const token = route.params.token as string
const { t, n, d } = useI18n()
const toast = useToast()

// Tylko w przeglądarce: podglądy linków w komunikatorach nie oznaczą prośby jako otwartej
const { data, error, status, refresh } = useFetch(`/api/public/approvals/${token}`, { server: false })

type Snapshot = NonNullable<typeof data.value>['snapshot']
type RequestSnapshot = Extract<Snapshot, { items: unknown }>
type EstimateSnapshot = Extract<Snapshot, { kind: 'estimate' }>
type Item = RequestSnapshot['items'][number]

const snapshot = computed(() => data.value?.snapshot ?? null)
/** prace dodatkowe: decyzja przy każdej pozycji */
const requestSnapshot = computed(() => (snapshot.value && 'items' in snapshot.value ? snapshot.value as RequestSnapshot : null))
/** kosztorys: jedna decyzja o całości */
const estimate = computed(() => (snapshot.value?.kind === 'estimate' ? snapshot.value as EstimateSnapshot : null))
const items = computed<Item[]>(() => requestSnapshot.value?.items ?? [])
const choices = reactive<Record<string, 'approved' | 'rejected'>>({})
const estimateChoice = ref<'approved' | 'rejected' | null>(null)
const consent = ref(false)
const note = ref('')
const submitting = ref(false)

const allChosen = computed(() => items.value.length > 0 && items.value.every(item => !!choices[item.requestId]))
const approved = computed(() => items.value.filter(item => choices[item.requestId] === 'approved'))
const approvedTotal = computed(() => approved.value.reduce((sum, item) => sum + item.grossCents, 0))
const canSubmit = computed(() => {
  if (submitting.value) return false
  if (estimate.value) return !!estimateChoice.value && (estimateChoice.value !== 'approved' || consent.value)
  return allChosen.value && (!approved.value.length || consent.value)
})

function qty(value: string) {
  return n(Number(value), { maximumFractionDigits: 3 })
}

const vehicleTitle = computed(() => {
  const v = snapshot.value?.vehicle
  if (!v) return ''
  return [v.make, v.model].filter(Boolean).join(' ') || t(`vehicleType.${v.type}`)
})

/** Brutto osobno dla części i robocizny (suma zgadza się z kwotą pozycji co do grosza). */
function split(item: Item) {
  const partsGross = item.partsNet ? Math.round(toCents(item.partsNet) * (1 + Number(item.vatRate) / 100)) : 0
  return { parts: partsGross, labor: item.grossCents - partsGross }
}

function photosOf(item: Item) {
  return item.attachmentIds
    .map(id => ({ id, ...data.value?.photos[id] }))
    .filter((p): p is { id: string, url: string, contentType: string } => !!p.url)
}

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    await $fetch(`/api/public/approvals/${token}`, {
      method: 'POST',
      body: estimate.value
        ? { decision: estimateChoice.value!, note: note.value || null, consent: estimateChoice.value === 'approved' && consent.value }
        : {
            decisions: items.value.map(item => ({ requestId: item.requestId, decision: choices[item.requestId]! })),
            note: note.value || null,
            consent: consent.value,
          },
    })
    await refresh()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
    await refresh()
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <UContainer class="max-w-2xl py-6 sm:py-10">
    <div
      v-if="status === 'pending' || status === 'idle'"
      class="flex justify-center py-24"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-muted"
      />
    </div>

    <UCard v-else-if="error || !data">
      <UEmpty
        icon="i-lucide-link-2-off"
        :title="$t('approve.invalidTitle')"
        :description="apiErrorMessage(error, $t('approve.invalid'))"
      />
    </UCard>

    <div
      v-else-if="snapshot"
      class="space-y-6"
    >
      <header class="space-y-3">
        <div class="flex items-center gap-3">
          <img
            v-if="data.logoUrl"
            :src="data.logoUrl"
            :alt="snapshot.organization.name"
            class="size-12 rounded-md object-contain"
          >
          <div>
            <p class="text-sm text-muted">
              {{ $t('approve.from') }}
            </p>
            <p class="text-lg font-semibold">
              {{ snapshot.organization.name }}
            </p>
          </div>
        </div>
        <h1 class="text-2xl font-bold">
          {{ estimate ? $t('approve.estimate.title') : $t('approve.title') }}
        </h1>
        <p class="flex flex-wrap items-center gap-2 text-sm">
          <UIcon
            :name="VEHICLE_TYPE_INFO[snapshot.vehicle.type as VehicleType]?.icon ?? 'i-lucide-wrench'"
            class="size-4 text-muted"
          />
          <span class="font-medium">{{ vehicleTitle }}</span>
          <span
            v-if="snapshot.vehicle.registrationNumber"
            class="rounded border border-default bg-default px-1.5 font-mono text-xs leading-5"
          >{{ snapshot.vehicle.registrationNumber }}</span>
          <span class="text-muted">· {{ $t('approve.order', { number: snapshot.order.number }) }}</span>
        </p>
        <blockquote
          v-if="snapshot.message"
          class="rounded-md border-s-4 border-primary bg-default p-3 text-sm whitespace-pre-line"
        >
          {{ snapshot.message }}
        </blockquote>
      </header>

      <UAlert
        v-if="data.preview"
        color="info"
        variant="subtle"
        icon="i-lucide-eye"
        :title="$t('approve.previewTitle')"
        :description="$t('approve.preview')"
      />

      <!-- Odpowiedź wysłana -->
      <UAlert
        v-if="data.status === 'answered'"
        color="success"
        variant="subtle"
        icon="i-lucide-circle-check"
        :title="$t('approve.thanksTitle')"
        :description="$t('approve.thanks', { date: d(new Date(data.answeredAt!), 'long') })"
      />
      <UAlert
        v-else-if="data.status === 'expired'"
        color="warning"
        variant="subtle"
        icon="i-lucide-clock-alert"
        :title="$t('approve.expiredTitle')"
        :description="$t('approve.expired')"
      />
      <UAlert
        v-else-if="data.status === 'cancelled'"
        color="neutral"
        variant="subtle"
        icon="i-lucide-ban"
        :title="$t('approve.cancelledTitle')"
        :description="$t('approve.cancelled')"
      />
      <p
        v-else
        class="text-sm text-muted"
      >
        {{ estimate
          ? $t('approve.estimate.intro', { date: d(new Date(data.expiresAt), 'long') })
          : $t('approve.intro', { date: d(new Date(data.expiresAt), 'long') }) }}
      </p>

      <!-- Kosztorys -->
      <template v-if="estimate">
        <UCard :ui="{ body: 'space-y-4' }">
          <div
            v-if="estimate.organization.legalName || estimate.organization.address || estimate.organization.taxId"
            class="text-xs text-muted"
          >
            <p class="font-medium text-default">
              {{ $t('approve.estimate.issuer') }}: {{ estimate.organization.legalName ?? estimate.organization.name }}
            </p>
            <p v-if="estimate.organization.address">
              {{ estimate.organization.address }}
            </p>
            <p v-if="estimate.organization.taxId">
              {{ $t('approve.estimate.taxId', { taxId: estimate.organization.taxId }) }}
            </p>
            <p v-if="estimate.organization.phone || estimate.organization.email">
              {{ [estimate.organization.phone, estimate.organization.email].filter(Boolean).join(' · ') }}
            </p>
          </div>

          <ul class="divide-y divide-default">
            <li
              v-for="line in estimate.lines"
              :key="line.id"
              class="flex items-start justify-between gap-3 py-3 first:pt-0"
            >
              <div class="min-w-0 space-y-0.5">
                <p class="font-medium">
                  {{ line.name }}
                </p>
                <p class="text-xs text-muted">
                  {{ $t(`estimate.kind.${line.kind}`) }} ·
                  {{ $t('approve.estimate.qty', { quantity: qty(line.quantity), unit: line.unit, price: n(Number(line.unitPriceNet), 'currency') }) }}
                  <template v-if="Number(line.discountPercent)">
                    · {{ $t('approve.estimate.discount', { discount: n(Number(line.discountPercent), { maximumFractionDigits: 2 }) }) }}
                  </template>
                  · {{ $t('approve.estimate.vat', { rate: Number(line.vatRate) }) }}
                </p>
              </div>
              <p class="shrink-0 font-medium tabular-nums">
                {{ n(line.grossCents / 100, 'currency') }}
              </p>
            </li>
          </ul>

          <dl class="ms-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
            <dt class="text-muted">
              {{ $t('approve.estimate.netTotal') }}
            </dt>
            <dd class="text-end tabular-nums">
              {{ n(estimate.totals.netCents / 100, 'currency') }}
            </dd>
            <template
              v-for="row in estimate.totals.byRate"
              :key="row.vatRate"
            >
              <dt class="text-muted">
                {{ $t('approve.estimate.vatByRate', { rate: row.vatRate }) }}
              </dt>
              <dd class="text-end tabular-nums">
                {{ n(row.vatCents / 100, 'currency') }}
              </dd>
            </template>
            <div class="col-span-2 my-1 border-t border-default" />
            <dt class="font-semibold">
              {{ $t('approve.estimate.grossTotal') }}
            </dt>
            <dd class="text-end text-lg font-bold tabular-nums">
              {{ n(estimate.totals.grossCents / 100, 'currency') }}
            </dd>
          </dl>

          <p
            v-if="estimate.footer"
            class="whitespace-pre-line text-xs text-muted"
          >
            {{ estimate.footer }}
          </p>
        </UCard>

        <UBadge
          v-if="data.status === 'answered' && data.decision"
          :color="data.decision === 'approved' ? 'success' : 'neutral'"
          variant="subtle"
          size="lg"
          :icon="data.decision === 'approved' ? 'i-lucide-check' : 'i-lucide-x'"
          :label="data.decision === 'approved' ? $t('approve.estimate.approved') : $t('approve.estimate.rejected')"
        />

        <UCard
          v-if="data.status === 'pending'"
          :ui="{ body: 'space-y-4' }"
        >
          <p class="font-medium">
            {{ $t('approve.estimate.choose') }}
          </p>
          <div class="grid gap-2 sm:grid-cols-2">
            <UButton
              size="lg"
              block
              icon="i-lucide-check"
              :color="estimateChoice === 'approved' ? 'success' : 'neutral'"
              :variant="estimateChoice === 'approved' ? 'solid' : 'outline'"
              :aria-pressed="estimateChoice === 'approved'"
              :label="$t('approve.estimate.approve')"
              @click="estimateChoice = 'approved'"
            />
            <UButton
              size="lg"
              block
              icon="i-lucide-x"
              :color="estimateChoice === 'rejected' ? 'error' : 'neutral'"
              :variant="estimateChoice === 'rejected' ? 'solid' : 'outline'"
              :aria-pressed="estimateChoice === 'rejected'"
              :label="$t('approve.estimate.reject')"
              @click="estimateChoice = 'rejected'"
            />
          </div>
          <UCheckbox
            v-if="estimateChoice === 'approved'"
            v-model="consent"
            :label="$t('approve.estimate.consent', { total: n(estimate.totals.grossCents / 100, 'currency') })"
            :description="$t('approve.estimate.consentHint')"
          />
          <p
            v-else-if="estimateChoice === 'rejected'"
            class="text-sm text-muted"
          >
            {{ $t('approve.estimate.rejectHint') }}
          </p>
          <UFormField :label="$t('approve.note')">
            <UTextarea
              v-model="note"
              :rows="2"
              autoresize
              :placeholder="$t('approve.notePlaceholder')"
              class="w-full"
            />
          </UFormField>
          <UButton
            size="xl"
            block
            icon="i-lucide-send"
            :disabled="!canSubmit"
            :loading="submitting"
            :label="$t('approve.submit')"
            @click="submit"
          />
          <p class="text-xs text-muted">
            {{ $t('approve.legal', { organization: snapshot.organization.name }) }}
          </p>
        </UCard>
      </template>

      <section
        v-if="!estimate"
        class="space-y-4"
      >
        <UCard
          v-for="item in items"
          :key="item.requestId"
          :ui="{ body: 'space-y-3' }"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge
                  :color="URGENCY_COLOR[item.urgency as 'urgent' | 'recommended' | 'later']"
                  variant="solid"
                  size="sm"
                  :label="$t(`urgency.${item.urgency}`)"
                />
                <span class="text-xs text-muted">{{ $t(`requestKind.${item.kind}`) }}</span>
              </div>
              <h2 class="text-lg font-semibold">
                {{ item.title }}
              </h2>
              <p class="text-xs text-muted">
                {{ $t(`urgencyHint.${item.urgency}`) }}
              </p>
            </div>
            <div class="shrink-0 text-end">
              <p class="text-xl font-bold">
                {{ n(item.grossCents / 100, 'currency') }}
              </p>
              <p class="text-xs text-muted">
                {{ $t('approve.gross') }}
              </p>
            </div>
          </div>

          <p
            v-if="item.description"
            class="whitespace-pre-line text-sm"
          >
            {{ item.description }}
          </p>

          <div
            v-if="photosOf(item).length"
            class="grid grid-cols-3 gap-2"
          >
            <a
              v-for="photo in photosOf(item)"
              :key="photo.id"
              :href="photo.url"
              target="_blank"
              rel="noopener noreferrer"
              class="block aspect-square overflow-hidden rounded-md border border-default bg-elevated"
            >
              <img
                v-if="photo.contentType.startsWith('image/')"
                :src="photo.url"
                :alt="item.title"
                loading="lazy"
                class="size-full object-cover"
              >
              <span
                v-else
                class="flex size-full items-center justify-center"
              >
                <UIcon
                  name="i-lucide-circle-play"
                  class="size-8 text-muted"
                />
              </span>
            </a>
          </div>

          <p class="text-xs text-muted">
            <template v-if="split(item).parts">
              {{ $t('approve.parts') }} {{ n(split(item).parts / 100, 'currency') }}
            </template>
            <template v-if="split(item).parts && split(item).labor">
              ·
            </template>
            <template v-if="split(item).labor">
              {{ $t('approve.labor') }} {{ n(split(item).labor / 100, 'currency') }}
            </template>
            ({{ $t('approve.vat', { rate: Number(item.vatRate) }) }})
          </p>

          <!-- Decyzja -->
          <div
            v-if="data.status === 'pending'"
            class="grid grid-cols-2 gap-2"
          >
            <UButton
              size="lg"
              block
              icon="i-lucide-check"
              :color="choices[item.requestId] === 'approved' ? 'success' : 'neutral'"
              :variant="choices[item.requestId] === 'approved' ? 'solid' : 'outline'"
              :aria-pressed="choices[item.requestId] === 'approved'"
              :label="$t('approve.yes')"
              @click="choices[item.requestId] = 'approved'"
            />
            <UButton
              size="lg"
              block
              icon="i-lucide-x"
              :color="choices[item.requestId] === 'rejected' ? 'error' : 'neutral'"
              :variant="choices[item.requestId] === 'rejected' ? 'solid' : 'outline'"
              :aria-pressed="choices[item.requestId] === 'rejected'"
              :label="$t('approve.no')"
              @click="choices[item.requestId] = 'rejected'"
            />
          </div>
          <UBadge
            v-else-if="data.decisions[item.requestId]"
            :color="data.decisions[item.requestId] === 'approved' ? 'success' : 'neutral'"
            variant="subtle"
            size="lg"
            :icon="data.decisions[item.requestId] === 'approved' ? 'i-lucide-check' : 'i-lucide-x'"
            :label="data.decisions[item.requestId] === 'approved' ? $t('approve.approved') : $t('approve.rejected')"
          />
        </UCard>
      </section>

      <!-- Podsumowanie i zgoda -->
      <UCard
        v-if="data.status === 'pending' && !estimate"
        :ui="{ body: 'space-y-4' }"
      >
        <p class="font-medium">
          {{ allChosen
            ? $t('approve.summary', { count: approved.length, total: n(approvedTotal / 100, 'currency') })
            : $t('approve.chooseAll') }}
        </p>
        <UCheckbox
          v-if="approved.length"
          v-model="consent"
          :label="$t('approve.consent', { total: n(approvedTotal / 100, 'currency') })"
          :description="$t('approve.consentHint')"
        />
        <UFormField :label="$t('approve.note')">
          <UTextarea
            v-model="note"
            :rows="2"
            autoresize
            :placeholder="$t('approve.notePlaceholder')"
            class="w-full"
          />
        </UFormField>
        <UButton
          size="xl"
          block
          icon="i-lucide-send"
          :disabled="!canSubmit"
          :loading="submitting"
          :label="$t('approve.submit')"
          @click="submit"
        />
        <p class="text-xs text-muted">
          {{ $t('approve.legal', { organization: snapshot.organization.name }) }}
        </p>
      </UCard>
      <p
        v-else-if="data.customerNote"
        class="text-sm text-muted"
      >
        {{ $t('approve.yourNote') }}: {{ data.customerNote }}
      </p>
    </div>
  </UContainer>
</template>
