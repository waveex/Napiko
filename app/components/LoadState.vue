<script setup lang="ts">
defineProps<{ error?: unknown, pending?: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <UAlert
    v-if="error"
    color="error"
    variant="subtle"
    icon="i-lucide-wifi-off"
    :title="$t('ui.loadFailed')"
    :description="$t('ui.loadFailedHint')"
  >
    <template #actions>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        :label="$t('ui.retry')"
        :loading="pending"
        @click="$emit('retry')"
      />
    </template>
  </UAlert>
  <div
    v-else-if="pending"
    role="status"
    class="napiko-surface space-y-4 p-6"
  >
    <p class="text-muted">
      {{ $t('ui.loading') }}
    </p>
    <USkeleton class="h-6 w-2/3" /><USkeleton class="h-16 w-full" />
  </div>
</template>
