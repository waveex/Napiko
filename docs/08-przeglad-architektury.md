# Napiko – przegląd architektury

**Data:** 29.09.2026 · **Zakres:** kod w repozytorium (`c0d4dce`), dokument [03-architektura-i-infrastruktura.md](03-architektura-i-infrastruktura.md) · **Status:** poprawki w kodzie wdrożone 29.09.2026 (zob. niżej); konfiguracja infrastruktury z ADR-010 – do wykonania przed pilotażem

## Stan wdrożenia poprawek (29.09.2026)

| Pkt | Poprawka | Stan |
| --- | --- | --- |
| 1 | Dane demo poza migracjami: `pnpm db:seed:demo` (`DEMO_OWNER_EMAIL`, `DEMO_PASSWORD`), migracja `disable-demo-logins` usuwa hasła kont demo, test zakazu kont/haseł/e-maili w nowych migracjach | ✅ kod |
| 2 | Rola aplikacji bez własności tabel (`server/db/roles.ts`, `pnpm db:grant-app-role`, automatycznie w `build:netlify`), kotwice dziennika w S3 z blokadą obiektów | ✅ kod · ⏳ Neon + bucket do utworzenia |
| 3 | `withUser`, `withCustomerLink`, `app.claim_push_subscription`; endpointy publiczne i osobiste bez kontekstu systemowego; test listy dozwolonych plików z `withSystem` | ✅ |
| 4 | CI: `.github/workflows/ci.yml` (lint, typy, migracje, testy na PG 17 jako rola bez superużytkownika, build) | ✅ · ⏳ włączyć w GitHubie po pierwszym pushu |
| 5 | Idempotencja: SMSAPI `idx`/`check_idx` (duplikat = sukces), stały `Message-ID`; budżet przed każdym zadaniem, zwrot niezaczętych zadań, nieznany typ → od razu `failed`, alarm o nieudanych zadaniach w logach | ✅ |
| 6 | Budżet przebiegu kolejki 8 s, limit czasu wywołań z funkcji cyklicznych | ✅ · ⏳ sprawdzić limit funkcji w planie Netlify |
| 7 | Migracje w buildzie przy Neon (`scripts/migrate-on-build.ts`), zasada expand → contract w dokumencie 03 | ✅ |
| 8 | Sesja z ciasteczka przez 2 min (`cookieCache`) | ✅ (połączenie sprawdzenia członkostwa z `withTenant` – później) |
| 9 | Rzadsze odpytywanie dzwonka bez aktywności (po 10 min – co 5 min) | ✅ (usługa realtime – v1.1) |
| 10 | `STATUS_LINK_SECRET` osobny od sekretu logowania (bez niego – jak dotąd) | ✅ · ⏳ ustawić przed pilotażem |
| 11 | Limit żądań `/api/public/**` w bazie (20 zmian / 120 odczytów na minutę z IP) | ✅ |

Weryfikacja: 175 testów (w tym nowe: konteksty, rola aplikacji, kotwice, seed demo, kolejka, SMS/e-mail, limit żądań), lint, typy, build oraz test end-to-end na serwerze deweloperskim (akceptacja kosztorysu i strona statusu jako klient i jako podgląd warsztatu, push, powiadomienia, limit żądań).

---

## Ocena ogólna

Fundament jest solidny i przemyślany jak na tę fazę: kolejka outbox w tej samej transakcji co zmiana, RLS z `FORCE` (zapomniany kontekst = pusty wynik, a nie wyciek), dziennik z łańcuchem hashy nadawanym przez bazę, pliki bezpośrednio do S3, tokeny linków przechowywane jako skróty, czyszczenie treści wykonanych zadań, maskowanie danych klienta dla mechanika, test sprawdzający RLS na **każdej** tabeli z `org_id`. To są decyzje, które zwykle dokłada się dopiero po pierwszym incydencie.

