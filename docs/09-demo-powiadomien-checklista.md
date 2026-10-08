# OXY – powiadomienia i SMS: weryfikacja oraz lista rzeczy do dowiezienia przed prezentacją u klienta

**Wersja:** 0.1 · **Data:** 08.10.2026
**Powiązane:** [07-powiadomienia.md](07-powiadomienia.md), [03-architektura-i-infrastruktura.md](03-architektura-i-infrastruktura.md), [05-plan-prac.md](05-plan-prac.md) (E6.3), [.env.example](../.env.example)

Dokument ma dwie części: **co sprawdzono i co wyszło** (sekcja 1) oraz **co trzeba dowieźć i skonfigurować, żeby pokazać SMS, e-mail i push na prawdziwych telefonach** (sekcje 2–6). Sekcja 7 opisuje wariant awaryjny bez zewnętrznych kont.

---

## 1. Wynik weryfikacji (08.10.2026)

### Co sprawdzono i działa

| Obszar | Jak sprawdzone | Wynik |
| --- | --- | --- |
| Logika powiadomień (zespół, klient, kolejka, ponowienia, push → SMS jako zapas, rezygnacje, RLS) | `pnpm test` na lokalnej bazie | 23 pliki, **174 zaliczone**, 1 pominięty (test roli bazy, wymaga uprawnień do tworzenia ról) |
| E-mail do klienta (przez prawdziwe SMTP) | wysyłka szablonów `order-received` i `order-ready` do Mailpit i odczyt wiadomości | temat „Warsztat: przyjęliśmy pojazd …”, nadawca z `MAIL_FROM`, `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click`, treść z terminem, adresem i linkiem do statusu |
| Treść SMS-a | złożenie wiadomości z kodu i policzenie znaków | bez polskich liter (GSM-7), **148–155 znaków = 1 SMS** przy nazwie warsztatu 20 znaków |
| Zgodność z SMSAPI | porównanie kodu `server/lib/sms.ts` z oficjalną dokumentacją sms.do | zgodne: `Authorization: Bearer`, `from`, `format=json`, `encoding=utf-8`, `idx` + `check_idx=1`; błędy 14 (zła nazwa nadawcy), 53 (duplikat `idx` – traktowany jako sukces), 101 (autoryzacja) |
| Build produkcyjny | `pnpm build` | zakończony poprawnie |
| Kolejka i funkcje cykliczne | przegląd kodu `netlify/functions/*`, `/api/internal/jobs/run` | `jobs-cron` co 5 min, `housekeeping-cron` codziennie 03:17 UTC, obie z `INTERNAL_API_KEY` |

### Czego NIE da się sprawdzić lokalnie (dlatego jest w liście niżej)

- **Prawdziwa wysyłka SMS przez SMSAPI.** Lokalnie `SMS_PROVIDER=log` – wiadomość trafia tylko do logu serwera (`[sms:log]`). Bramka nie była testowana na prawdziwym koncie (zadanie E6.3 jest wstrzymane).
- **Push przez prawdziwe usługi Google / Mozilla / Apple.** Lokalny `.env` nie ma kluczy VAPID, więc push jest wyłączony. Szyfrowanie i obsługa błędów są pokryte testami z atrapą usługi push, ale nie sprawdzono ich na urządzeniu.
- **Prawdziwy dostawca SMTP** (SPF/DKIM, dostarczalność do Gmaila).
- **Funkcje cykliczne Netlify** i limity czasu funkcji – nie ma jeszcze projektu Netlify połączonego z tym katalogiem (`.netlify/` jest pusty).
- **iPhone** (push działa tylko po dodaniu strony do ekranu początkowego).

### Ryzyka znalezione w kodzie i konfiguracji

