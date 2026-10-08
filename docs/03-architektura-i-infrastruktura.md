# Napiko – architektura i infrastruktura (fundament techniczny)

**Faza:** 3 – projekt (fundament techniczny) · **Wersja:** 0.3 · **Data:** 29.09.2026
**Powiązane:** [01-raport-analityczny.md](01-raport-analityczny.md), [02-decyzje-produktowe.md](02-decyzje-produktowe.md), [07-powiadomienia.md](07-powiadomienia.md), [08-przeglad-architektury.md](08-przeglad-architektury.md), [README](../README.md)

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
| Powiadomienia push | Web Push (biblioteka `web-push`, klucze VAPID), service worker w PWA | Zespół i klienci; bez własnego dostawcy, wiadomość przechodzi przez usługę push przeglądarki. iPhone tylko w aplikacji dodanej do ekranu początkowego |
| Zadania w tle | Kolejka w bazie (outbox) + funkcja cykliczna Netlify | Działa bez długo żyjących procesów |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | Lint, typy, migracje i testy na PostgreSQL 17 (rola bez uprawnień superużytkownika), build |
| Aplikacje mobilne | Capacitor (następny etap) | Ta sama baza kodu co panel web |

```
Przeglądarka / telefon
   │  HTTPS (ciasteczko sesji)
   ▼
Netlify CDN ──► funkcja serwera Nuxta (API + renderowanie stron)
                  │  withTenant(): set_config(app.user_id, app.org_id)
                  ├──► PostgreSQL (RLS wymuszone dla danych warsztatów)
                  ├──► S3: tylko podpisywanie adresów (pliki idą z przeglądarki prosto do magazynu)
                  └──► kolejka zadań ──► SMTP (e-maile), SMS (SMSAPI), Web Push (usługa push przeglądarki), usuwanie plików; w przyszłości KSeF
Netlify: funkcja cykliczna co 5 min ──► /api/internal/jobs/run (zaległe zadania, ponowienia)
Netlify: funkcja cykliczna raz na dobę ──► /api/internal/housekeeping (sprzątanie powiadomień i zadań)
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
- **Węższe konteksty (od 29.09.2026, migracja `scoped-contexts`):**
  - `withUser(db, userId, …)` – rzeczy należące do osoby niezależnie od warsztatu (urządzenia push, powiadomienia ze wszystkich jej warsztatów – tylko tych, do których wciąż należy);
  - `withCustomerLink(db, orgId, …)` – klient z linku bez konta (strona akceptacji, strona statusu naprawy). Po odczytaniu tokenu baza przepuszcza wyłącznie warsztat, do którego należy link; bez tożsamości użytkownika nie widać danych osób z zespołu;
  - przejęcie urządzenia push przez inną osobę na tym samym telefonie robi funkcja bazy `app.claim_push_subscription` (tożsamość tylko z `app.user_id`).
- **Wyjątek:** `withSystem()` (ustawia `app.system = 'on'`) omija izolację. Używają go tylko: kolejka zadań i jej obsługa, sprzątanie, zakładanie organizacji i zaproszenia (Better Auth), kotwice dziennika oraz sam odczyt tokenu z linku klienta (`server/utils/customer-link.ts`). Listę plików pilnuje test `tests/system-context.test.ts` – nowe użycie trzeba świadomie do niej dopisać.
- **Rola bazy:** docelowo aplikacja łączy się rolą bez własności tabel ([ADR-010](#adr-010-baza-produkcyjna-neon-w-ue-z-osobnymi-rolami)); wtedy nawet przy błędzie w kodzie nie da się wyłączyć RLS ani wyzwalaczy.
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
- **Przy bazie Neon** (ADR-010) migracje uruchamia build na Netlify (`pnpm build:netlify` → `scripts/migrate-on-build.ts`, rola właściciela z `DATABASE_MIGRATION_URL`), a po nich nadaje uprawnienia roli aplikacji (`DATABASE_APP_ROLE`). Nieudana migracja przerywa build, więc nowy kod nie trafi na produkcję przed zmianą schematu.
- **Zasada zmian schematu:** *expand → wdrożenie → contract* – najpierw dodaj (kolumnę, tabelę), wdroż kod, który z niej korzysta, a starą strukturę usuń dopiero w kolejnym wdrożeniu.
- **Bez danych demo i kont w migracjach:** migracje trafiają także na produkcję. Dane demo tworzy `pnpm db:seed:demo` (tylko lokalnie); pilnuje tego test `tests/migrations-policy.test.ts`. Dawne migracje demo zostały (sumy kontrolne), a migracja `disable-demo-logins` usunęła kontom demo logowanie hasłem.
- **Schemat Drizzle** (`server/db/schema`) daje typy w kodzie. Test `schema.test.ts` wykrywa rozjazd między schematem a bazą.

### ADR-006. Dziennik zdarzeń: tylko dopisywanie + łańcuch hashy

- Wpis zawiera numer kolejny w organizacji, czas oraz skrót SHA-256 obejmujący poprzedni skrót. Nadaje je wyzwalacz w bazie, nie aplikacja.
- UPDATE, DELETE i TRUNCATE blokuje wyzwalacz, także w kontekście systemowym. Wyjątek to jawna procedura retencji (`app.audit_purge`).
- `app.audit_chain_first_broken(org)` wskazuje pierwszy naruszony wpis. Panel pokazuje stan łańcucha.
- **Kotwice (ADR-010):** raz na dobę sprzątanie zapisuje „głowę” łańcucha każdego warsztatu (numer i hash ostatniego wpisu) do osobnego bucketu S3 z blokadą obiektów (`AUDIT_ANCHOR_BUCKET`) i porównuje z bazą kotwicę z poprzedniego dnia. Przepisanie dziennika w bazie (usunięcie i ponowne wstawienie – łańcuch przelicza się poprawnie) nie zgodzi się z kotwicą.
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
- **Błędy:** wykładnicze ponowienia (30 s … 1 h), limit prób, porzucone zadania wracają do kolejki po 5 min. Nieznany typ zadania kończy się od razu jako nieudany. Codzienne sprzątanie loguje liczbę nieudanych zadań z ostatniej doby (`[jobs] nieudane zadania…`).
- **„Co najmniej raz”:** zadanie może wykonać się ponownie (np. wysyłka się udała, a zapis „wykonane” już nie). Dlatego wysyłki dostają klucz idempotencji = id zadania: SMSAPI (`idx` + `check_idx`, duplikat = sukces), e-mail ze stałym `Message-ID`.
- **Limity czasu:** budżet sprawdzany przed każdym zadaniem; niezaczęte zadania wracają do kolejki bez liczenia próby. Przebieg funkcji cyklicznej ma budżet 8 s (limit funkcji synchronicznych Netlify), po żądaniu – 2,5 s.
- Po udanym wykonaniu **treść zadania jest czyszczona** (adres e-mail, link z tokenem) – minimalizacja danych.
- **Powiadomienia (29.09.2026):** ta sama kolejka wysyła push (`push.send`), wiadomości do klientów (`customer-notification.send`: push z SMS-em jako zapasem, SMS, e-mail) i sprawdza wygaśnięcie linków (`approval.expiry-check`). Po żądaniu przetwarzanie ma krótszy limit (2,5 s, na Netlify po odpowiedzi), a raz na dobę działa sprzątanie (`housekeeping-cron`). Szczegóły: [07-powiadomienia.md](07-powiadomienia.md).

### ADR-009. Wielojęzyczność od początku

- Teksty interfejsu w `i18n/locales/pl.json` i `en.json`. Szablony e-maili na razie tylko po polsku.

### ADR-010. Baza produkcyjna: Neon w UE z osobnymi rolami

- **Status:** zaproponowana 29.09.2026 ([08-przeglad-architektury.md](08-przeglad-architektury.md)); kod gotowy, konfiguracja infrastruktury do wykonania przed pilotażem.
- **Decyzja:** Netlify Pro z regionem funkcji `fra` + Neon we Frankfurcie. Dwie role: właściciel tabel (tylko migracje, `DATABASE_MIGRATION_URL`) i rola aplikacji (`DATABASE_URL`, `NOBYPASSRLS`, tylko SELECT/INSERT/UPDATE/DELETE, dziennik wyłącznie do odczytu i dopisywania, bez tabeli migracji) – `server/db/roles.ts`.
- **Kotwice dziennika** w buckecie z blokadą obiektów (ADR-006).
- **Konsekwencje:** aplikacja nie wyłączy RLS, wyzwalaczy ani nie usunie dziennika – nawet po wycieku jej poświadczeń; migracje idą przez build (ADR-005); podglądy wdrożeń nie dostają kopii danych produkcyjnych (gałęzie Neon tylko na żądanie).

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
| `notification`, `notification_preference` | Powiadomienia zespołu (dzwonek) i wybór kanałów dla typu | ✔ FORCE (każdy widzi tylko swoje) |
| `push_subscription`, `customer_push_subscription` | Urządzenia z włączonym push: członków zespołu (należą do osoby) i klientów („zarejestrowane telefony”) | ✔ FORCE |
| `customer_notification`, `work_order_status_link` | Dziennik wiadomości do klienta; skrót tokenu strony statusu naprawy | ✔ FORCE |

Tabele modułów warsztatu (klienci, pojazdy, zlecenia, praca mechanika, akceptacje, rozliczenia: `company_profile`, `service_price`, `estimate_item`) powstały według reguł z sekcji 8 – opisuje je dokument [04-moduly-warsztatu.md](04-moduly-warsztatu.md). Rejestr zgód dojdzie w etapie E6. Tabele powiadomień opisuje [07-powiadomienia.md](07-powiadomienia.md).

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
- endpointy kolejki i sprzątania chronione kluczem (porównanie odporne na ataki czasowe);
- endpointy publiczne (`/api/public/**`) z limitem żądań w bazie: 20 zmian i 120 odczytów na minutę z jednego adresu IP;
- endpointy publiczne i rzeczy należące do osoby bez kontekstu systemowego (`withCustomerLink`, `withUser`), lista wyjątków pilnowana testem;
- sekret linków do strony statusu (`STATUS_LINK_SECRET`) osobny od sekretu logowania;
- sesja z podpisanego ciasteczka przez 2 min (mniej zapytań); członkostwo i rola sprawdzane w bazie przy każdym żądaniu;
- brak kont i danych demo w migracjach (test), CI z testami izolacji przy każdym pushu;
- powiadomienia zespołu bez danych kontaktowych klienta, niezmienne po utworzeniu (wyzwalacz w bazie), odbiorca może tylko oznaczyć je jako przeczytane;
- strona statusu naprawy: token liczony z sekretu serwera (HMAC, w bazie tylko skrót), wersje i unieważnianie linku, `noindex`, `no-referrer`, `no-store`, maskowanie telefonu i e-maila;
- wiadomości do klienta z rezygnacją z SMS-ów i e-maili (`List-Unsubscribe` jednym kliknięciem), SMS w logach bez numeru i linku.

**Do zrobienia przed pilotażem:**
- baza Neon w UE z osobnymi rolami, bucket kotwic dziennika z blokadą obiektów, `STATUS_LINK_SECRET` (ADR-010 – kod gotowy, konfiguracja w sekcji 6);
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
| CI (GitHub Actions) | Usługa PostgreSQL 17, rola `oxy_app` bez uprawnień superużytkownika | – | – | Lint, typy, migracje, testy, build |
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
   - opcjonalnie powiadomienia push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (parę kluczy wygeneruje `pnpm push:keys`; bez nich push jest wyłączony);
   - `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`;
   - opcjonalnie `BETTER_AUTH_URL` (przy własnej domenie) i `AUTH_TRUSTED_ORIGINS`;
   - przed pilotażem: `STATUS_LINK_SECRET` (losowy, min. 32 znaki), `AUDIT_ANCHOR_BUCKET` (bucket z blokadą obiektów) i opcjonalnie `AUDIT_ANCHOR_RETENTION_DAYS`.
4. **Baza:**
   - **Netlify Database:** tworzy się automatycznie (pakiet `@netlify/database`), a migracje stosowane są przy każdym wdrożeniu. Po pierwszym wdrożeniu sprawdź `/api/health` i rejestrację.
   - **Neon w UE (zamiast Netlify Database):**
     - utwórz projekt Neon w regionie Frankfurt; rola właściciela (np. `oxy_owner`) powstaje z projektem, dodaj drugą rolę `oxy_app` (*Roles*);
     - ustaw `DATABASE_MIGRATION_URL` (rola `oxy_owner`), `DATABASE_URL` (rola `oxy_app`, adres z poolerem) i `DATABASE_APP_ROLE=oxy_app`;
     - build (`pnpm build:netlify`) sam zastosuje migracje i nada uprawnienia roli `oxy_app`; ręcznie: `pnpm db:migrate` i `pnpm db:grant-app-role`;
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
   - w zakładce *Functions* widać przebiegi `jobs-cron` co 5 min i `housekeeping-cron` raz na dobę;
   - po ustawieniu kluczy VAPID: w ustawieniach powiadomień przycisk „Włącz” działa, a powiadomienie próbne dochodzi na telefon.

---

## 7. Ograniczenia i następne kroki

- **Region danych:** patrz ADR-002. Przed pilotażem potrzebny jest plan Pro i region UE.
- **Aplikacje mobilne (Capacitor):**
  - build SPA z tej samej bazy kodu i projekty Android/iOS;
  - logowanie w aplikacji mobilnej przez tokeny (plugin `bearer` Better Auth);
  - zaufane originy aplikacji w `AUTH_TRUSTED_ORIGINS`.
- **Tryb offline mechanika:** synchronizacja (np. PowerSync) w v1.1.
- **Aktualizacje na żywo:** odświeżanie cykliczne (dzwonek co 30 s i po pushu), później usługa zewnętrzna.
- **Powiadomienia push:** działają w przeglądarce i w aplikacji zainstalowanej z przeglądarki (PWA). Natywny push w aplikacjach ze sklepów dojdzie razem z Capacitorem (E10.4).
- **SMS:** zadanie `sms.send` wysyła przez SMSAPI.pl (`SMS_PROVIDER=smsapi`) albo tylko zapisuje w logach (`log`, domyślnie). Brakuje testu na prawdziwym koncie i rejestru zgód (konto klienta).
- **Moduły biznesowe:** etapy 1–5 gotowe (klienci, praca mechanika, akceptacje, rozliczenia, powiadomienia) – zob. [04-moduly-warsztatu.md](04-moduly-warsztatu.md) i [07-powiadomienia.md](07-powiadomienia.md). Decyzje D1–D7 zapadły 26.09.2026 ([02-decyzje-produktowe.md](02-decyzje-produktowe.md)).

---

## 8. Jak dodać nowy moduł – zasady dla programisty

1. **Migracja:** `pnpm db:new <nazwa>`. Tabela z `org_id` dostaje `ENABLE` + `FORCE ROW LEVEL SECURITY` oraz polityki `tenant_*` i `system_all` (wzór w `platform-core`).
2. **Schemat Drizzle** w `server/db/schema`. Test zgodności schematu musi przechodzić.
3. **Endpoint:** `requireTenant(event, { zasób: ['akcja'] })`, a następnie wszystkie operacje w `withTenant(...)`. Endpoint publiczny (link dla klienta): token → `server/utils/customer-link.ts`, dalej `withCustomerLink(...)`. Rzeczy osoby bez warsztatu: `withUser(...)`. `withSystem(...)` tylko w plikach z listy w `tests/system-context.test.ts`.
4. **Uprawnienia:** nowe zasoby i akcje w `shared/permissions.ts`, przypisane do ról.
5. **Dziennik:** `recordAudit(tx, …)` dla zmian ważnych prawnie lub biznesowo (akceptacje, ceny, statusy).
6. **Zadania w tle:** `enqueueJob(tx, …)` w tej samej transakcji; obsługa w `server/utils/jobs.ts`. Wysyłka na zewnątrz przekazuje dostawcy klucz idempotencji (id zadania).
7. **Teksty** w `i18n/locales/pl.json` i `en.json`.
8. **Testy:** przypadki izolacji dla nowych tabel. Test ogólny sprawdza RLS automatycznie.
9. **Bez danych demo w migracji** – dane przykładowe dopisz do `scripts/demo/`.
