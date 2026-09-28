<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { z } from 'zod'
import { FILE_RULES, workRequestCreateSchema, type WorkRequestCreateInput } from '#shared/schemas'
import { URGENCY_COLOR, WORK_REQUEST_KINDS, WORK_REQUEST_URGENCIES, type WorkRequestUrgency } from '#shared/workshop'

type Output = z.output<typeof workRequestCreateSchema>

const props = defineProps<{
  /** Zadania zlecenia do wyboru (pomijane, gdy formularz otwarto przy konkretnym zadaniu). */
  tasks?: { id: string, title: string }[]
  taskId?: string | null
  loading?: boolean
}>()
const emit = defineEmits<{ submit: [data: Output, files: File[]], cancel: [] }>()

const { t } = useI18n()

const state = reactive<WorkRequestCreateInput>({
  kind: 'extra_work',
  title: '',
  description: null,
  urgency: 'recommended',
  taskId: props.taskId ?? null,
  holdTask: false,
})

const kindItems = computed(() => WORK_REQUEST_KINDS.map(value => ({
  value,
  label: t(`requestKind.${value}`),
  description: t(`requestKindHint.${value}`),
})))

const NO_TASK = 'none'
const taskChoice = computed({
  get: () => state.taskId ?? NO_TASK,
  set: (value: string) => {
    state.taskId = value === NO_TASK ? null : value
    if (!state.taskId) state.holdTask = false
  },
})
const taskItems = computed(() => [
  { value: NO_TASK, label: t('requests.noTask') },
  ...(props.tasks ?? []).map(task => ({ value: task.id, label: task.title })),
])

const files = ref<File[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const accept = FILE_RULES.attachment.types.join(',')
function onFiles(event: Event) {
  files.value.push(...((event.target as HTMLInputElement).files ?? []))
  if (fileInput.value) fileInput.value.value = ''
}

function setUrgency(value: WorkRequestUrgency) {
  state.urgency = value
}

function onSubmit(event: FormSubmitEvent<Output>) {
  if (props.loading) return
  emit('submit', event.data, files.value)
}
</script>

<template>
  <UForm
    :schema="workRequestCreateSchema"
    :state="state"
    class="space-y-4"
    @submit="onSubmit"
  >
    <UFormField
      name="kind"
      :label="$t('requests.kind')"
    >
      <URadioGroup
        v-model="state.kind"
        :items="kindItems"
        variant="card"
        :ui="{ fieldset: 'grid gap-2 sm:grid-cols-2' }"
      />
    </UFormField>

    <UFormField
      name="title"
      :label="$t('requests.what')"
      required
    >
      <UInput
        v-model="state.title"
        :placeholder="$t('requests.whatPlaceholder')"
        class="w-full"
        autofocus
      />
    </UFormField>

    <UFormField
      name="description"
      :label="$t('requests.details')"
    >
      <UTextarea
        v-model.nullable="state.description"
        :placeholder="$t('requests.detailsPlaceholder')"
        :rows="2"
        autoresize
        class="w-full"
      />
    </UFormField>

    <UFormField
      name="urgency"
      :label="$t('requests.urgency')"
    >
      <div
        class="grid gap-2 sm:grid-cols-3"
        role="radiogroup"
      >
        <UButton
          v-for="u in WORK_REQUEST_URGENCIES"
          :key="u"
          role="radio"
          :aria-checked="state.urgency === u"
          :color="URGENCY_COLOR[u]"
          :variant="state.urgency === u ? 'solid' : 'outline'"
          block
          class="flex-col items-start gap-0 text-start"
          @click="setUrgency(u)"
        >
          <span class="font-semibold">{{ $t(`urgency.${u}`) }}</span>
          <span class="text-xs font-normal opacity-90">{{ $t(`urgencyHint.${u}`) }}</span>
        </UButton>
      </div>
    </UFormField>

    <UFormField
      v-if="tasks?.length"
      name="taskId"
      :label="$t('requests.task')"
    >
      <USelect
        v-model="taskChoice"
        :items="taskItems"
        class="w-full"
      />
    </UFormField>

    <UFormField
      v-if="state.taskId"
      name="holdTask"
    >
      <UCheckbox
        v-model="state.holdTask"
        :label="$t('requests.hold')"
        :description="$t('requests.holdHint')"
      />
    </UFormField>

    <UFormField
      :label="$t('requests.photos')"
      :help="$t('requests.photosHint')"
    >
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        multiple
        :accept="accept"
        @change="onFiles"
      >
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          icon="i-lucide-camera"
          color="neutral"
          variant="outline"
          size="sm"
          :label="$t('attachments.add')"
          @click="fileInput?.click()"
        />
        <span
          v-for="(file, index) in files"
          :key="`${file.name}-${index}`"
          class="inline-flex items-center gap-1 rounded-full bg-elevated py-0.5 ps-2 pe-1 text-xs"
        >
          {{ file.name }}
          <button
            type="button"
            class="inline-flex rounded-full p-0.5 text-muted hover:bg-accented"
            :aria-label="$t('common.delete')"
            @click="files.splice(index, 1)"
          >
            <UIcon
              name="i-lucide-x"
              class="size-3"
            />
          </button>
        </span>
      </div>
    </UFormField>

    <div class="flex justify-end gap-2">
      <UButton
        color="neutral"
        variant="ghost"
        :label="$t('common.cancel')"
        @click="emit('cancel')"
      />
      <UButton
        type="submit"
        icon="i-lucide-send"
        :loading="loading"
        :label="$t('requests.send')"
      />
    </div>
  </UForm>
</template>
