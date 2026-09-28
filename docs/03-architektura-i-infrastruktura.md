# OXY – architektura i infrastruktura (fundament techniczny)

**Faza:** 3 – projekt (fundament techniczny) · **Wersja:** 0.1 · **Data:** 26.09.2026
**Powiązane:** [01-raport-analityczny.md](01-raport-analityczny.md), [02-decyzje-produktowe.md](02-decyzje-produktowe.md), [README](../README.md)

Dokument opisuje fundament, na którym powstaną moduły biznesowe: jak działa aplikacja, jakie decyzje podjęto i dlaczego, co jest zabezpieczone, jak wdrożyć ją na Netlify i czego brakuje przed pilotażem.

---

## 1. Przegląd

| Warstwa | Technologia | Uwagi |
| --- | --- | --- |
| Interfejs (strona produktu, panel biura) | Nuxt 4 (Vue 3, TypeScript), Nuxt UI 4, i18n (pl, en) | Panel działa w przeglądarce na Windowsie i na telefonie |
| API | Serwer Nuxta (Nitro) | Na Netlify uruchamiany jako funkcja serverless |
| Baza danych | PostgreSQL + Drizzle ORM | Lokalnie Docker (PG 17), produkcyjnie Netlify Database (Neon) albo Neon w UE |
| Logowanie i organizacje | Better Auth | E-mail + hasło, weryfikacja e-maila, reset hasła, organizacje, role, zaproszenia, limit prób |
| Pliki (zdjęcia, wideo, dokumenty) | Magazyn zgodny z S3 | Lokalnie MinIO, produkcyjnie np. OVHcloud Object Storage w UE |
| E-mail | SMTP | Lokalnie Mailpit, produkcyjnie dostawca z serwerami w UE |
| Zadania w tle | Kolejka w bazie (outbox) + funkcja cykliczna Netlify | Działa bez długo żyjących procesów |
| CI | GitHub Actions | Lint, typy, testy na PostgreSQL, build dla Netlify |
| Aplikacje mobilne | Capacitor (następny etap) | Ta sama baza kodu co panel web |

```
Przeglądarka / telefon
   │  HTTPS (ciasteczko sesji)
   ▼
Netlify CDN ──► funkcja serwera Nuxta (API + renderowanie stron)
                  │  withTenant(): set_config(app.user_id, app.org_id)
                  ├──► PostgreSQL (RLS wymuszone dla danych warsztatów)
                  ├──► S3: tylko podpisywanie adresów (pliki idą z przeglądarki prosto do magazynu)
                  └──► kolejka zadań ──► SMTP (e-maile), SMS (SMSAPI), usuwanie plików; w przyszłości KSeF
Netlify: funkcja cykliczna co 5 min ──► /api/internal/jobs/run (zaległe zadania, ponowienia)
```

---

## 2. Decyzje architektoniczne

### ADR-001. Własny backend: Nuxt (Nitro) + PostgreSQL

- **Decyzja (26.09.2026, właściciel produktu):** API w serwerze Nuxta, PostgreSQL, Drizzle, Better Auth. Bez Supabase.
- **Powody:** jeden język (TypeScript) w całym projekcie, pełna kontrola nad modelem „jedno konto – wiele organizacji”, brak uzależnienia od dostawcy, dowolny hosting.
- **Konsekwencje:** logowanie, pliki i powiadomienia trzeba było zbudować samodzielnie (zrobione w fundamencie). Realtime (aktualizacje na żywo) dojdzie później.

### ADR-002. Hosting: Netlify + baza w chmurze