| # | Ryzyko | Skutek na prezentacji | Co zrobić |
| --- | --- | --- | --- |
| 1 | `SMS_PROVIDER` domyślnie `log`, a `SMTP_URL` domyślnie `smtp://localhost:1025`. Na produkcji nic nie ostrzega, że zostały wartości lokalne. | SMS-y „wysyłają się” tylko do logu; e-maile kończą jako błąd w kolejce. Przy wiadomościach do klienta karta zlecenia pokaże „Błąd”, ale e-maile zespołu i zaproszenia giną bez komunikatu. | Ustaw obie zmienne na Netlify i **sprawdź w teście dymnym** (sekcja 4). Karta zlecenia pokazuje ostrzeżenie „Bramka SMS nie jest skonfigurowana”, ale tylko dla SMS. |
| 2 | Pole „Nazwa nadawcy SMS” (Ustawienia) nie jest sprawdzane w bramce. Nazwa niezarejestrowana w SMSAPI daje błąd 14. | Każdy SMS kończy się statusem „Błąd” po 4 próbach (30 s, 1 min, 2 min). | Wpisz nazwę **dopiero po** jej aktywacji w panelu SMSAPI. Puste pole = domyślny nadawca konta w SMSAPI. |
| 3 | SMS dłuższy niż 160 znaków jest rozliczany jako 2 wiadomości. Treść to `{nazwa warsztatu}: … {pojazd} ({numer zlecenia}) … {link}`; link ma ok. 55 znaków. | Dłuższa nazwa warsztatu = podwójny koszt i mniej czytelny SMS. Przykład: „Warsztat Samochodowy Jan Kowalski i Synowie” → 178 znaków = 2 SMS-y. | Dla demo użyj krótkiej nazwy (do ok. 25 znaków). Krótka domena skraca link. |
| 4 | Odpowiedź 403 z usługi push jest traktowana jako trwała (`server/lib/push.ts`) – subskrypcja jest wyłączana. `VAPID_SUBJECT` bez ustawienia przyjmuje adres z `MAIL_FROM`, czyli lokalnie `no-reply@oxy.local`. | Jeśli usługa push (np. Apple) odrzuci klucze lub nadawcę, telefony klientów po cichu wracają do SMS-a i trzeba je włączać od nowa. Nie sprawdziłem, czy Apple odrzuca takiego nadawcę – ustaw prawdziwy adres, żeby nie ryzykować. | Ustaw `VAPID_SUBJECT=mailto:prawdziwy@adres` i **nie zmieniaj kluczy** po włączeniu push. |
| 5 | Ponowienia (`jobs-cron`) i sprzątanie działają tylko na wdrożeniu **produkcyjnym** Netlify, nie na podglądach (deploy preview). | Na podglądzie, jeśli pierwsza próba wysyłki się nie uda, nic jej nie ponowi. | Pokaz rób na wdrożeniu produkcyjnym. |
| 6 | Zmiana `nuxt.config.ts` (cel esbuild `es2022`, literały BigInt) jest **niezatwierdzona** w git. | Netlify buduje z repozytorium – bez tej zmiany build może się nie powieść. Nie sprawdzałem, czy build bez niej pada. | Zatwierdź i wypchnij zmianę przed wdrożeniem. |
| 7 | Workflow CI uruchamia się na push do gałęzi `main`, a domyślna gałąź repozytorium to `master`. | Push do `master` nie uruchamia CI (pull requesty tak). | Do decyzji; nie blokuje prezentacji. |
| 8 | Subskrypcje push są związane z adresem strony. Zmiana domeny albo kluczy VAPID unieważnia włączone powiadomienia. | Trzeba ponownie włączyć push na każdym telefonie. | Wybierz docelowy adres **przed** instalacją aplikacji na telefonach. |

---

## 2. Co musisz dowieźć

Kolejność uwzględnia czasy oczekiwania – to, co zależy od zewnętrznych firm, załatw najpierw.

### A. Konta i dostępy (zacznij od razu)

