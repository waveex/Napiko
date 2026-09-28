<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const { t } = useI18n()
const route = useRoute()

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(3).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t('org.slugHint')),
  kind: z.enum(['workshop', 'solo']),
})
type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  name: '',
  slug: '',
  kind: route.query.kind === 'solo' ? 'solo' : 'workshop',
})

// Identyfikator z nazwy: bez polskich znaków, małe litery, myślniki.
const slugTouched = ref(false)
function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
watch(() => state.name, (name) => {
  if (!slugTouched.value) state.slug = slugify(name)
})

const kindItems = computed(() => (['workshop', 'solo'] as const).map(value => ({
  value,
  label: t(`org.kind.${value}`),
  description: t(`org.kindDescription.${value}`),
})))

const loading = ref(false)
const errorMessage = ref<string | null>(null)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  errorMessage.value = null
  const { data, error } = await authClient.organization.create({
    name: event.data.name,
    slug: event.data.slug,
    kind: event.data.kind,
  })
  if (error || !data) {
    loading.value = false
    errorMessage.value = error?.code === 'ORGANIZATION_ALREADY_EXISTS' || error?.status === 400
      ? t('org.slugTaken')
      : (error?.message || t('common.error'))
    return
  }
  await switchOrganization(data.id, '/app')
}
</script>

<template>
  <UDashboardPanel id="organization-new">
    <template #header>
      <UDashboardNavbar :title="$t('org.newTitle')" />
    </template>

    <template #body>
      <UPageCard
        :title="$t('org.newTitle')"
        :description="$t('org.newDescription')"
        class="max-w-xl"
      >
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-5"
          @submit="onSubmit"
        >
          <UFormField
            :label="$t('org.kindLabel')"
            name="kind"
          >
            <URadioGroup
              v-model="state.kind"
              :items="kindItems"
              variant="card"
            />
          </UFormField>
          <UFormField
            :label="$t('org.nameLabel')"
            name="name"
            required
          >
            <UInput
              v-model="state.name"
              class="w-full"
              placeholder="Auto Serwis Kowalski"
              autofocus
            />
          </UFormField>
          <UFormField
            :label="$t('org.slugLabel')"
            name="slug"
            :help="$t('org.slugHint')"
            required
          >
            <UInput
              v-model="state.slug"
              class="w-full"
              @input="slugTouched = true"
            />
          </UFormField>
          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="errorMessage"
          />
          <UButton
            type="submit"
            :loading="loading"
            :label="$t('org.create')"
          />
        </UForm>
      </UPageCard>
    </template>
  </UDashboardPanel>
</template>
