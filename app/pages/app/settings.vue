<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { orgSettingsSchema, type OrgSettingsInput } from '#shared/schemas'

const { t } = useI18n()
const toast = useToast()
const { data: me } = await useMe()
const { data: settings, refresh } = await useFetch('/api/org/settings')

const canEdit = computed(() => !!me.value?.activeOrganization?.can.updateSettings)
const canEditCompany = computed(() => canEdit.value && !!me.value?.activeOrganization?.can.updateBilling)

const state = reactive<OrgSettingsInput>({
  assignmentPolicy: 'office',
  smsSenderName: null,
  timezone: 'Europe/Warsaw',
  locale: 'pl',
  logoFileId: null,
})
watchEffect(() => {
  if (!settings.value) return
  Object.assign(state, {
    assignmentPolicy: settings.value.assignmentPolicy,
    smsSenderName: settings.value.smsSenderName,
    timezone: settings.value.timezone,
    locale: settings.value.locale as OrgSettingsInput['locale'],
    logoFileId: settings.value.logoFileId,
  })
})

const policyItems = computed(() => (['office', 'self', 'mixed'] as const).map(value => ({ value, label: t(`settings.policy.${value}`) })))
const timezoneItems = ['Europe/Warsaw', 'Europe/Vilnius', 'Europe/Berlin', 'Europe/Prague', 'Europe/Bratislava', 'Europe/Kyiv', 'UTC']
const localeItems = [{ value: 'pl', label: 'Polski' }, { value: 'en', label: 'English' }]

// ── Logo: wysyłka bezpośrednio do magazynu S3 przez podpisany adres ──
const logoFile = ref<File | null | undefined>(null)
const logoPreview = ref<string | null>(null)
const uploading = ref(false)
const shownLogo = computed(() => logoPreview.value ?? settings.value?.logoUrl ?? null)

watch(logoFile, async (file) => {
  if (!file) return
  uploading.value = true
  try {
    const upload = await $fetch('/api/files/upload-url', {
      method: 'POST',
      body: { fileName: file.name, contentType: file.type, sizeBytes: file.size, purpose: 'logo' },
    })
    const response = await fetch(upload.uploadUrl, { method: upload.method, headers: upload.headers, body: file })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await $fetch(`/api/files/${upload.fileId}/complete`, { method: 'POST' })
    state.logoFileId = upload.fileId
    logoPreview.value = URL.createObjectURL(file)
  }
  catch (error) {
    toast.add({ title: t('settings.uploadFailed'), description: apiErrorMessage(error, ''), color: 'error' })
  }
  finally {
    uploading.value = false
    logoFile.value = null
  }
})

const saving = ref(false)
async function onSubmit(event: FormSubmitEvent<OrgSettingsInput>) {
  saving.value = true
  try {
    await $fetch('/api/org/settings', { method: 'PUT', body: event.data })
    await refresh()
    toast.add({ title: t('common.saved'), color: 'success', icon: 'i-lucide-check' })
  }
  catch (error) {
    toast.add({ title: apiErrorMessage(error, t('common.error')), color: 'error' })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="settings">
    <template #header>
      <UDashboardNavbar :title="$t('settings.title')" />
    </template>

    <template #body>
      <UPageCard
        :title="$t('settings.general')"
        class="max-w-2xl"
      >
        <UAlert
          v-if="!canEdit"
          class="mb-4"
          color="neutral"
          variant="subtle"
          icon="i-lucide-eye"
          :title="$t('settings.readOnly')"
        />
        <UForm
          :schema="orgSettingsSchema"
          :state="state"
          :disabled="!canEdit"
          class="space-y-5"
          @submit="onSubmit"
        >
          <UFormField
            :label="$t('settings.logo')"
            :help="$t('settings.logoHint')"
            name="logoFileId"
          >
            <div class="flex items-center gap-4">
              <img
                v-if="shownLogo"
                :src="shownLogo"
                alt="Logo"
                class="size-16 rounded-md object-contain border border-default bg-elevated"
              >
              <UFileUpload
                v-model="logoFile"
                accept="image/png,image/jpeg,image/webp"
                :label="uploading ? $t('settings.uploading') : $t('settings.logo')"
                :disabled="!canEdit || uploading"
                layout="list"
                class="w-64"
              />
            </div>
          </UFormField>

          <UFormField
            :label="$t('settings.assignmentPolicy')"
            name="assignmentPolicy"
          >
            <URadioGroup
              v-model="state.assignmentPolicy"
              :items="policyItems"
            />
          </UFormField>

          <UFormField
            :label="$t('settings.smsSender')"
            :help="$t('settings.smsSenderHint')"
            name="smsSenderName"
          >
            <UInput
              :model-value="state.smsSenderName ?? ''"
              maxlength="11"
              placeholder="AUTOSERWIS"
              class="w-64"
              @update:model-value="(value) => (state.smsSenderName = String(value ?? '') || null)"
            />
          </UFormField>

          <div class="grid sm:grid-cols-2 gap-5">
            <UFormField
              :label="$t('settings.timezone')"
              name="timezone"
            >
              <USelect
                v-model="state.timezone"
                :items="timezoneItems"
                class="w-full"
              />
            </UFormField>
            <UFormField
              :label="$t('settings.locale')"
              name="locale"
            >
              <USelect
                v-model="state.locale"
                :items="localeItems"
                class="w-full"
              />
            </UFormField>
          </div>

          <UButton
            v-if="canEdit"
            type="submit"
            :loading="saving"
            :disabled="uploading"
            :label="$t('common.save')"
          />
        </UForm>
      </UPageCard>

      <CompanyProfileForm :can-edit="canEditCompany" />
    </template>
  </UDashboardPanel>
</template>