Problemy dotyczą głównie tego, **na ile te zabezpieczenia wytrzymają błąd lub wyciek poświadczeń**, oraz kilku miejsc, w których kod rozjechał się z dokumentacją. Poniżej według priorytetu.

---

## P0 – przed pilotażem z prawdziwymi danymi

### 1. Konta demo z hasłami w migracjach produkcyjnych
`20260928130000_demo-mechanics` zakłada **konta z działającymi hasłami** (hashe w repozytorium) w każdej bazie, w której istnieje konto właściciela `jablonsky97@gmail.com` – czyli także w produkcji. `demo-workshop` i `repair-demo-uuids` dokładają fikcyjne zlecenia. Migracje są nieodwracalne i stosowane automatycznie przy każdym wdrożeniu.

**Rekomendacja:** przenieść dane demo do skryptu `pnpm db:seed:demo` (tylko lokalnie i na podglądach). Na produkcji dodać migrację, która usuwa konta `*@demo.oxy.invalid` i ich dane (albo przynajmniej unieważnia hasła i sesje). Adres e-mail właściciela nie powinien być zaszyty w SQL.

### 2. Jedna rola bazy = właściciel tabel
Aplikacja łączy się jako właściciel tabel. `FORCE ROW LEVEL SECURITY` chroni przed **zapomnianym** `withTenant()`, ale nie przed błędem w zapytaniu, SQL injection ani wyciekiem `DATABASE_URL`. Ta sama rola może:
- ustawić `set_config('app.system','on')` i zobaczyć wszystkie warsztaty;
- wykonać `ALTER TABLE … NO FORCE ROW LEVEL SECURITY` albo `DROP TRIGGER`;
- ustawić `app.audit_purge` i usunąć dziennik, a następnie wstawić go od nowa – łańcuch hashy zostanie **przeliczony poprawnie**, bo nie ma zewnętrznej kotwicy.

Dla dziennika to istotne: ADR-006 uzasadnia go dowodem zgody (art. 77² KC). Łańcuch, który może przeliczyć każdy z dostępem do bazy, wykrywa przypadkowe edycje, ale słabo broni się jako dowód.

