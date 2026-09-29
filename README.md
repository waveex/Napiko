# OXY

Aplikacja do komunikacji i organizacji pracy warsztatów z klientem: biuro warsztatu, mechanicy i klienci w jednym systemie.

**Stan:**

- **Fundament techniczny:** logowanie, organizacje i role, izolacja danych warsztatów, pliki, dziennik zdarzeń, kolejka zadań, e-mail.
- **Moduły warsztatu:**
  - klienci i pojazdy wszystkich typów;
  - zlecenia z zadaniami i przydziałem mechaników;
  - widok mechanika z licznikiem czasu;
  - zgłoszenia potrzeb z wyceną;
  - zdjęcia;
  - akceptacja prac dodatkowych przez klienta (link, SMS, e-mail);
  - rozliczenie zlecenia: dane firmy, cennik usług, kosztorys z akceptacją klienta, numer paragonu przy zamknięciu (faktury przez Fakturownię/KSeF dojdą z integracjami);
  - pulpit dopasowany do roli: mechanik – bieżąca praca i kolejka, biuro – sprawy wymagające reakcji i warsztat dziś, właściciel – dodatkowo wyniki miesiąca.
- **Powiadomienia:**
  - dzwonek w aplikacji, e-mail i push (także w aplikacji zainstalowanej na telefonie) dla mechaników i biura;
  - SMS albo push i e-mail do klienta przy przyjęciu pojazdu i gotowości do odbioru, z linkiem do strony statusu naprawy bez logowania.

Szczegóły w [`docs/04-moduly-warsztatu.md`](docs/04-moduly-warsztatu.md) i [`docs/07-powiadomienia.md`](docs/07-powiadomienia.md).

| Dokument | Zawartość |
| --- | --- |
| [`docs/01-raport-analityczny.md`](docs/01-raport-analityczny.md) | Rynek, konkurencja, prawo, integracje, technologia |
| [`docs/02-decyzje-produktowe.md`](docs/02-decyzje-produktowe.md) | Wnioski i decyzje przed specyfikacją wymagań |
| [`docs/03-architektura-i-infrastruktura.md`](docs/03-architektura-i-infrastruktura.md) | Architektura, decyzje techniczne, bezpieczeństwo, wdrożenie na Netlify |
| [`docs/04-moduly-warsztatu.md`](docs/04-moduly-warsztatu.md) | Moduły warsztatu (etapy 1–5), reguły, dowód zgody klienta, punkty do weryfikacji prawnej |
| [`docs/05-plan-prac.md`](docs/05-plan-prac.md) | Plan prac: etapy E4–E11 i sprawy formalne, właściciele i zależności (statusy na żywo w artefakcie „Plan prac OXY”) |
| [`docs/07-powiadomienia.md`](docs/07-powiadomienia.md) | Powiadomienia: kto co dostaje, dzwonek, wiadomości do klienta, strona statusu naprawy, push (VAPID), sprzątanie, testy |

## Technologia

Nuxt 4 (Vue 3, TypeScript) · Nuxt UI 4 · PostgreSQL + Drizzle ORM · Better Auth · S3 · Netlify (funkcje serverless + Netlify Database) · Vitest · GitHub Actions

## Uruchomienie lokalne

Wymagania: **Node.js 22 LTS**, **pnpm** (`corepack enable`), **Docker Desktop**, Git.

```bash
corepack enable
pnpm install

# konfiguracja (Windows PowerShell: Copy-Item .env.example .env)
cp .env.example .env
# ustaw w .env losowe wartości BETTER_AUTH_SECRET (min. 32 znaki) i INTERNAL_API_KEY (min. 24 znaki), np.:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

pnpm infra:up     # PostgreSQL, MinIO (S3) i Mailpit w Dockerze
pnpm setup        # migracje bazy + bucket na pliki
pnpm dev          # http://localhost:3000
```

| Usługa | Adres |
| --- | --- |
| Aplikacja | http://localhost:3000 |
| Skrzynka z e-mailami (Mailpit) – linki weryfikacyjne i zaproszenia | http://localhost:8025 |
| Konsola magazynu plików (MinIO, login `oxy` / `oxy-secret`) | http://localhost:9001 |
| PostgreSQL | `localhost:5432`, baza `oxy`, użytkownik `oxy` / `oxy` |

## Potwierdzanie rejestracji

Ustawienie `AUTH_REQUIRE_EMAIL_VERIFICATION` w `.env` steruje potwierdzaniem adresu e-mail:

- `false` – rejestracja od razu loguje użytkownika, nie wysyła wiadomości potwierdzającej i pozwala logować się istniejącym kontom bez potwierdzonego adresu. Obecne ustawienie lokalne na czas uruchamiania poczty.
- `true` – rejestracja wysyła wiadomość, a logowanie wymaga potwierdzenia adresu.

