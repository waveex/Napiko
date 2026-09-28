<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { z } from 'zod'
import { customerSchema, type CustomerInput } from '#shared/schemas'
import { CUSTOMER_KINDS } from '#shared/workshop'

type Output = z.output<typeof customerSchema>

const props = defineProps<{
  initial?: Partial<CustomerInput>
  submitLabel: string
  loading?: boolean
}>()
const emit = defineEmits<{ submit: [data: Output], cancel: [] }>()

const { t } = useI18n()

const state = reactive<CustomerInput>({
  kind: 'person',
  name: '',
  taxId: null,
  email: null,
  phone: null,
  notes: null,
  ...props.initial,
})

const kindItems = computed(() => CUSTOMER_KINDS.map(value => ({ value, label: t(`customerKind.${value}`) })))

function onSubmit(event: FormSubmitEvent<Output>) {
  // NIP zapisujemy tylko dla firm
  emit('submit', event.data.kind === 'company' ? event.data : { ...event.data, taxId: null })
}
</script>

<template>
  <UForm
    :schema="customerSchema"
    :state="state"
    class="space-y-4"
    @submit="onSubmit"
  >
    <UFormField
      name="kind"
      :label="$t('customers.kind')"
    >
      <URadioGroup
        v-model="state.kind"
        :items="kindItems"
        orientation="horizontal"
      />
    </UFormField>

    <UFormField
      name="name"
      :label="state.kind === 'company' ? $t('customers.companyName') : $t('customers.personName')"
      required
    >
      <UInput
        v-model="state.name"
        autocomplete="off"
        class="w-full"
        autofocus
      />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        name="phone"
        :label="$t('customers.phone')"
      >
        <UInput
          v-model.nullable="state.phone"
          type="tel"
          autocomplete="off"
          placeholder="+48 600 100 200"
          class="w-full"
        />
      </UFormField>
      <UFormField
        name="email"
        :label="$t('customers.email')"
      >
        <UInput
          v-model.nullable="state.email"
          type="email"
          autocomplete="off"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField
      v-if="state.kind === 'company'"
      name="taxId"
      :label="$t('customers.taxId')"
    >
      <UInput
        v-model.nullable="state.taxId"
        autocomplete="off"
        class="w-full"
      />
    </UFormField>

    <UFormField
      name="notes"
      :label="$t('customers.notes')"
      :help="$t('customers.notesHint')"
    >
      <UTextarea
        v-model.nullable="state.notes"
        :rows="2"
        autoresize
        class="w-full"
      />
    </UFormField>

    <p class="text-xs text-muted">
      {{ $t('customers.privacyNote') }}
    </p>

    <div class="flex justify-end gap-2">
      <UButton
        color="neutral"
        variant="ghost"
        :label="$t('common.cancel')"
        @click="emit('cancel')"
      />
      <UButton
        type="submit"
        :loading="loading"
        :label="submitLabel"
      />
    </div>
  </UForm>
</template>
