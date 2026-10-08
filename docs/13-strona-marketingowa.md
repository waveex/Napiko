# Napiko – publiczna strona o produkcie (marketingowa)

Stan: 08.10.2026. Strony pokazują produkt przyszłym klientom: warsztatom (organizacjom) i klientom warsztatów. Treści opierają się na [10-flow-i-funkcje-dla-sprzedazy.md](10-flow-i-funkcje-dla-sprzedazy.md), a granice tego, co wolno obiecywać, opisuje sekcja „Zasady treści”.

## Strony

| Adres | Plik | Paleta | Zawartość |
| --- | --- | --- | --- |
| `/` | `app/pages/index.vue` | warsztat (pomarańcz) | Hero z zapętloną animacją zgody klienta, problem, trzy obietnice, wybór drogi (warsztat / klient), skrót przebiegu naprawy, liczby z aplikacji, zaufanie, „działa obok programu” z planem rozwoju, wezwanie do działania |
| `/dla-warsztatow` (alias `/for-workshops`) | `app/pages/dla-warsztatow.vue` | warsztat | Hero, **animowany przebieg jednej naprawy sterowany przewijaniem (9 kroków)**, role, 19 rodzajów pojazdów, dowód zgody, start w jeden dzień, plan rozwoju, pytania |
| `/dla-klientow` (alias `/for-customers`) | `app/pages/dla-klientow.vue` | klient (fiolet) | Hero, **ta sama naprawa oczami klienta, sterowana przewijaniem (8 kroków)**, gwarancje prywatności, pytania, „pokaż to swojemu warsztatowi” (kopiowanie linku) |
| `/bezpieczenstwo` (alias `/security`) | `app/pages/bezpieczenstwo.vue` | warsztat | Zabezpieczenia działające dziś, dowód zgody, co jeszcze przed nami (RODO, hosting, 2FA), pytania |

Wszystkie używają układu `app/layouts/marketing.vue` (nawigacja, menu mobilne poniżej 1280 px, stopka). Kontekst kolorystyczny wybiera `definePageMeta({ themeContext })`, tak samo jak na stronach `/s/` i `/approve/` (zob. [12-identyfikacja-wizualna.md](12-identyfikacja-wizualna.md)).

## Jak działa animacja sterowana przewijaniem

- `components/marketing/ScrollStory.vue` to wysoka sekcja (`--story-steps` × ok. 62–72 % wysokości ekranu), a jej środek jest `position: sticky`. Przewijanie strony przesuwa kolejne kroki; lista kroków (komputer) albo podpis i kropki (telefon) pokazują, gdzie jesteśmy, a przyciski kroków przewijają do wybranego momentu.
- `composables/useScrollStory.ts` liczy z położenia sekcji postęp 0–1, numer kroku i **postęp wewnątrz kroku** (`local`). Nasłuch `scroll` działa tylko, gdy sekcja jest blisko ekranu (IntersectionObserver), a pomiar jest łączony w `requestAnimationFrame`.
- Sceny ekranów (`components/marketing/story/Workshop.vue` i `Customer.vue`) dostają `index` i `local`. Elementy pojawiają się po przekroczeniu progów (`local >= 0.4`), a liczby rosną płynnie (`storyRamp`), więc **przewijanie w górę cofa animację**. Ekrany odwzorowują prawdziwe: status naprawy (`/s/<token>`), prośbę o zgodę (`/approve/<token>`), „Moje zadania”, „Potrzeby”, pulpit.
- `components/marketing/ActorRail.vue` to tor nad ekranem (mechanik – biuro – klient albo warsztat – ty): „przesyłka” przesuwa się do aktora aktywnego kroku.
- Hero strony głównej (`HeroLoop.vue`) to osobna pętla w czystym CSS (~12 s), niezależna od przewijania.
- Sceny i hero są dekoracją (`aria-hidden`). Cała treść kroków jest w tekście, więc czytnik ekranu i wyszukiwarka dostają komplet informacji. Przy `prefers-reduced-motion` przejścia są natychmiastowe, a pętla w hero zatrzymuje się w stanie końcowym.
- Ekrany w scenach są zawsze jasne i mają własną paletę lokalną (`.mk-screen`), niezależną od trybu jasny/ciemny strony.

## Jak dodać lub zmienić krok

1. `app/utils/marketing-story.ts`: dopisz krok do `WORKSHOP_STORY` albo `CUSTOMER_STORY` (klucz, aktor, ikona przesyłki).
2. `i18n/locales/{pl,en}/marketing.json`: dodaj `marketing.workshops.story.steps.<klucz>` (albo `customers`) z polami `tag`, `title`, `text` i opcjonalnie `proof`.
3. `components/marketing/story/Workshop.vue` lub `Customer.vue`: dodaj gałąź sceny (`v-else-if="index === n"`) na wzór sąsiednich.
4. Uruchom `pnpm test:ui`. Test `tests/ui/marketing.spec.ts` sprawdza zgodność scenariusza z tłumaczeniami w obu językach.

Teksty stron są w `i18n/locales/pl/marketing.json` i `en/marketing.json` (osobno od reszty tłumaczeń, rejestrowane w `nuxt.config.ts` przez `files`). Style: `app/assets/css/theme/marketing.css` (prefiksy `mk-`, `story-`, `sc-`, `hl-`).

## Zasady treści

Strona jest publiczna, więc obowiązują te same granice co w dokumencie 10 (sekcje 7, 9, 11):

- **Cena i warunki pilotażu nie są podawane** (decyzja D8 jest w trakcie walidacji). Nie piszemy „bezpłatnie”, „za darmo” ani kwot jako oferty. Test pilnuje tego w tekstach marketingowych (sceny ekranów mają przykładowe kwoty z kosztorysu).
- **Zgoda klienta:** opisujemy, co zapisujemy (treść, skrót SHA-256, decyzja, czas, adres IP), i dodajemy, że ocenę skuteczności prawnej robi prawnik. Nie obiecujemy ważności w sądzie.
- **RODO i hosting w UE** są opisane jako plan („projektowane pod RODO”, „zaplanowane na wdrożenie produkcyjne”), nie jako stan obecny.
- **Czego jeszcze nie ma** (protokół przyjęcia z podpisem, inspekcja, faktury i KSeF, konto klienta z historią, tryb offline) jest oznaczone „w planie” albo „wkrótce”. Zastąpiło to opisy z poprzedniej strony głównej, które obiecywały protokół z podpisem i historię pojazdu (ryzyko 1 w dokumencie 10, sekcja 13).
- **Liczby** pochodzą z kodu (19 rodzajów pojazdów, 3 role, 10 typów powiadomień zespołu, link 1–14 dni, status 30 dni po zamknięciu). Dane na ekranach (nazwiska, auto, kwoty, wyniki miesiąca) są fikcyjne i opisane jako „Dane na ekranach są przykładowe”.
- **Konkurencja** nie jest nazywana. Napiko jest pozycjonowane jako warstwa komunikacji i zgód działająca **obok** programu do faktur.

## Weryfikacja

```bash
pnpm lint && pnpm typecheck
pnpm test:ui      # w tym tests/ui/marketing.spec.ts
pnpm build
```

Strony nie potrzebują bazy danych (poza sesją w nagłówku, która przy braku bazy daje „niezalogowany”), więc oglądać je można po `pnpm dev` bez `pnpm infra:up`.