Po zmianie uruchom serwer ponownie. Na Netlify ustaw tę zmienną w konfiguracji środowiska i wdróż aplikację ponownie. Bez podanej zmiennej potwierdzanie jest domyślnie wymagane. Wyłączenie wymogu nie oznacza oznaczania adresów jako zweryfikowane; ponowne włączenie zablokuje logowanie niepotwierdzonych kont do czasu weryfikacji. Resetowanie hasła i zaproszenia nadal korzystają z poczty.

## Powiadomienia push

Push w przeglądarce i w aplikacji zainstalowanej na telefonie wymaga pary kluczy VAPID:

```bash
pnpm push:keys    # wypisuje VAPID_PUBLIC_KEY i VAPID_PRIVATE_KEY – wklej do .env (na Netlify: zmienne środowiskowe)
```

Po ustawieniu kluczy uruchom serwer ponownie. Bez kluczy push jest wyłączony – zespół ma dzwonek i e-mail, a klient dostaje SMS-a. Zmiana kluczy unieważnia włączone powiadomienia. iPhone i iPad pokazują powiadomienia push tylko w aplikacji dodanej do ekranu początkowego. Szczegóły: [`docs/07-powiadomienia.md`](docs/07-powiadomienia.md).

## Skrypty

| Polecenie | Opis |
| --- | --- |
| `pnpm dev` | Serwer deweloperski (kolejka zadań przetwarzana co 5 s) |
| `pnpm build` | Build produkcyjny (na Netlify preset wykrywa się sam) |
| `pnpm lint` / `pnpm lint:fix` | ESLint (również formatowanie) |
| `pnpm typecheck` | Sprawdzenie typów (vue-tsc) |
| `pnpm test` | Testy integracyjne na bazie `oxy_test` (RLS, dziennik, kolejka, schemat, warsztat, praca mechanika, akceptacje, rozliczenia, pulpit, powiadomienia) |
| `pnpm infra:up` / `pnpm infra:down` | Start / stop usług w Dockerze |
| `pnpm db:migrate` | Zastosuj nowe migracje |
| `pnpm db:reset` | Wyczyść lokalną bazę i zastosuj migracje od nowa |
| `pnpm db:new <nazwa>` | Nowa migracja w `netlify/database/migrations` |
| `pnpm storage:init` | Utwórz bucket i reguły CORS |
| `pnpm push:keys` | Nowa para kluczy VAPID do powiadomień push |

## Struktura

```
app/                      interfejs (strony, układy, komponenty)
server/
  api/                    endpointy HTTP (Nitro)
  db/                     schemat Drizzle, migrator, kontekst najemcy (RLS), audyt, kolejka zadań
  lib/                    konfiguracja, logowanie (Better Auth), poczta, magazyn plików
  utils/                  usługi i pomocniki dostępne w endpointach
shared/                   kod wspólny dla serwera i interfejsu (role i uprawnienia, walidacja)
netlify/
  database/migrations/    migracje SQL (Netlify stosuje je przy wdrożeniu)
  functions/              funkcje Netlify (cykliczne przetwarzanie kolejki i codzienne sprzątanie powiadomień)
public/                   service worker powiadomień push, manifest aplikacji (PWA), ikony
scripts/                  polecenia pomocnicze (migracje, klucze VAPID)
i18n/locales/             tłumaczenia (pl, en)
tests/                    testy integracyjne
docker/, docker-compose.yml  lokalne usługi
```

## Zasady pracy z kodem

1. **Dane warsztatu tylko przez `withTenant()`.** Transakcja ustawia kontekst organizacji, a RLS w bazie odcina cudze dane. `withSystem()` omija izolację i jest zarezerwowane dla procesów systemowych.
2. **Każda nowa tabela z `org_id`** dostaje `ENABLE` + `FORCE ROW LEVEL SECURITY` i polityki (wzór w migracji `platform-core`). Test `rls.test.ts` pilnuje tego automatycznie.
3. **Nie edytuj zastosowanych migracji** – dodaj nową (`pnpm db:new`). Migrator porównuje sumy kontrolne.
4. **Uprawnienia** definiuje `shared/permissions.ts`; endpoint sprawdza je przez `requireTenant(event, { … })`.
5. **Ważne zmiany zapisuj w dzienniku** (`recordAudit`) – wpisów nie da się zmienić ani usunąć.
6. **Pliki** wysyłane są z przeglądarki bezpośrednio do S3 (podpisane adresy); klucze plików nie zawierają danych osobowych.
7. **Teksty interfejsu** w `i18n/locales` (pl i en).
