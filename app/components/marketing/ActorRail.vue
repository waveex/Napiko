<script setup lang="ts">
/**
 * Tor nad ekranem historii: kto uczestniczy w naprawie i dokąd „leci” informacja. Przesyłka (kółko z ikoną)
 * przesuwa się do aktora aktywnego kroku; przejście animuje CSS, więc przewijanie w obie strony działa tak samo.
 */
const props = defineProps<{
  actors: readonly { key: string, icon: string }[]
  active: string
  carry: string
  /** prefiks tłumaczeń etykiet aktorów */
  labels: string
}>()

const position = computed(() => {
  const at = props.actors.findIndex(actor => actor.key === props.active)
  return ((Math.max(at, 0) + 0.5) / props.actors.length) * 100
})
</script>

<template>
  <div
    class="story-rail"
    :style="{ '--rail-cols': actors.length, '--rail-at': `${position}%` }"
  >
    <span
      class="story-rail-line"
      aria-hidden="true"
    />
    <div
      v-for="actor in actors"
      :key="actor.key"
      class="story-actor"
      :data-active="actor.key === active"
    >
      <span class="story-actor-node">
        <UIcon
          :name="actor.icon"
          class="size-5"
        />
      </span>
      <span class="story-actor-label">{{ $t(`${labels}.${actor.key}`) }}</span>
    </div>
    <span
      class="story-packet"
      aria-hidden="true"
    >
      <UIcon
        :key="carry"
        :name="carry"
        class="story-packet-icon size-4"
      />
    </span>
  </div>
</template>
