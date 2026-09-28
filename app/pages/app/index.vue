<script setup lang="ts">
const { t } = useI18n()
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
</script>

<template>
  <UDashboardPanel id="dashboard">
    <template #header>
      <UDashboardNavbar :title="$t('nav.dashboard')" />
    </template>

    <template #body>
      <div class="w-full space-y-6">
        <div class="oxy-intro">
          <h2>
            {{ $t('dashboard.welcome', { name: me?.user.name ?? '' }) }}
          </h2>
          <p>{{ $t('ui.homeHint') }}</p>
        </div>

        <template v-if="org">
          <UPageGrid class="lg:grid-cols-2">
            <UPageCard
              :icon="org.kind === 'solo' ? 'i-lucide-user-cog' : 'i-lucide-warehouse'"
              :title="org.name"
              :description="$t('dashboard.activeOrganization')"
            >
              <div class="flex flex-wrap gap-2">
                <UBadge
                  color="neutral"
                  variant="subtle"
                  :label="$t(`org.kind.${org.kind ?? 'workshop'}`)"
                />
                <UBadge
                  v-for="role in org.role.split(',')"
                  :key="role"
                  variant="subtle"
                  :label="`${$t('dashboard.yourRole')}: ${$t(`roles.${role}`)}`"
                />
              </div>
            </UPageCard>
            <UPageCard
              v-if="org.can.workOnTasks && !org.can.createOrders"
              icon="i-lucide-wrench"
              :title="$t('dashboard.mechanicTitle')"
              :description="$t('dashboard.mechanicDescription')"
              to="/app/my-tasks"
              spotlight
            />
            <UPageCard
              v-else
              icon="i-lucide-route"
              :title="$t('dashboard.nextStepsTitle')"
              :description="$t('dashboard.nextStepsDescription')"
            >
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-if="org.can.createOrders"
                  to="/app/orders/new"
                  icon="i-lucide-clipboard-plus"
                  :label="$t('orders.new')"
                />
                <UButton
                  v-if="org.can.readOrders"
                  to="/app/orders"
                  icon="i-lucide-kanban"
                  color="neutral"
                  variant="outline"
                  :label="$t('nav.orders')"
                />
                <UButton
                  v-if="org.can.readCustomers"
                  to="/app/customers"
                  icon="i-lucide-contact"
                  color="neutral"
                  variant="outline"
                  :label="$t('nav.customers')"
                />
                <UButton
                  to="/app/team"
                  icon="i-lucide-users"
                  color="neutral"
                  variant="outline"
                  :label="$t('nav.team')"
                />
                <UButton
                  to="/app/settings"
                  icon="i-lucide-settings"
                  color="neutral"
                  variant="outline"
                  :label="$t('nav.settings')"
                />
              </div>
            </UPageCard>
          </UPageGrid>
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