| Co | Po co | Uwagi |
| --- | --- | --- |
| **Konto SMSAPI.pl z doładowaniem** i **token OAuth** z prawem wysyłania SMS | prawdziwe SMS-y | Token wkleisz jako `SMSAPI_TOKEN`. Doładuj na kilkadziesiąt wiadomości: każda próba, także testowa, kosztuje. |
| **Nazwa nadawcy SMS** zarejestrowana w panelu SMSAPI („Pola nadawcy”), do 11 znaków, litery bez polskich znaków, cyfry, spacja, kropka, myślnik | SMS od „AUTOSERWIS” zamiast domyślnego nadawcy | Dokumentacja SMSAPI **nie podaje czasu akceptacji** – załóż zapas i złóż wniosek jako pierwszy. Bez niej demo też zadziała (patrz ryzyko 2). |
| **Dostawca SMTP** z serwerami w UE i **domena nadawcy** z SPF, DKIM i DMARC | e-maile do klienta i zespołu | Potrzebujesz: adres SMTP w formie `smtps://użytkownik:hasło@host:465` (znaki specjalne w haśle zakoduj) i adres nadawcy do `MAIL_FROM`. Bez uwierzytelnionej domeny wiadomości mogą trafić do spamu. |
| **Netlify** z projektem połączonym z repozytorium `waveex/mechanical-board` i gałęzią produkcyjną | wdrożenie pod HTTPS (push działa tylko przez HTTPS) | Wybierz docelowy adres (własna domena albo `*.netlify.app`) i go nie zmieniaj. |
| **Baza PostgreSQL** (Netlify Database albo Neon w UE) | dane warsztatu | Zgodnie z [03-architektura-i-infrastruktura.md](03-architektura-i-infrastruktura.md) i ADR-010. |
| **Magazyn S3** (np. OVHcloud Object Storage w UE) | logo i zdjęcia przy zleceniu | Poza powiadomieniami, ale potrzebny do pełnego demo zlecenia. |

### B. Dane i urządzenia do demo

| Co | Uwagi |
| --- | --- |
| **Krótka nazwa demo-warsztatu** (do ok. 25 znaków), telefon, adres, logo | Nazwa idzie do SMS-a, tytułu e-maila i push; telefon i adres do stopki e-maila i strony statusu. Ustawiasz w Ustawienia → Dane firmy. |
| **Telefon „klienta”** z prawdziwym numerem, najlepiej **iPhone i Android** | Numer wpisz w karcie klienta (format `600100200` albo `+48600100200`; system dopisze `+48`). Zdecyduj, czyj to numer – osoby z klienta wymagają jej zgody na SMS testowy. |
| **Adres e-mail klienta** dostępny na pokazie | Do pokazania e-maila ze stopką i rezygnacją jednym kliknięciem. |
| **Telefon „mechanika”** i **komputer „biura”** | Do pokazania dzwonka i push w zespole. Konta: właściciel + minimum 1 mechanik (zaproszenie e-mailem – stąd działający SMTP). |
| **Wersja iOS ≥ 16.4** na telefonie z iPhonem | Starsze iPhone’y nie obsługują push w przeglądarce. |

### C. Sekrety do wygenerowania

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # BETTER_AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # STATUS_LINK_SECRET (inny)
node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"   # INTERNAL_API_KEY
pnpm push:keys                                                                  # VAPID_PUBLIC_KEY i VAPID_PRIVATE_KEY
```

`STATUS_LINK_SECRET` ustaw **przed** wysłaniem pierwszego linku – jego zmiana unieważnia linki wysłane wcześniej. Zapisz wszystkie sekrety w menedżerze haseł; nie wklejaj ich do czatu ani do repozytorium.

---

## 3. Konfiguracja

### Zmienne środowiskowe na Netlify

Project configuration → Environment variables. Zakres: **Builds, Functions i Runtime** (funkcje serwera i funkcje cykliczne czytają je w czasie działania).

| Zmienna | Wartość | Wymagana do |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | losowy, min. 32 znaki | logowanie |
| `STATUS_LINK_SECRET` | losowy, min. 32 znaki, inny niż powyżej | linki do strony statusu |
| `BETTER_AUTH_URL` | docelowy adres z `https://` | linki w SMS-ach i e-mailach (bez niej używany jest adres Netlify) |
| `INTERNAL_API_KEY` | losowy, min. 24 znaki | funkcje cykliczne (ponowienia, sprzątanie) |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | `false` na pokaz, `true` po sprawdzeniu poczty | rejestracja |
| `SMTP_URL`, `MAIL_FROM` | z dostawcy SMTP, np. `Auto Serwis <powiadomienia@twojadomena.pl>` | e-maile |
| `SMS_PROVIDER` | `smsapi` | SMS |
| `SMSAPI_TOKEN` | token z panelu SMSAPI | SMS |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | z `pnpm push:keys` | push zespołu i klienta |
| `VAPID_SUBJECT` | `mailto:prawdziwy@adres` | push (patrz ryzyko 4) |
| `DATABASE_URL` i pozostałe | zgodnie z ADR-010 | baza |
| `S3_*` | z dostawcy magazynu | zdjęcia, logo |

