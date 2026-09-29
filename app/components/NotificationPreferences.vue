<script setup lang="ts">
import type { TeamNotificationType } from '#shared/notifications'

const { t } = useI18n()
const toast = useToast()
const { data, refresh, status, error } = await useFetch('/api/notifications/preferences')
const push = useTeamPush()

onMounted(() => push.check())

const saving = ref<string | null>(null)

async function toggle(type: TeamNotificationType, channel: 'email' | 'push', value: boolean) {
  const row = data.value?.types.find(item => item.type === type)
  if (!row) return
  const before = { email: row.email, push: row.push }
  row[channel] = value
  saving.value = `${type}.${channel}`
  try {
    await $fetch('/api/notifications/preferences', { method: 'PUT', body: { type, email: row.email, push: row.push } })
  }
  catch (err) {
    Object.assign(row, before)
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    saving.value = null
  }
}

async function enablePush() {
  if (!data.value?.push.publicKey) return
  try {
    await push.enable(data.value.push.publicKey)
    toast.add({ title: t('notifications.push.enabledToast'), color: 'success', icon: 'i-lucide-bell-ring' })
    await refresh()
  }
  catch (err) {
    if (push.state.value === 'denied') return
    toast.add({ title: apiErrorMessage(err, t('notifications.push.enableFailed')), color: 'error' })
  }
}

async function disablePush() {
  try {
    await push.disable()
    toast.add({ title: t('notifications.push.disabledToast'), color: 'success', icon: 'i-lucide-bell-off' })
    await refresh()
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
}

const testing = ref(false)
async function testPush() {
  testing.value = true
  try {
    const result = await $fetch('/api/push/test', { method: 'POST' })
    toast.add(result.devices
      ? { title: t('notifications.push.testSent'), color: 'success', icon: 'i-lucide-send' }
      : { title: t('notifications.push.testNoDevices'), color: 'warning' })
  }
  catch (err) {
    toast.add({ title: apiErrorMessage(err, t('common.error')), color: 'error' })
  }
  finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <LoadState
      :error="error"
      :pending="status === 'pending' && !data"
      @retry="refresh()"
    />

    <template v-if="data">
      <UPageCard
        :title="$t('notifications.push.title')"
        :description="$t('notifications.push.hint')"
        icon="i-lucide-smartphone"
      >
        <UAlert
          v-if="!data.push.enabled"
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          :title="$t('notifications.push.serverOff')"
        />
        <UAlert
          v-else-if="push.state.value === 'ios-install'"
          color="info"
          variant="subtle"
          icon="i-lucide-share"
          :title="$t('notifications.push.iosInstallTitle')"
          :description="$t('notifications.push.iosInstall')"
        />
        <UAlert
          v-else-if="push.state.value === 'unsupported'"
          color="warning"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="$t('notifications.push.unsupported')"
        />
        <UAlert
          v-else-if="push.state.value === 'denied'"
          color="warning"
          variant="subtle"
          icon="i-lucide-bell-off"
          :title="$t('notifications.push.deniedTitle')"
          :description="$t('notifications.push.denied')"
        />
        <div
          v-else
          class="flex flex-wrap items-center gap-3"
        >
          <UBadge
            v-if="push.state.value === 'on'"
            color="success"
            variant="subtle"
            size="lg"
            icon="i-lucide-bell-ring"
            :label="$t('notifications.push.enabled')"
          />
          <UBadge
            v-else-if="push.state.value === 'off'"
            color="neutral"
            variant="subtle"
            size="lg"
            icon="i-lucide-bell-off"
            :label="$t('notifications.push.disabled')"
          />
          <UButton
            v-if="push.state.value === 'off'"
            icon="i-lucide-bell-ring"
            :loading="push.busy.value"
            :label="$t('notifications.push.enable')"
            @click="enablePush"
          />
          <template v-if="push.state.value === 'on'">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-send"
              :loading="testing"
              :label="$t('notifications.push.test')"
              @click="testPush"
            />
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-bell-off"
              :loading="push.busy.value"
              :label="$t('notifications.push.disable')"
              @click="disablePush"
            />
          </template>
        </div>
        <p
          v-if="data.push.enabled && data.push.devices"
          class="text-sm text-muted"
        >
          {{ $t('notifications.push.devices', { count: data.push.devices }) }}
        </p>
      </UPageCard>

      <UPageCard
        :title="$t('notifications.prefs.title')"
        :description="$t('notifications.prefs.description')"
        icon="i-lucide-bell"
      >
        <p class="text-sm text-muted">
          {{ data.emailVerified ? $t('notifications.prefs.emailTo', { email: data.email }) : $t('notifications.prefs.emailUnverified') }}
        </p>
        <ul class="divide-y divide-default">
          <li
            v-for="row in data.types"
            :key="row.type"
            class="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div class="flex min-w-0 gap-3">
              <UIcon
                :name="row.icon"
                class="mt-0.5 size-5 shrink-0 text-muted"
              />
              <div class="min-w-0">
                <p class="font-medium">
                  {{ $t(`notifications.types.${row.key}.label`) }}
                </p>
                <p class="text-sm text-muted">
                  {{ $t(`notifications.types.${row.key}.hint`) }}
                </p>
              </div>
            </div>
            <div class="flex flex-wrap gap-x-6 gap-y-1 ps-8 sm:ps-0">
              <USwitch
                :model-value="row.push"
                :disabled="!data.push.enabled || saving === `${row.type}.push`"
                :label="$t('notifications.prefs.push')"
                @update:model-value="value => toggle(row.type, 'push', value)"
              />
              <USwitch
                :model-value="row.email"
                :disabled="saving === `${row.type}.email`"
                :label="$t('notifications.prefs.email')"
                @update:model-value="value => toggle(row.type, 'email', value)"
              />
            </div>
          </li>
        </ul>
        <p class="text-sm text-muted">
          {{ $t('notifications.prefs.inAppAlways') }}
        </p>
      </UPageCard>
    </template>
  </div>
</template>
