<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { companyProfileSchema, type CompanyProfileInput } from '#shared/schemas'
import { formatIban, formatTaxId, VAT_RATES } from '#shared/workshop'
import type { z } from 'zod'

const props = defineProps<{ canEdit: boolean }>()

const { t } = useI18n()
const toast = useToast()
const { data: profile, refresh } = await useFetch('/api/org/company')

const state = reactive<CompanyProfileInput>({
  legalName: null,
  taxId: null,
  street: null,
  postalCode: null,
  city: null,
  country: 'PL',
  phone: null,
  email: null,
  website: null,
  bankAccount: null,
  laborRateNet: null,
  defaultVatRate: 23,
  documentFooter: null,
})

watchEffect(() => {
  const p = profile.value
  if (!p) return
  Object.assign(state, {
    legalName: p.legalName,
    taxId: p.taxId ? formatTaxId(p.taxId) : null,
    street: p.street,
    postalCode: p.postalCode,
    city: p.city,
    country: p.country,
    phone: p.phone,
    email: p.email,
    website: p.website,
    bankAccount: p.bankAccount ? formatIban(p.bankAccount) : null,
    laborRateNet: p.laborRateNet === null ? null : Number(p.laborRateNet),
    defaultVatRate: Number(p.defaultVatRate),
    documentFooter: p.documentFooter,
  })
})

const vatItems = VAT_RATES.map(rate => ({ value: rate as number, label: `${rate}%` }))
const money = { minimumFractionDigits: 2, maximumFractionDigits: 2 }

const saving = ref(false)
async function onSubmit(event: FormSubmitEvent<z.output<typeof companyProfileSchema>>) {
  saving.value = true
  try {
    await $fetch('/api/org/company', { method: 'PUT', body: event.data })
    await refresh()
    toast.add({ title: t('settings.company.saved'), color: 'success', icon: 'i-lucide-check' })
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
  <UPageCard
    :title="$t('settings.company.title')"
    :description="$t('settings.company.description')"
    class="max-w-2xl"
  >
    <UAlert
      v-if="!props.canEdit"
      color="neutral"
      variant="subtle"
      icon="i-lucide-eye"
      :title="$t('settings.company.readOnly')"
    />
    <UForm
      :schema="companyProfileSchema"
      :state="state"
      :disabled="!props.canEdit"
      class="space-y-5"
      @submit="onSubmit"
    >
      <UFormField
        :label="$t('settings.company.legalName')"
        name="legalName"
      >
        <UInput
          v-model.nullable="state.legalName"
          :placeholder="$t('settings.company.legalNamePlaceholder')"
          class="w-full"
        />
      </UFormField>

      <UFormField
        :label="$t('settings.company.taxId')"
        :help="$t('settings.company.taxIdHint')"
        name="taxId"
      >
        <UInput
          v-model.nullable="state.taxId"
          inputmode="numeric"
          placeholder="123-456-32-18"
          class="w-64"
        />
      </UFormField>

      <UFormField
        :label="$t('settings.company.street')"
        name="street"
      >
        <UInput
          v-model.nullable="state.street"
          autocomplete="street-address"
          class="w-full"
        />
      </UFormField>
      <div class="grid gap-5 sm:grid-cols-[10rem_1fr_6rem]">
        <UFormField
          :label="$t('settings.company.postalCode')"
          name="postalCode"
        >
          <UInput
            v-model.nullable="state.postalCode"
            autocomplete="postal-code"
            placeholder="15-001"
            class="w-full"
          />
        </UFormField>
        <UFormField
          :label="$t('settings.company.city')"
          name="city"
        >
          <UInput
            v-model.nullable="state.city"
            autocomplete="address-level2"
            class="w-full"
          />
        </UFormField>
        <UFormField
          :label="$t('settings.company.country')"
          name="country"
        >
          <UInput
            v-model="state.country"
            maxlength="2"
            class="w-full uppercase"
          />
        </UFormField>
      </div>

      <div class="grid gap-5 sm:grid-cols-2">
        <UFormField
          :label="$t('settings.company.phone')"
          name="phone"
        >
          <UInput
            v-model.nullable="state.phone"
            type="tel"
            class="w-full"
          />
        </UFormField>
        <UFormField
          :label="$t('settings.company.email')"
          name="email"
        >
          <UInput
            v-model.nullable="state.email"
            type="email"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField
        :label="$t('settings.company.website')"
        name="website"
      >
        <UInput
          v-model.nullable="state.website"
          placeholder="www.warsztat.pl"
          class="w-full"
        />
      </UFormField>

      <UFormField
        :label="$t('settings.company.bankAccount')"
        :help="$t('settings.company.bankAccountHint')"
        name="bankAccount"
      >
        <UInput
          v-model.nullable="state.bankAccount"
          inputmode="numeric"
          class="w-full font-mono"
        />
      </UFormField>

      <div class="grid gap-5 sm:grid-cols-2">
        <UFormField
          :label="$t('settings.company.laborRate')"
          :help="$t('settings.company.laborRateHint')"
          name="laborRateNet"
        >
          <UInputNumber
            v-model="state.laborRateNet"
            :min="0"
            :step="0.01"
            :format-options="money"
            :increment="false"
            :decrement="false"
            class="w-full"
          />
        </UFormField>
        <UFormField
          :label="$t('settings.company.defaultVat')"
          name="defaultVatRate"
        >
          <USelect
            v-model="state.defaultVatRate"
            :items="vatItems"
            class="w-32"
          />
        </UFormField>
      </div>

      <UFormField
        :label="$t('settings.company.footer')"
        :help="$t('settings.company.footerHint')"
        name="documentFooter"
      >
        <UTextarea
          v-model.nullable="state.documentFooter"
          :rows="2"
          autoresize
          :placeholder="$t('settings.company.footerPlaceholder')"
          class="w-full"
        />
      </UFormField>

      <UButton
        v-if="props.canEdit"
        type="submit"
        :loading="saving"
        :label="$t('common.save')"
      />
    </UForm>
  </UPageCard>
</template>