Po zmianie zmiennych **wdróż ponownie**.

### Ustawienia w aplikacji

1. Zaloguj się jako właściciel, utwórz warsztat.
2. **Ustawienia → Dane firmy:** nazwa, telefon, adres, logo.
3. **Ustawienia → Nazwa nadawcy SMS:** wpisz **dopiero po** aktywacji w SMSAPI, albo zostaw puste.
4. **Ustawienia → Powiadomienia klienta:** domyślnie „Przyjęcie pojazdu” i „Gotowe do odbioru” wysyłają SMS (albo push) i e-mail automatycznie. Dla pokazu zostaw włączone.
5. **Klienci:** dodaj klienta demo z prawdziwym numerem i e-mailem.
6. Na telefonie mechanika i biura: **Powiadomienia → Ustawienia powiadomień**, włącz push na tym urządzeniu (jest przycisk powiadomienia próbnego). Na iPhonie najpierw: Udostępnij → „Dodaj do ekranu początkowego” i otwórz aplikację z ikony.

---

## 4. Test dymny (dzień przed prezentacją)

Wykonaj dokładnie w tej kolejności, na wdrożeniu produkcyjnym i na tych telefonach, których użyjesz na pokazie.

| # | Krok | Oczekiwany wynik | Jeśli nie |
| --- | --- | --- | --- |
| 1 | Otwórz aplikację z telefonu | strona działa przez HTTPS, adres jest ostateczny | popraw `BETTER_AUTH_URL` i wdróż ponownie |
| 2 | Funkcja cykliczna: `curl -X POST https://TWOJ-ADRES/api/internal/jobs/run -H "x-internal-key: KLUCZ"` | odpowiedź 200 z podsumowaniem; w logach Netlify po kilku minutach wpis `[jobs-cron] 200` | 401 = zły klucz; brak wpisu = wdrożenie nie jest produkcyjne |
| 3 | Zaproszenie mechanika e-mailem | wiadomość dochodzi do skrzynki, **nie do spamu** | zły `SMTP_URL`/`MAIL_FROM`, brak SPF/DKIM |
| 4 | Biuro: powiadomienie próbne push | „Dzwoni” telefon z push w kilka sekund | patrz sekcja 6 |
| 5 | Nowe zlecenie dla klienta demo, krok 4 „Powiadomienie klienta” zaznaczony | w karcie zlecenia → „Wysłane wiadomości”: **Wysłano · SMS** i **Wysłano · e-mail**; SMS i e-mail dochodzą | „Błąd” z treścią w karcie; zob. ryzyka 1–2 |
| 6 | Sprawdź SMS: nadawca, polskie znaki (powinny być bez), liczba części | 1 SMS, link otwiera stronę statusu | długa nazwa warsztatu (ryzyko 3) |
| 7 | Na stronie statusu na telefonie klienta włącz „Powiadomienia w tym telefonie” | stan „włączone”; w karcie zlecenia: „Klient włączył powiadomienia w telefonie – zamiast SMS-a dostanie push” | iPhone: najpierw dodaj stronę do ekranu początkowego |
| 8 | Zmień status na „Gotowe do odbioru” (okno „Zmień status i powiadom”) | klient dostaje **push** (nie SMS) oraz e-mail | push zniknął → sprawdź `VAPID_*` i wpis w dzienniku |
| 9 | Na stronie statusu wyłącz powiadomienia w telefonie, wyślij ręcznie wiadomość „Wyślij wiadomość” | wiadomość idzie SMS-em | sprawdza fallback |
| 10 | Link rezygnacji w stopce e-maila („Nie chcesz takich e-maili?”) | rezygnacja zapisana; karta klienta pokazuje wyłączony e-mail | |

Po teście **wyczyść dane testowe** albo zmień numer klienta demo na ten, który ma zostać na pokazie. Zlecenie, które dostało już wiadomość automatyczną, drugiej automatycznie nie wyśle (potwierdzenie „Powiadom klienta” wyśle ponownie).

---

## 5. Scenariusz prezentacji (ok. 8 minut)

