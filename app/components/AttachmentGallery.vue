<script setup lang="ts">
interface Attachment {
  id: string
  contentType: string
  fileName: string
  url: string
  caption: string | null
  authorName: string | null
  createdAt: string
  createdBy: string | null
}

const props = defineProps<{
  attachments: Attachment[]
  /** Czy bieżący użytkownik może usunąć dany plik. */
  canDelete?: (attachment: Attachment) => boolean
  compact?: boolean
}>()
const emit = defineEmits<{ remove: [id: string] }>()

const { d } = useI18n()

const selectedId = ref<string | null>(null)
const confirmDelete = ref(false)
watch(selectedId, () => {
  confirmDelete.value = false
})
const selected = computed(() => props.attachments.find(a => a.id === selectedId.value) ?? null)
const open = computed({
  get: () => !!selected.value,
  set: (value) => {
    if (!value) selectedId.value = null
  },
})

const kind = (a: Attachment) => a.contentType.startsWith('image/') ? 'image' : a.contentType.startsWith('video/') ? 'video' : 'file'

function remove(id: string) {
  selectedId.value = null
  emit('remove', id)
}
</script>

<template>
  <div>
    <ul
      class="grid gap-2"
      :class="compact ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5'"
    >
      <li
        v-for="a in attachments"
        :key="a.id"
      >
        <button
          type="button"
          class="group relative block aspect-square w-full overflow-hidden rounded-md border border-default bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
          :title="a.caption ?? a.fileName"
          @click="selectedId = a.id"
        >
          <img
            v-if="kind(a) === 'image'"
            :src="a.url"
            :alt="a.caption ?? a.fileName"
            loading="lazy"
            class="size-full object-cover transition group-hover:scale-105"
          >
          <template v-else-if="kind(a) === 'video'">
            <video
              :src="`${a.url}#t=0.1`"
              preload="metadata"
              muted
              playsinline
              class="size-full object-cover"
            />
            <span class="absolute inset-0 flex items-center justify-center bg-black/25">
              <UIcon
                name="i-lucide-circle-play"
                class="size-8 text-white"
              />
            </span>
          </template>
          <span
            v-else
            class="flex size-full flex-col items-center justify-center gap-1 p-2 text-xs text-muted"
          >
            <UIcon
              name="i-lucide-file-text"
              class="size-6"
            />
            <span class="line-clamp-2 break-all">{{ a.fileName }}</span>
          </span>
        </button>
      </li>
    </ul>

    <UModal
      v-model:open="open"
      :title="selected?.caption ?? selected?.fileName ?? ''"
      :description="selected ? $t('attachments.by', { name: selected.authorName ?? '—', date: d(new Date(selected.createdAt), 'long') }) : undefined"
      :ui="{ content: 'sm:max-w-4xl' }"
    >
      <template #body>
        <template v-if="selected">
          <img
            v-if="kind(selected) === 'image'"
            :src="selected.url"
            :alt="selected.caption ?? selected.fileName"
            class="mx-auto max-h-[70vh] w-auto rounded-md object-contain"
          >
          <video
            v-else-if="kind(selected) === 'video'"
            :src="selected.url"
            controls
            playsinline
            class="mx-auto max-h-[70vh] w-full rounded-md bg-black"
          />
          <ULink
            v-else
            :href="selected.url"
            target="_blank"
            class="inline-flex items-center gap-2"
          >
            <UIcon name="i-lucide-external-link" />
            {{ selected.fileName }}
          </ULink>
        </template>
      </template>
      <template
        v-if="selected && canDelete?.(selected)"
        #footer
      >
        <div class="flex w-full flex-wrap items-center justify-end gap-3">
          <template v-if="confirmDelete">
            <p class="w-full break-words font-medium">
              {{ selected.fileName }} · {{ $t('ui.removeHint') }}
            </p>
            <UButton
              color="neutral"
              variant="outline"
              :label="$t('common.cancel')"
              @click="confirmDelete = false"
            />
          </template>
          <UButton
            color="error"
            variant="soft"
            icon="i-lucide-trash-2"
            :label="$t('attachments.delete')"
            @click="confirmDelete ? remove(selected.id) : (confirmDelete = true)"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