- **Decyzja (26.09.2026, właściciel produktu):** Netlify (funkcje serverless) oraz zarządzany PostgreSQL.
- **Konsekwencje dla kodu:**
  - brak długo działających procesów: zadania w tle obsługuje kolejka w bazie, przetwarzana zaraz po żądaniu i cyklicznie co 5 minut ([ADR-008](#adr-008-kolejka-zadań-w-bazie-outbox));
  - limit ok. 6 MB na żądanie do funkcji: pliki wysyłane są bezpośrednio do S3 ([ADR-007](#adr-007-pliki-bezpośrednio-do-s3-przez-podpisane-adresy));
  - aktualizacje na żywo (np. zmiana statusu zlecenia u klienta) na początek przez odświeżanie co kilka sekund, później przez zewnętrzną usługę;
  - Netlify udostępnia funkcjom w czasie działania tylko `URL`, `SITE_NAME` i `SITE_ID`. Adres podglądu wdrożenia zapisywany jest więc podczas budowania (`server/plugins/00.env.ts`).
- **⚠️ Region i dane osobowe:** na planie Free funkcje działają w **USA (Ohio)**. Wybór regionu **Frankfurt (`fra`)** wymaga planu **Pro**. Region Netlify Database nie jest opisany w dokumentacji. Do developmentu i testów to wystarcza. **Przed pilotażem z prawdziwymi danymi klientów:**
  - przejść na plan Pro i ustawić region funkcji `fra`;
  - umieścić bazę w UE: Neon we Frankfurcie przez `DATABASE_URL` albo Netlify Database, jeśli będzie dostępna w UE;
  - funkcje i baza muszą być w tym samym regionie, inaczej każde zapytanie przechodzi przez Atlantyk.

### ADR-003. Izolacja danych warsztatów: wspólna baza + wymuszone RLS

- **Model:** jedna baza, każda tabela danych warsztatu ma kolumnę `org_id`.
- **Mechanizm:**
  - `withTenant(db, { userId, orgId }, tx => …)` otwiera transakcję i ustawia `app.user_id` oraz `app.org_id` wyłącznie na jej czas (`set_config(..., true)`);
  - polityki RLS przepuszczają tylko wiersze aktywnej organizacji i tylko wtedy, gdy użytkownik jest jej członkiem (druga linia obrony poza serwerem);
  - RLS jest **wymuszone** (`FORCE ROW LEVEL SECURITY`), więc obowiązuje także właściciela tabel, na którego łączy się aplikacja.
- **Dlaczego FORCE, a nie osobna rola bazy:** bez kontekstu zapytanie **nie widzi niczego**, więc zapomniany `withTenant()` daje pusty wynik, a nie wyciek. Działa z jednym adresem połączenia, jaki daje Netlify Database.
- **Wyjątek:** `withSystem()` (ustawia `app.system = 'on'`) omija izolację. Używają go tylko procesy systemowe: kolejka zadań i zakładanie organizacji. Łatwo je wyszukać w kodzie.
- **Testy:** `tests/db/rls.test.ts` sprawdza izolację, podszywanie się pod cudzą organizację, brak kontekstu oraz to, że **każda** tabela z `org_id` ma włączone i wymuszone RLS.

### ADR-004. Jedno konto, wiele ról w wielu organizacjach

- Better Auth z pluginem organizacji: użytkownik może należeć do wielu organizacji z różnymi rolami. Aktywną organizację przechowuje sesja; przy logowaniu ustawiana jest pierwsza organizacja użytkownika.
- **Role:** `owner` (właściciel), `office` (biuro), `mechanic` (mechanik). Członek może mieć kilka ról (np. `office,mechanic`). Uprawnienia zdefiniowane są w `shared/permissions.ts` i sprawdzane na serwerze. Ten sam plik steruje widocznością elementów interfejsu.
- **Mechanik solo** to organizacja rodzaju `solo`, której jest właścicielem. Może jednocześnie należeć do innych warsztatów.
- **Klient** to konto bez organizacji. Hub klienta (pojazdy, historia) powstanie po SRS.
- Usuwanie organizacji jest wyłączone. Wymaga osobnej procedury z retencją danych (umowa powierzenia, przepisy podatkowe).

### ADR-005. Migracje SQL w formacie Netlify Database

- **Źródło prawdy:** ręcznie przeglądane pliki `netlify/database/migrations/<czas>_<nazwa>/migration.sql`.
- **Kto stosuje migracje:**
  - na Netlify stosuje je platforma przed publikacją wdrożenia;
  - lokalnie i w CI stosuje je `pnpm db:migrate`, który śledzi sumy kontrolne i blokuje edycję zastosowanych migracji.
- **Schemat Drizzle** (`server/db/schema`) daje typy w kodzie. Test `schema.test.ts` wykrywa rozjazd między schematem a bazą.

### ADR-006. Dziennik zdarzeń: tylko dopisywanie + łańcuch hashy

- Wpis zawiera numer kolejny w organizacji, czas oraz skrót SHA-256 obejmujący poprzedni skrót. Nadaje je wyzwalacz w bazie, nie aplikacja.
- UPDATE, DELETE i TRUNCATE blokuje wyzwalacz, także w kontekście systemowym. Wyjątek to jawna procedura retencji (`app.audit_purge`).
- `app.audit_chain_first_broken(org)` wskazuje pierwszy naruszony wpis. Panel pokazuje stan łańcucha.
- **Po co:** dowody akceptacji prac dodatkowych (forma dokumentowa, art. 77² KC), rozliczalność zmian i przyszłe spory z klientami.

### ADR-007. Pliki bezpośrednio do S3 przez podpisane adresy

- Wysyłka pliku ma trzy kroki:
  1. `POST /api/files/upload-url` – walidacja typu i rozmiaru, rekord `pending`, podpisany adres PUT ważny 10 min;
  2. przeglądarka wysyła plik prosto do magazynu;
  3. `POST /api/files/:id/complete` – serwer sprawdza w magazynie obecność i rozmiar pliku.
- Pobieranie odbywa się przez adresy ważne 5 min, wydawane tylko w obrębie aktywnej organizacji (RLS).
- Klucze plików (`org/<org>/<rok>/<miesiąc>/<id>`) nie zawierają danych osobowych. Produkcyjnie magazyn ma być w UE.

### ADR-008. Kolejka zadań w bazie (outbox)

- Zadanie (np. e-mail) dodaje się w tej samej transakcji co zmianę danych.
- **Przetwarzanie:**
  - zaraz po żądaniu, z limitem 4 s (np. e-mail weryfikacyjny po rejestracji);
  - cyklicznie co 5 min przez funkcję Netlify (`netlify/functions/jobs-cron.mts`), która obsługuje ponowienia i zaległości.
- **Błędy:** wykładnicze ponowienia (30 s … 1 h), limit prób, porzucone zadania wracają do kolejki po 5 min.
- Po udanym wykonaniu **treść zadania jest czyszczona** (adres e-mail, link z tokenem) – minimalizacja danych.

### ADR-009. Wielojęzyczność od początku

- Teksty interfejsu w `i18n/locales/pl.json` i `en.json`. Szablony e-maili na razie tylko po polsku.

---

## 3. Model danych (fundament)

| Tabela | Opis | RLS |
| --- | --- | --- |
| `user`, `session`, `account`, `verification` | Konta i sesje (Better Auth) | – |
| `organization` (+ `kind`: `workshop`/`solo`), `member`, `invitation` | Organizacje, członkostwa z rolami, zaproszenia | – |
| `rate_limit` | Limity prób logowania (współdzielone między funkcjami) | – |
| `organization_settings` | Ustawienia warsztatu: przydział zadań (biuro / samodzielnie / mieszany), nadawca SMS, strefa czasowa, język, logo | ✔ FORCE |
| `file_object` | Metadane plików w S3 | ✔ FORCE |
| `audit_event` | Dziennik zdarzeń (łańcuch hashy) | ✔ FORCE |
| `job` | Kolejka zadań | ✔ FORCE (członek może tylko dodać zadanie) |

Tabele modułów warsztatu (klienci, pojazdy, zlecenia, praca mechanika, akceptacje, rozliczenia: `company_profile`, `service_price`, `estimate_item`) powstały według reguł z sekcji 8 – opisuje je dokument [04-moduly-warsztatu.md](04-moduly-warsztatu.md). Rejestr zgód dojdzie w etapie E6.

---

## 4. Bezpieczeństwo

**Zrobione:**
- izolacja warsztatów przez wymuszone RLS i sprawdzanie członkostwa w bazie;
- uprawnienia ról sprawdzane na serwerze;
- obowiązkowa weryfikacja e-maila (także przy przyjmowaniu zaproszeń);
- hasło min. 10 znaków, unieważnienie sesji po resecie hasła;
- limit prób logowania w bazie (produkcja);
- nagłówki bezpieczeństwa (nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy);
- krótkotrwałe podpisane adresy plików, bez danych osobowych w kluczach;
- dziennik zdarzeń tylko do dopisywania;
- czyszczenie treści wykonanych zadań;
- sekrety wyłącznie w zmiennych środowiskowych;
- endpoint kolejki chroniony kluczem (porównanie odporne na ataki czasowe).

**Do zrobienia przed pilotażem:**
- Content-Security-Policy;
- MFA dla właścicieli i biura (plugin `twoFactor` Better Auth);
- polityka kopii zapasowych i odtwarzania (Neon ma odtwarzanie do punktu w czasie);
- monitoring i alerty (np. Sentry z hostingiem w UE);
- procedura zgłaszania podatności (CRA: 24 h / 72 h – dotyczy aplikacji mobilnych);
- DPIA;
- usuwanie konta i eksport danych (wymóg sklepów z aplikacjami i RODO);
- test penetracyjny;
- ochrona hasłem podglądów wdrożeń (patrz niżej).

**⚠️ Podglądy wdrożeń a dane osobowe:** Netlify Database tworzy dla każdego podglądu (deploy preview) gałąź bazy **z kopią danych produkcyjnych**. Gdy w produkcji pojawią się prawdziwe dane klientów, podglądy trzeba chronić hasłem albo zasilać je danymi testowymi.

---

## 5. Środowiska

| Środowisko | Baza | Pliki | Poczta | Uwagi |
| --- | --- | --- | --- | --- |
| Lokalne | Docker: PostgreSQL 17 (`oxy`, testy: `oxy_test`) | MinIO | Mailpit | `pnpm infra:up`, `pnpm setup`, `pnpm dev` |
| CI (GitHub Actions) | Usługa PostgreSQL 17 | – | – | Lint, typy, migracje, testy, build |
| Podgląd wdrożenia (Netlify) | Gałąź Netlify Database (kopia produkcji) | S3 | SMTP | Funkcja cykliczna nie działa na podglądach |
| Produkcja (Netlify) | Netlify Database albo Neon w UE | S3 w UE | SMTP w UE | Zob. ADR-002 (region) |

---

## 6. Wdrożenie na Netlify – krok po kroku

1. **Repozytorium:** utwórz prywatne repozytorium na GitHubie i wypchnij kod (`git init`, `git add .`, `git commit`, `git push`). CI uruchomi się automatycznie.
2. **Projekt Netlify:** *Add new project → Import an existing project →* wybierz repozytorium. Ustawienia builda są w `netlify.toml`.
3. **Zmienne środowiskowe** (*Project configuration → Environment variables*):
   - `BETTER_AUTH_SECRET` – losowe, min. 32 znaki;
   - `INTERNAL_API_KEY` – losowy, min. 24 znaki;
   - `SMTP_URL`, `MAIL_FROM`;
   - `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`;
   - opcjonalnie `BETTER_AUTH_URL` (przy własnej domenie) i `AUTH_TRUSTED_ORIGINS`.
4. **Baza:**
   - **Netlify Database:** tworzy się automatycznie (pakiet `@netlify/database`), a migracje stosowane są przy każdym wdrożeniu. Po pierwszym wdrożeniu sprawdź `/api/health` i rejestrację.
   - **Neon w UE (zamiast Netlify Database):**
     - utwórz projekt Neon w regionie Frankfurt i ustaw `DATABASE_URL` (adres z poolerem);
     - migracje uruchamiaj poleceniem `pnpm db:migrate` z `DATABASE_URL` wskazującym na Neon;
     - usuń zależność `@netlify/database`, żeby Netlify nie zakładał nieużywanej bazy.
5. **Magazyn plików (np. OVHcloud Object Storage):**
   - utwórz bucket i użytkownika S3 w wybranym regionie w UE (dostępne regiony sprawdzisz w panelu OVHcloud);
   - ustaw zmienne `S3_*`;
   - uruchom `pnpm storage:init` ze zmiennymi produkcyjnymi, żeby ustawić CORS dla adresu aplikacji.
6. **Poczta:**
   - wybierz dostawcę SMTP z serwerami w UE;
   - w DNS domeny dodaj rekordy SPF, DKIM i DMARC, żeby e-maile nie trafiały do spamu.
7. **Domena:**
   - dodaj własną domenę w Netlify (np. `app.twojadomena.pl`) i skieruj rekord CNAME w DNS (nazwa.pl / OVH);
   - ustaw `BETTER_AUTH_URL=https://app.twojadomena.pl`.
8. **Weryfikacja:**
   - `/api/health` odpowiada;
   - rejestracja przysyła e-mail;
   - w zakładce *Functions* widać przebiegi `jobs-cron` co 5 min.

---

## 7. Ograniczenia i następne kroki

- **Region danych:** patrz ADR-002. Przed pilotażem potrzebny jest plan Pro i region UE.
- **Aplikacje mobilne (Capacitor):**
  - build SPA z tej samej bazy kodu i projekty Android/iOS;
  - logowanie w aplikacji mobilnej przez tokeny (plugin `bearer` Better Auth);
  - zaufane originy aplikacji w `AUTH_TRUSTED_ORIGINS`.
- **Tryb offline mechanika:** synchronizacja (np. PowerSync) w v1.1.
- **Aktualizacje na żywo:** odświeżanie cykliczne, później usługa zewnętrzna.
- **SMS:** zadanie `sms.send` wysyła przez SMSAPI.pl (`SMS_PROVIDER=smsapi`) albo tylko zapisuje w logach (`log`, domyślnie). Brakuje testu na prawdziwym koncie i rejestru zgód (konto klienta).
- **Moduły biznesowe:** etapy 1–3 gotowe – zob. [04-moduly-warsztatu.md](04-moduly-warsztatu.md). Decyzje D1–D7 nadal czekają na zatwierdzenie.

---

## 8. Jak dodać nowy moduł – zasady dla programisty

1. **Migracja:** `pnpm db:new <nazwa>`. Tabela z `org_id` dostaje `ENABLE` + `FORCE ROW LEVEL SECURITY` oraz polityki `tenant_*` i `system_all` (wzór w `platform-core`).
2. **Schemat Drizzle** w `server/db/schema`. Test zgodności schematu musi przechodzić.
3. **Endpoint:** `requireTenant(event, { zasób: ['akcja'] })`, a następnie wszystkie operacje w `withTenant(...)`.
4. **Uprawnienia:** nowe zasoby i akcje w `shared/permissions.ts`, przypisane do ról.
5. **Dziennik:** `recordAudit(tx, …)` dla zmian ważnych prawnie lub biznesowo (akceptacje, ceny, statusy).
6. **Zadania w tle:** `enqueueJob(tx, …)` w tej samej transakcji; obsługa w `server/utils/jobs.ts`.
7. **Teksty** w `i18n/locales/pl.json` i `en.json`.
8. **Testy:** przypadki izolacji dla nowych tabel. Test ogólny sprawdza RLS automatycznie.
