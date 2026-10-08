# Napiko — identyfikacja wizualna (wdrożona)

Stan: 08.10.2026. Zastępuje kierunek kolorystyczny z `06-plan-designu.md` (sekcje 1 i 3: niebieski/metaliczny fiolet). Pozostałe zasady UI z tamtego dokumentu obowiązują dalej.

## Jedna marka, dwa konteksty

Znak z kluczem i napis NAPIKO są wspólne. Zmienia się tylko paleta, zależnie od kontekstu, a kontekst jest niezależny od trybu jasny/ciemny.

| Element | Biuro, właściciel, mechanik (`workshop`) | Klient (`customer`) |
| --- | --- | --- |
| Znak na jasnym tle | pomarańcz `#E84924` | fiolet `#68418C` |
| Tekst / tło strony | grafit `#202326` / `#F3F1EB` | śliwka `#292330` / `#F7F4FA` |
| Główna akcja, jasny | `#BD3619`, biały tekst | `#68418C`, biały tekst |
| Główna akcja, ciemny | `#FF936D`, tekst `#202326` | `#C6A5DF`, tekst `#241B2B` |

Pomarańcz znaku nie jest tłem przycisku z białym tekstem (kontrast 3,9:1) – akcje używają ciemniejszego odcienia. Zielony, bursztynowy i czerwony zachowują znaczenie statusów; status ma zawsze tekst lub ikonę.

## Gdzie co jest

- **Skale i tokeny:** `app/assets/css/theme/primitives.css` (skale `orange`, `violet`, `graphite`, `plum`) i `semantic.css` (cztery warianty: kontekst × jasność). `--color-napiko-primary-*` i `--color-napiko-neutral-*` wskazują skalę aktualnego kontekstu; `app.config.ts` ustawia je jako `primary` i `neutral` Nuxt UI, więc komponenty nie zostają w kolorze poprzedniego kontekstu.
- **Kontekst strony:** `definePageMeta({ themeContext: 'customer' })` (domyślnie `workshop`). `app/app.vue` zapisuje go w `data-napiko-theme` na `<html>`, więc dialogi, menu i toasty dziedziczą go. Nowe strony klienta muszą go zadeklarować; kontekstu nie wykrywa się po adresie URL ani po roli.
- **Logo:** `public/brand/*.svg` (źródło prawdy), komponent `NapikoBrand.vue` (`variant="full"` lub `"mark"` na ciasne miejsca). Wariant na jasne/ciemne tło przełącza CSS, więc HTML z serwera jest stały. Cel linku: warsztat → `/app`, klient → `/`.
- **Stałe poza CSS:** `shared/brand.ts` – kolory paska przeglądarki i ekranu startowego PWA, kolory e-maili, wersja adresów ikon.
- **Ikony i rastry:** `pnpm brand:build` generuje `public/icons/*.png` oraz `public/brand/*-email.png` ze źródeł SVG. Po zmianie grafik podnieś `BRAND_ICON_VERSION` w `shared/brand.ts` oraz `?v=` w `public/manifest.webmanifest` i `public/sw.js` (test `tests/ui/brand.spec.ts` pilnuje zgodności).
- **E-maile:** `server/lib/email-templates.ts`. Wiadomości konta i zespołu: paleta warsztatu i logo Napiko. Wiadomości do klienta: nazwa jego warsztatu na górze, paleta klienta, Napiko jako oznaczenie platformy w stopce. Logo to PNG z adresu `appUrl`; bez adresu zostaje nazwa tekstowa.

## Zasady użycia logo

- Nie rozciągaj, nie pochylaj, nie zmieniaj geometrii między rolami. Pole ochronne co najmniej 1/8 wysokości znaku.
- Pełne logo: min. 160 px w interfejsie, 35 mm w druku; poniżej użyj samego znaku (min. 24 px). Przy 16 px sprawdź raster – szczeliny klucza zlewają się.
- Wariant metaliczny (`napiko-logo-customer-metallic.svg`, `--napiko-brand-metal`) tylko na dużych powierzchniach marki, nigdy pod tekstem ani na przyciskach.
- `<img>` z logo: `alt=""`, gdy obok jest nazwa lub link ma nazwę dostępną; w pozostałych przypadkach `alt="Napiko"`.

## Weryfikacja

`pnpm test:ui` (kontrast prawdziwych zmiennych CSS w czterech wariantach, kotwice palety, kompletność skal, zgodność ikon i manifestów), `pnpm test:sms` (szablony e-maili), `pnpm lint`, `pnpm typecheck`.

## Poza kodem (osobny krok operacyjny)

Nowa domena, adres nadawcy e-maili i nazwa nadawcy SMS wymagają potwierdzenia własności i konfiguracji u dostawców; kod ich nie zakłada. Zainstalowane PWA odświeżą ikonę według harmonogramu systemu.
