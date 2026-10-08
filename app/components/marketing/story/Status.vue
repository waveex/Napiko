<script setup lang="ts">
/**
 * Strona statusu naprawy na ekranie telefonu klienta (odwzorowanie /s/<token>): etapy, postęp prac,
 * komunikaty i kontakt do warsztatu. Bez cen i notatek, telefon zamaskowany, tak jak w prawdziwej aplikacji.
 */
const props = withDefaults(defineProps<{
  /** aktualny etap: 0 przyjęty, 1 w naprawie, 2 gotowy do odbioru, 3 odebrany */
  step: 0 | 1 | 2 | 3
  /** zrobione zadania z trzech (animowane) */
  done?: number
  /** komunikat „warsztat czeka na Twoją decyzję” */
  waiting?: boolean
  /** przesunięcie treści w górę (em) – symuluje przewijanie ekranu */
  scroll?: number
  /** pokazuje kartę powiadomień (push zamiast SMS) */
  settings?: boolean
  /** postęp włączania powiadomień 0–1 (przełącznik) */
  pushOn?: boolean
  /** ostatni komunikat: wiersz „kontakt” */
  contact?: boolean
}>(), { done: 2, waiting: false, scroll: 0, settings: false, pushOn: false, contact: true })

const steps = ['received', 'in_progress', 'ready', 'closed'] as const
const icons = ['i-lucide-clipboard-check', 'i-lucide-wrench', 'i-lucide-flag', 'i-lucide-car-front']
function state(i: number) {
  return i < props.step || props.step === 3 ? 'done' : i === props.step ? 'current' : 'todo'
}
</script>

<template>
  <div
    class="sc-page"
    :style="{ '--sc-scroll': scroll }"
  >
    <div class="sc-page-inner">
      <header class="sc-card sc-card-accent">
        <p class="sc-sub">
          {{ $t('marketing.scene.from') }}
        </p>
        <p class="sc-strong">
          {{ $t('marketing.scene.shop') }}
        </p>
        <h4 class="sc-title">
          {{ $t('marketing.scene.status.title') }}
        </h4>
        <p class="sc-line">
          <UIcon
            name="i-lucide-car"
            class="size-3.5"
          />
          <b>{{ $t('marketing.scene.vehicle') }}</b>
          <span class="sc-plate">{{ $t('marketing.scene.plate') }}</span>
        </p>
        <p class="sc-sub">
          {{ $t('marketing.scene.status.order', { number: $t('marketing.scene.order') }) }}
        </p>
      </header>

      <div
        v-if="step === 2"
        class="sc-alert sc-alert-ok"
      >
        <UIcon
          name="i-lucide-flag"
          class="sc-alert-icon"
        />
        <div>
          <p class="sc-strong">
            {{ $t('marketing.scene.status.readyTitle') }}
          </p>
          <p class="sc-sub">
            {{ $t('marketing.scene.status.readyHint') }}
          </p>
        </div>
      </div>
      <div
        v-if="waiting"
        class="sc-alert sc-alert-warn"
      >
        <UIcon
          name="i-lucide-hourglass"
          class="sc-alert-icon"
        />
        <div>
          <p class="sc-strong">
            {{ $t('marketing.scene.status.waiting') }}
          </p>
          <p class="sc-sub">
            {{ $t('marketing.scene.status.waitingHint') }}
          </p>
        </div>
      </div>

      <ol class="sc-card sc-stepper">
        <li
          v-for="(key, i) in steps"
          :key="key"
          :data-state="state(i)"
        >
          <span class="sc-stepper-dot">
            <UIcon
              :name="state(i) === 'done' ? 'i-lucide-check' : icons[i]!"
              class="size-3.5"
            />
          </span>
          <div class="min-w-0">
            <p class="sc-strong">
              {{ $t(`marketing.scene.status.steps.${key}`) }}
              <span
                v-if="state(i) === 'current'"
                class="sc-now"
              >{{ $t('marketing.scene.status.now') }}</span>
            </p>
            <div
              v-if="key === 'in_progress' && state(i) === 'current'"
              class="sc-progress-wrap"
            >
              <div class="sc-progress">
                <span :style="{ width: `${(done / 3) * 100}%` }" />
              </div>
              <p class="sc-sub">
                {{ $t('marketing.scene.status.progress', { done, total: 3 }) }}
              </p>
            </div>
          </div>
        </li>
      </ol>

      <div
        v-if="settings"
        class="sc-card"
      >
        <p class="sc-strong">
          {{ $t('marketing.scene.status.notifications') }}
        </p>
        <div class="sc-switch-row">
          <div>
            <p class="sc-strong">
              {{ $t('marketing.scene.status.pushTitle') }}
            </p>
            <p class="sc-sub">
              {{ $t('marketing.scene.status.pushHint') }}
            </p>
          </div>
          <span
            class="sc-switch"
            :data-on="pushOn"
          ><i /></span>
        </div>
        <div class="sc-switch-row">
          <p class="sc-strong">
            SMS
          </p>
          <span
            class="sc-switch"
            :data-on="!pushOn"
          ><i /></span>
        </div>
        <div class="sc-switch-row">
          <p class="sc-strong">
            {{ $t('common.email') }}
          </p>
          <span
            class="sc-switch"
            data-on="true"
          ><i /></span>
        </div>
      </div>

      <slot />

      <div
        v-if="contact"
        class="sc-card"
      >
        <p class="sc-sub">
          {{ $t('marketing.scene.status.contact') }}
        </p>
        <div class="sc-btn-row">
          <span class="sc-btn sc-btn-ghost"><UIcon
            name="i-lucide-phone"
            class="size-3.5"
          />{{ $t('marketing.scene.status.call') }}</span>
          <span class="sc-btn sc-btn-ghost"><UIcon
            name="i-lucide-mail"
            class="size-3.5"
          />{{ $t('marketing.scene.status.mail') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
