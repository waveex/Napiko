<script setup lang="ts">
/**
 * Pulpit – najważniejsze sprawy dla roli:
 *  - mechanik: bieżące zadanie z licznikiem, kolejka, czas pracy dziś i zgłoszone potrzeby,
 *  - biuro: sprawy wymagające reakcji, odbiory na dziś, tablica zleceń, zespół przy pracy,
 *  - właściciel: to samo co biuro oraz wyniki miesiąca.
 * Co widać, decydują uprawnienia – sekcje liczy serwer (server/api/dashboard.get.ts).
 */
const { t, locale } = useI18n()
const { data: me } = await useMe()

const org = computed(() => me.value?.activeOrganization ?? null)

const onboarding = computed(() => [
  {
    icon: 'i-lucide-warehouse',
    title: t('dashboard.createWorkshop'),
    description: t('dashboard.createWorkshopDescription'),
    to: { path: '/app/organizations/new', query: { kind: 'workshop' } },
  },
  {
    icon: 'i-lucide-user-cog',
    title: t('dashboard.createSolo'),
    description: t('dashboard.createSoloDescription'),
    to: { path: '/app/organizations/new', query: { kind: 'solo' } },
  },
  {
    icon: 'i-lucide-mail',
    title: t('dashboard.invitedTitle'),
    description: t('dashboard.invitedDescription', { email: me.value?.user.email ?? '' }),
  },
  {
    icon: 'i-lucide-car',
    title: t('dashboard.clientTitle'),
    description: t('dashboard.clientDescription'),
  },
])

const { data, status, error, refresh } = await useDashboard({ immediate: !!org.value })

const serverTime = computed(() => data.value?.serverTime)
const now = useNow(serverTime)
/** Sekundy od pobrania danych – liczniki czasu idą na żywo bez ciągłego odpytywania serwera. */
const sinceFetch = computed(() => (serverTime.value ? Math.max(0, (now.value - new Date(serverTime.value).getTime()) / 1000) : 0))
const reload = () => refresh()

const office = computed(() => data.value?.office ?? null)
/** Widok mechanika: praca przy zadaniach bez części biurowej. */
const mechanicView = computed(() => !!data.value?.mine && !office.value)

const hint = computed(() => {
  if (mechanicView.value) return t('dashboard.hint.mechanic')
  if (data.value?.report) return t('dashboard.hint.owner')
  return t('dashboard.hint.office')
})

/** Dzisiejsza data w strefie czasowej warsztatu (tak samo na serwerze i w przeglądarce). */
const today = computed(() => new Intl.DateTimeFormat(locale.value, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: data.value?.timezone ?? 'Europe/Warsaw',
}).format(now.value))
const roles = computed(() => (org.value?.role ?? '').split(',').filter(Boolean).map(role => t(`roles.${role.trim()}`)).join(', '))

// Konfiguracja warsztatu: lista kroków znika po uzupełnieniu albo po ukryciu (zapamiętane dla organizacji)
const setupHidden = useCookie<boolean>(`napiko_setup_hidden_${org.value?.id ?? 'none'}`, {
  default: () => false,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const setup = computed(() => {
  const value = data.value?.setup
  return value && value.completed < value.total && !setupHidden.value ? value : null
})

// Odświeżanie w tle i po powrocie do karty – mechanik mógł zakończyć zadanie, klient odpowiedzieć
function refreshIfVisible() {
  if (org.value && document.visibilityState === 'visible' && status.value !== 'pending') refresh()
}
let poll: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  poll = setInterval(refreshIfVisible, 60_000)
  document.addEventListener('visibilitychange', refreshIfVisible)
})
onBeforeUnmount(() => {
  clearInterval(poll)
  document.removeEventListener('visibilitychange', refreshIfVisible)
})
</script>

<template>
  <UDashboardPanel id="dashboard">
    <template #header>
      <UDashboardNavbar :title="$t('nav.dashboard')">
        <template #right>
          <UButton
            v-if="org"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            :loading="status === 'pending'"
            :aria-label="$t('ui.refresh')"
            @click="refresh()"
          />
          <UButton
            v-if="org?.can.createOrders"
            to="/app/orders/new"
            icon="i-lucide-plus"
            :label="$t('orders.new')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full space-y-8">
        <div class="napiko-intro">
          <h2>
            {{ $t('dashboard.welcome', { name: me?.user.name ?? '' }) }}
          </h2>
          <p v-if="org && data">
            {{ hint }}
          </p>
          <p v-else-if="!org">
            {{ $t('ui.homeHint') }}
          </p>
          <p
            v-if="org"
            class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
          >
            <span
              v-if="data"
              class="first-letter:uppercase"
            >{{ today }}</span>
            <span
              v-if="data"
              aria-hidden="true"
            >·</span>
            <span class="font-medium text-default">{{ org.name }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ roles }}</span>
          </p>
        </div>

        <template v-if="org">
          <LoadState
            :error="error"
            :pending="status === 'pending' && !data"
            @retry="refresh()"
          />

          <template v-if="data">
            <DashboardSetup
              v-if="setup"
              :setup="setup"
              @hide="setupHidden = true"
            />

            <DashboardMyWork
              v-if="mechanicView && data.mine"
              :mine="data.mine"
              :now="now"
              :since-fetch="sinceFetch"
              :refresh="reload"
            />

            <template v-if="office">
              <DashboardWorkBanner
                v-if="data.mine"
                :mine="data.mine"
                :now="now"
                :since-fetch="sinceFetch"
                :refresh="reload"
              />

              <DashboardAttention
                :office="office"
                :now="now"
              />

              <DashboardSection
                :title="$t('dashboard.workshop.title')"
                :description="$t('dashboard.workshop.description')"
              >
                <div class="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  <DashboardToday :today="office.today" />
                  <DashboardBoard :board="office.board" />
                  <DashboardTeam
                    v-if="data.team"
                    :team="data.team"
                    :now="now"
                    :since-fetch="sinceFetch"
                  />
                </div>
              </DashboardSection>

              <DashboardReport
                v-if="data.report"
                :report="data.report"
              />
            </template>
          </template>
        </template>

        <template v-else>
          <h2 class="text-lg font-medium">
            {{ $t('dashboard.onboardingTitle') }}
          </h2>
          <UPageGrid class="lg:grid-cols-2">
            <UPageCard
              v-for="item in onboarding"
              :key="item.title"
              :icon="item.icon"
              :title="item.title"
              :description="item.description"
              :to="item.to"
              :spotlight="!!item.to"
            />
          </UPageGrid>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