1. **Przyjęcie pojazdu.** Biuro tworzy zlecenie, pole „Powiadom klienta” jest zaznaczone. W ciągu kilku sekund telefon klienta dostaje SMS z linkiem i e-mail. Pokaż kartę „Powiadomienia klienta”: co, którym kanałem, z jakim skutkiem.
2. **Strona statusu bez logowania.** Klient otwiera link: etap naprawy, termin, kontakt, zamaskowany numer i e-mail, bez cen. Włącza „Powiadomienia w tym telefonie”.
3. **Mechanik.** Dostaje push o nowym zadaniu. Zgłasza potrzebę (część albo praca dodatkowa). Biuro dostaje dzwonek i push.
4. **Prośba o akceptację.** Biuro wysyła ją klientowi – przychodzi **push zamiast SMS-a** (oszczędność kosztu). Klient akceptuje; biuro dostaje push i e-mail z odpowiedzią.
5. **Gotowe do odbioru.** Mechanik kończy ostatnie zadanie – biuro dostaje push „wszystkie zadania zakończone”. Zmiana statusu z oknem „Powiadom klienta”: klient dostaje wiadomość.
6. **Kontrola klienta.** Rezygnacja z SMS-ów lub e-maili jednym kliknięciem, „Nowy link” unieważniający poprzedni, licznik wyświetleń linku w zleceniu.

**Plan B, gdy coś nie dojdzie:** zawsze jest dziennik w karcie zlecenia (status „Błąd” z przyczyną), dzwonek w aplikacji działa bez push, a e-mail dochodzi niezależnie od SMS-a. Miej pod ręką wydruk albo zrzut ekranu SMS-a z testu dymnego.

---

## 6. Gdy push nie działa

| Objaw | Przyczyna | Co zrobić |
| --- | --- | --- |
| Brak przycisku włączenia, informacja o braku konfiguracji | brak `VAPID_*` na serwerze | ustaw klucze i wdróż ponownie |
| Brak przycisku na iPhonie | strona nie jest dodana do ekranu początkowego albo iOS < 16.4 | Udostępnij → „Dodaj do ekranu początkowego”, otwórz z ikony |
| Włączone, ale powiadomienie nie przychodzi i znika ze stanu „włączone” | klucze VAPID zmienione po włączeniu albo odrzucenie przez usługę push (404/410/403) | włącz push ponownie; nie zmieniaj kluczy |
| Powiadomienia zablokowane | uprawnienie odrzucone w przeglądarce | odblokuj w ustawieniach witryny / telefonu |
| Działa na komputerze, nie na telefonie | strona otwarta przez HTTP | używaj adresu `https://` |

---

## 7. Wariant awaryjny: demo lokalne bez zewnętrznych kont

Pokazuje całą logikę, ale **nie** prawdziwy SMS ani push na telefonie klienta.

```bash
pnpm run local     # Docker, migracje, serwer na http://localhost:3000
pnpm push:keys     # wklej wynik do .env (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY), uruchom serwer ponownie
```

- E-maile: Mailpit pod `http://localhost:8025`.
- SMS: wpisy `[sms:log]` w logu serwera (numer i link zamaskowane).
- Push na tym samym komputerze działa w Chrome na `localhost` (to wyjątek od wymogu HTTPS).
- Link ze SMS-a otwiera się tylko na tym komputerze – telefon nie zobaczy `localhost`.
- Dane przykładowe: `pnpm db:seed:demo` (wymaga `DEMO_OWNER_EMAIL` – adresu właściciela warsztatu; szczegóły w README).

---

## 8. Czego nie obiecywać klientowi

- Raportów doręczenia SMS i licznika SMS-ów warsztatu jeszcze nie ma (E6.3).
- Raport końcowy dla klienta (E5.7), rejestr zgód marketingowych (E6.1) i przypomnienia o terminie odbioru są w planie.
- Wiadomości o przyjęciu i gotowości są traktowane jako transakcyjne, z możliwością rezygnacji; ocena prawna czeka na prawnika ([07-powiadomienia.md](07-powiadomienia.md), sekcja 7).
- Push na iPhonie wymaga dodania strony do ekranu początkowego.
- Brak godzin ciszy i grupowania powiadomień.
