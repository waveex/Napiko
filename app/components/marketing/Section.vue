<script setup lang="ts">
/** Sekcja strony marketingowej: nagłówek (nadtytuł, tytuł, opis) i treść w kontenerze. */
withDefaults(defineProps<{
  id?: string
  eyebrow?: string
  title?: string
  description?: string
  tone?: 'default' | 'muted' | 'brand'
  align?: 'start' | 'center'
}>(), { id: undefined, eyebrow: undefined, title: undefined, description: undefined, tone: 'default', align: 'start' })
</script>

<template>
  <section
    :id="id"
    class="mk-section"
    :data-tone="tone"
  >
    <UContainer>
      <header
        v-if="title || eyebrow"
        v-reveal
        class="mk-section-head"
        :data-align="align"
      >
        <p
          v-if="eyebrow"
          class="mk-eyebrow"
        >
          {{ eyebrow }}
        </p>
        <h2
          v-if="title"
          class="mk-h2"
        >
          {{ title }}
        </h2>
        <p
          v-if="description"
          class="mk-lead"
        >
          {{ description }}
        </p>
      </header>
      <slot />
    </UContainer>
  </section>
</template>
