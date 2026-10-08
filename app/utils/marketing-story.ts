/**
 * Scenariusze animowanych historii na stronach marketingowych (przewijanie = kolejne kroki naprawy).
 * Tu jest tylko struktura (kolejność kroków, aktor, ikona przesyłki); teksty kroków są w
 * i18n/locales/{pl,en}/marketing.json pod `marketing.<strona>.story.steps.<klucz>`, a sceny ekranów
 * w components/marketing/story/. Test tests/ui/marketing.spec.ts pilnuje kompletności tłumaczeń.
 */

/** Strona, do której trafia informacja w danym kroku (węzeł na torze nad ekranem). */
export type StoryActor = 'mechanic' | 'office' | 'customer' | 'workshop'

export interface StoryStepDef {
  key: string
  actor: StoryActor
  /** Ikona przesyłki, która „leci” do aktora na początku kroku. */
  carry: string
}

/** Pełna naprawa z perspektywy warsztatu: biuro, mechanik, klient. */
export const WORKSHOP_STORY = [
  { key: 'intake', actor: 'office', carry: 'i-lucide-clipboard-list' },
  { key: 'status', actor: 'customer', carry: 'i-lucide-message-square-text' },
  { key: 'work', actor: 'mechanic', carry: 'i-lucide-timer' },
  { key: 'finding', actor: 'mechanic', carry: 'i-lucide-camera' },
  { key: 'quote', actor: 'office', carry: 'i-lucide-calculator' },
  { key: 'consent', actor: 'customer', carry: 'i-lucide-link' },
  { key: 'effect', actor: 'office', carry: 'i-lucide-badge-check' },
  { key: 'pickup', actor: 'customer', carry: 'i-lucide-flag' },
  { key: 'results', actor: 'office', carry: 'i-lucide-chart-column' },
] as const satisfies readonly StoryStepDef[]

/** Ta sama naprawa oczami klienta: wszystko dzieje się na jego telefonie. */
export const CUSTOMER_STORY = [
  { key: 'arrive', actor: 'customer', carry: 'i-lucide-message-square-text' },
  { key: 'status', actor: 'customer', carry: 'i-lucide-wrench' },
  { key: 'alert', actor: 'customer', carry: 'i-lucide-bell-ring' },
  { key: 'decision', actor: 'customer', carry: 'i-lucide-hand-coins' },
  { key: 'sent', actor: 'workshop', carry: 'i-lucide-badge-check' },
  { key: 'push', actor: 'customer', carry: 'i-lucide-bell' },
  { key: 'ready', actor: 'customer', carry: 'i-lucide-flag' },
  { key: 'done', actor: 'customer', carry: 'i-lucide-car-front' },
] as const satisfies readonly StoryStepDef[]

/** Tory nad ekranem: kolejność ma odzwierciedlać obieg informacji (biuro jest pośrodku). */
export const WORKSHOP_STORY_ACTORS = [
  { key: 'mechanic', icon: 'i-lucide-wrench' },
  { key: 'office', icon: 'i-lucide-monitor' },
  { key: 'customer', icon: 'i-lucide-smartphone' },
] as const

export const CUSTOMER_STORY_ACTORS = [
  { key: 'workshop', icon: 'i-lucide-warehouse' },
  { key: 'customer', icon: 'i-lucide-smartphone' },
] as const

/** Płynne wejście 0→1 w przedziale [from, to] postępu kroku (do liczników i pasków). */
export function storyRamp(local: number, from: number, to: number) {
  const x = Math.min(1, Math.max(0, (local - from) / (to - from)))
  return x * x * (3 - 2 * x)
}
