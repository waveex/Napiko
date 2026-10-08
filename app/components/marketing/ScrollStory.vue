<script setup lang="ts">
/**
 * Historia sterowana przewijaniem. Sekcja jest wysoka, a jej środek (`sticky`) zostaje na ekranie:
 * w miarę przewijania zmienia się krok (lista po lewej / podpis pod ekranem na telefonie) i scena ekranu
 * (slot `stage`, dostaje numer kroku i postęp 0–1 wewnątrz kroku). Scena jest dekoracją (`aria-hidden`),
 * cała treść kroków jest w tekście, więc czytnik ekranu i wyszukiwarka dostają komplet informacji.
 */
import type { StoryActor } from '~/utils/marketing-story'

export interface StoryStepView {
  key: string
  actor: StoryActor
  carry: string
  tag: string
  title: string
  text: string
  proof?: string
}

const props = defineProps<{
  steps: readonly StoryStepView[]
  actors: readonly { key: string, icon: string }[]
  /** prefiks tłumaczeń etykiet aktorów, np. marketing.story.actors */
  actorLabels: string
  label: string
  note?: string
  id?: string
}>()

const track = ref<HTMLElement | null>(null)
const sticky = ref<HTMLElement | null>(null)
const { index, local, progress, scrollToStep } = useScrollStory(track, sticky, () => props.steps.length)

const current = computed(() => props.steps[index.value]!)
</script>

<template>
  <section
    :id="id"
    ref="track"
    class="story"
    :style="{ '--story-steps': steps.length, '--story-progress': progress }"
    :aria-label="label"
  >
    <div
      ref="sticky"
      class="story-sticky"
    >
      <div
        class="story-bar"
        aria-hidden="true"
      />
      <UContainer class="story-grid">
        <div class="story-copy">
          <slot name="intro" />
          <ol class="story-steps">
            <li
              v-for="(step, i) in steps"
              :key="step.key"
              class="story-step"
              :data-state="i === index ? 'active' : i < index ? 'done' : 'todo'"
              :aria-current="i === index ? 'step' : undefined"
            >
              <button
                type="button"
                class="story-step-btn"
                @click="scrollToStep(i)"
              >
                <span class="story-step-n">
                  <UIcon
                    v-if="i < index"
                    name="i-lucide-check"
                    class="size-4"
                  />
                  <template v-else>{{ i + 1 }}</template>
                </span>
                <span class="story-step-title">{{ step.title }}</span>
              </button>
              <div class="story-step-body">
                <div>
                  <p class="story-tag">
                    {{ step.tag }}
                  </p>
                  <p class="story-text">
                    {{ step.text }}
                  </p>
                  <p
                    v-if="step.proof"
                    class="story-proof"
                  >
                    <UIcon
                      name="i-lucide-shield-check"
                      class="size-4 shrink-0"
                    />
                    <span>{{ step.proof }}</span>
                  </p>
                </div>
              </div>
            </li>
          </ol>
        </div>

        <div class="story-stage">
          <MarketingActorRail
            :actors="actors"
            :active="current.actor"
            :carry="current.carry"
            :labels="actorLabels"
          />
          <div
            class="story-device-area"
            aria-hidden="true"
          >
            <slot
              name="stage"
              :index="index"
              :local="local"
              :progress="progress"
            />
          </div>
          <p
            v-if="note"
            class="story-note"
          >
            {{ note }}
          </p>
        </div>

        <div
          class="story-caption"
          aria-live="polite"
        >
          <p class="story-tag">
            {{ $t('marketing.story.stepOf', { n: index + 1, total: steps.length }) }} · {{ current.tag }}
          </p>
          <h3 class="story-caption-title">
            {{ current.title }}
          </h3>
          <p class="story-text">
            {{ current.text }}
          </p>
          <div class="story-dots">
            <button
              v-for="(step, i) in steps"
              :key="step.key"
              type="button"
              class="story-dot"
              :data-state="i === index ? 'active' : i < index ? 'done' : 'todo'"
              :aria-label="step.title"
              :aria-current="i === index ? 'step' : undefined"
              @click="scrollToStep(i)"
            />
          </div>
        </div>
      </UContainer>
    </div>
  </section>
</template>