**Rekomendacja:** [ADR-010](#adr-010-baza-produkcyjna-neon-w-ue-z-osobnymi-rolami) poniżej.

### 3. `withSystem()` rozlał się poza kolejkę
ADR-003 mówi, że `withSystem()` używają „tylko procesy systemowe: kolejka zadań i zakładanie organizacji”. W kodzie jest ~30 wywołań w 15 plikach, m.in.:
- wszystkie endpointy publiczne (`/api/public/approvals/*`, `/api/public/status/*`);
- endpointy zalogowanego użytkownika: `push/*`, `notifications/[id]/target`, `notifications/preferences`.

Każdy błąd w tych miejscach (np. brakujący warunek `where`) jest od razu **międzywarsztatowy**, bo RLS jest wyłączone.

**Rekomendacja:** trzy węższe konteksty zamiast jednego „wszystko wolno”:

| Kontekst | Ustawia | Polityki | Dla kogo |
| --- | --- | --- | --- |
| `withTenant` | `app.user_id`, `app.org_id` | jak dziś | panel warsztatu |
| `withUser` (nowy) | tylko `app.user_id` | `user_id = app.current_user_id()` na `push_subscription`, `notification`, `notification_preference` | rzeczy należące do osoby, niezależne od organizacji |
| `withCustomerLink` (nowy) | `app.org_id` + `app.customer_scope = <work_order_id>` | odczyt tylko wskazanego zlecenia / prośby o akceptację | strony `/s/…`, `/approve/…` – **po** rozwiązaniu tokenu (samo wyszukanie tokenu może zostać systemowe) |
| `withSystem` | `app.system` | jak dziś | kolejka, cron, zakładanie organizacji |

Do tego test, który przegląda kod i pilnuje listy dozwolonych plików z `withSystem(` – nowe użycie wymaga świadomego dopisania.

### 4. Brak CI
Dokument 03 opisuje GitHub Actions (lint, typy, testy na PostgreSQL, build), ale katalog `.github` jest pusty. Testy RLS i zgodności schematu to najcenniejsza siatka bezpieczeństwa w projekcie – bez CI nic ich nie wymusza przed wdrożeniem, a Netlify zbuduje i opublikuje każdy push.

**Rekomendacja:** dodać workflow (usługa `postgres:17`, `pnpm db:migrate`, `lint`, `typecheck`, `test`, `build`) i w Netlify włączyć blokadę publikacji do czasu zielonego statusu (albo publikować z CI).

---

## P1 – do zrobienia w najbliższych etapach

### 5. Kolejka: „co najmniej raz” oznacza podwójne SMS-y
Semantyka kolejki to *at-least-once*. Duplikat powstaje, gdy:
- wysyłka się udała, a `completeJob()` nie (zerwane połączenie, koniec czasu funkcji);
- zadanie trwa dłużej, niż funkcja żyje – po 5 min wraca do kolejki jako „porzucone”;
- budżet czasu jest sprawdzany **między partiami**, nie między zadaniami – partia 10 e-maili przy wolnym SMTP może przekroczyć limit funkcji w połowie.

E-mail podwójnie to drobiazg, SMS to koszt i irytacja klienta; w przyszłości KSeF – podwójna faktura.

**Rekomendacja:**
- klucz idempotencji = `job.id` przekazywany dostawcy (SMSAPI ma parametr `idx` z `check_idx`; w e-mailu stały `Message-ID`); dla KSeF to wymóg, nie opcja;
- sprawdzać budżet przed każdym zadaniem, nie przed partią;
- nieznany typ zadania → od razu `failed`, bez 8 prób;
- alert na zadania `failed` (dziś nikt się o nich nie dowie).

### 6. Limity czasu funkcji Netlify
`/api/internal/jobs/run` ma budżet 20 s, a wywołuje go funkcja cykliczna przez HTTP i czeka na odpowiedź. Funkcje synchroniczne i cykliczne mają na Netlify twarde limity czasu (historycznie 10 s domyślnie dla synchronicznych, 30 s dla cyklicznych – **sprawdź aktualne wartości dla swojego planu**). Jeśli budżet przekroczy limit, funkcja zostanie przerwana w trakcie zadania – patrz punkt 5.

**Rekomendacja:** przetwarzać kolejkę bezpośrednio w funkcji cyklicznej (import `processJobs`, bez skoku HTTP) z budżetem wyraźnie poniżej limitu albo przenieść przetwarzanie do funkcji w tle (Background Function, do 15 min). Czas „porzucenia” zadania (`STALE_AFTER`) ustawić na limit funkcji + margines.

### 7. Kolejność migracji i wdrożenia przy Neon
Przy Netlify Database migracje stosuje platforma przed publikacją. Przy Neon w UE (zalecane – ADR-002, ADR-010) migracje uruchamia się ręcznie, więc nowy kod może trafić na produkcję przed zmianą schematu. **Rekomendacja:** krok `db:migrate` w CI przed publikacją + zasada *expand → wdrożenie → contract* (najpierw dodaj kolumnę, potem kod, dopiero potem usuń starą).

### 8. Liczba zapytań na żądanie
Każde żądanie panelu to co najmniej: odczyt sesji (Better Auth, baza) → sprawdzenie członkostwa (osobne zapytanie) → `BEGIN` → `set_config` → zapytania → `COMMIT`. Przy funkcjach w Ohio i bazie we Frankfurcie to ~100 ms na każdy krok. Nawet w jednym regionie warto:
- włączyć `session.cookieCache` w Better Auth (sesja z podpisanego ciasteczka, bez zapytania);
- połączyć sprawdzenie członkostwa z `set_config` w jednym zapytaniu na początku `withTenant` (zwraca rolę albo nic).

### 9. Odświeżanie cykliczne a koszty
Dzwonek co 30 s i status u klienta co kilka sekund to wywołania funkcji i – ważniejsze – **baza Neon, która nigdy nie zasypia** (skalowanie do zera przestaje działać). Przykład: 5 osób w warsztacie × 8 h × 120 zapytań/h ≈ 5 tys. wywołań dziennie na warsztat. Na pilotaż wystarczy, przy 50 warsztatach już nie.

**Rekomendacja:** przerwa w odpytywaniu, gdy karta jest w tle (`visibilitychange`), tani endpoint `summary` z `ETag`/304, a w v1.1 zewnętrzna usługa realtime w UE (lub SSE na osobnym, długo żyjącym serwisie).

### 10. Token strony statusu zależy od `BETTER_AUTH_SECRET`
Token linku statusu to HMAC z sekretu logowania. Rotacja sekretu (np. po incydencie) unieważni **wszystkie linki wysłane klientom SMS-em**, a wyciek jednego sekretu otwiera dwa systemy. Tokeny akceptacji są losowe – niespójność. **Rekomendacja:** osobny `STATUS_LINK_SECRET` albo losowy token jak przy akceptacjach (wersjonowanie i tak jest w tabeli).

### 11. Brak limitów na endpointach publicznych
Limit Better Auth obejmuje tylko `/api/auth/*`. Tokeny mają 144–192 bity, więc zgadywanie nie grozi, ale `POST /api/public/status/[token]/push` i `…/preferences` można zasypywać żądaniami (wywołania funkcji, wiersze w bazie). **Rekomendacja:** prosty limit po IP + tokenie w istniejącej tabeli `rate_limit`.

---

## P2 – do obserwacji

- **Role jako tekst po przecinku** (`office,mechanic`) – działa z Better Auth, ale zapytania w SQL wymagają `regexp_split_to_array` (widać w migracjach). Warto mieć widok `member_role(org_id, user_id, role)`.
- **E-maile logowania poza transakcją** – `sendEmail` Better Auth dodaje zadanie w osobnej transakcji niż utworzenie konta. Jeśli dodanie się nie uda, konto zostaje bez e-maila weryfikacyjnego – potrzebny przycisk „wyślij ponownie” na ekranie logowania.
- **Tryb offline (PowerSync, v1.1)** – silniki synchronizacji nie znają `set_config`; izolację trzeba będzie odtworzyć w regułach synchronizacji (JWT z `org_id`). Dobrze, że każda tabela ma `org_id` – to ułatwia. Warto zaplanować przed E10, a nie po.
- **Capacitor** – przejście na tokeny (`bearer`) zmienia model zagrożeń (brak ochrony `SameSite`, przechowywanie tokenu w urządzeniu); zaplanowane, ale warto dopisać do DPIA.
- **CSP** – znane, na liście przed pilotażem.

---

## ADR-010. Baza produkcyjna: Neon w UE z osobnymi rolami

**Status:** Proponowana · **Data:** 29.09.2026 · **Decyduje:** właściciel produktu

### Kontekst
ADR-003 wybrał `FORCE RLS` zamiast osobnej roli bazy, bo Netlify Database daje jeden adres połączenia. ADR-002 i tak wymaga przeniesienia bazy do UE przed pilotażem, a region Netlify Database nie jest udokumentowany. Jednocześnie aplikacja jako właściciel tabel może wyłączyć każde zabezpieczenie (punkt 2), a podglądy wdrożeń dostają kopię danych produkcyjnych.

### Opcje

**A. Netlify Database (bez zmian)**

| Wymiar | Ocena |
| --- | --- |
| Złożoność | Niska – migracje i gałęzie podglądów automatycznie |
| Koszt | W cenie Netlify |
| Zgodność z RODO | Niejasny region; podglądy z kopią danych produkcyjnych |
| Bezpieczeństwo | Jedna rola = właściciel; RLS i dziennik do obejścia jednym poleceniem |

**B. Neon we Frankfurcie, dwie role** – `oxy_owner` (migracje, właściciel tabel, używany tylko w CI) i `oxy_app` (runtime: `NOBYPASSRLS`, tylko `SELECT/INSERT/UPDATE/DELETE`, bez własności tabel, bez prawa do `app.audit_purge`)

| Wymiar | Ocena |
| --- | --- |
| Złożoność | Średnia – migracje w CI, dwa adresy połączenia |
| Koszt | Plan Neon Launch (kilkanaście–kilkadziesiąt USD/mies. na pilotaż) |
| Zgodność z RODO | Region UE, gałęzie podglądów tylko na żądanie i z danymi testowymi |
| Bezpieczeństwo | Aplikacja nie może zmienić RLS, wyzwalaczy ani usunąć dziennika |

**C. PostgreSQL na OVHcloud (zarządzany lub własny)**

| Wymiar | Ocena |
| --- | --- |
| Złożoność | Wysoka przy własnym serwerze (kopie, aktualizacje, pooler); średnia przy zarządzanym |
| Koszt | Porównywalny lub niższy przy stałym obciążeniu |
| Zgodność z RODO | Dostawca z UE – najprostsza umowa powierzenia |
| Bezpieczeństwo | Jak B; brak odtwarzania do punktu w czasie i gałęzi „z pudełka” |

### Decyzja (propozycja)
**Opcja B.** Netlify Pro z regionem funkcji `fra` + Neon Frankfurt, osobne role. `withSystem` zostaje, ale `app.system` ustawiany przez rolę aplikacji przestaje dawać dostęp do `ALTER`, `DROP` i `audit_purge` (te wymagają roli właściciela). Retencja dziennika jako procedura `SECURITY DEFINER` uruchamiana z konta właściciela.

Dodatkowo **kotwica dziennika**: raz na dobę `housekeeping-cron` zapisuje najnowszy hash łańcucha każdej organizacji do magazynu S3 z blokadą obiektów (Object Lock, tryb compliance) albo wysyła go e-mailem właścicielowi warsztatu. Wtedy przeliczenie łańcucha w bazie staje się wykrywalne.

### Konsekwencje
- **Łatwiej:** dziennik jest wiarygodnym dowodem; wyciek poświadczeń aplikacji nie wyłącza izolacji; dane w UE; podglądy bez danych produkcyjnych.
- **Trudniej:** migracje trzeba uruchamiać w CI (punkt 7); dwa sekrety bazy; ręczne zakładanie gałęzi dla podglądów.
- **Do przeglądu:** czy polityka `system_all` powinna istnieć dla wszystkich tabel, czy tylko dla `job` i tabel powiadomień.

### Zadania
1. [ ] Utworzyć projekt Neon (Frankfurt), role `oxy_owner` i `oxy_app`, nadać uprawnienia DML dla `oxy_app`.
2. [ ] Migracja: `GRANT`/`REVOKE`, procedura retencji dziennika jako `SECURITY DEFINER`.
3. [ ] CI: `db:migrate` z `oxy_owner` przed publikacją; Netlify dostaje tylko `DATABASE_URL` dla `oxy_app`.
4. [ ] Usunąć `@netlify/database`; Netlify Pro, region `fra`.
5. [ ] Kotwica dziennika w `housekeeping-cron` + test wykrycia przeliczonego łańcucha.
6. [ ] Zaktualizować ADR-002, ADR-003, ADR-005 w dokumencie 03.

---

## Kolejność prac (propozycja)

1. CI (pkt 4) – bo wszystko dalej opiera się na testach.
2. Usunięcie danych demo z migracji (pkt 1).
3. ADR-010: Neon UE + role + kotwica dziennika (pkt 2, 7).
4. Węższe konteksty zamiast `withSystem` (pkt 3).
5. Idempotencja i limity czasu kolejki (pkt 5, 6) – koniecznie przed włączeniem prawdziwych SMS-ów.
6. Pozostałe P1 równolegle z modułami.
