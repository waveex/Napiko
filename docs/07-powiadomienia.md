# OXY – powiadomienia (zespół, klient, push)

**Wersja:** 0.1 · **Data:** 29.09.2026
**Powiązane:** [02-decyzje-produktowe.md](02-decyzje-produktowe.md) (D5), [03-architektura-i-infrastruktura.md](03-architektura-i-infrastruktura.md), [04-moduly-warsztatu.md](04-moduly-warsztatu.md), [05-plan-prac.md](05-plan-prac.md) (E5.6, E6.2, E6.4, E8.5), [README](../README.md)

System powiadomień ma trzy części: **dzwonek w aplikacji** dla mechaników i biura, **wiadomości do klienta** (SMS albo push, e-mail) z linkiem do **strony statusu naprawy** oraz **powiadomienia push** w przeglądarce i w aplikacji zainstalowanej na telefonie (PWA).

Decyzje (29.09.2026):

- zespół dostaje powiadomienia w aplikacji, e-mailem i jako push – każda osoba wybiera kanały sama;
- klient dostaje SMS-a albo powiadomienie push przy trzech zdarzeniach z decyzji D5 (przyjęcie pojazdu, prośba o akceptację, gotowość do odbioru), z linkiem do strony statusu naprawy bez logowania; pozostałe informacje widzi na tej stronie albo dostaje e-mailem;
- przy przyjęciu zlecenia i zmianie statusu na „Gotowe do odbioru” biuro widzi zaznaczone pole „Powiadom klienta” i może je odznaczyć; ustawienia warsztatu wybierają, które zdarzenia i kanały są proponowane.

---

## 1. Kto co dostaje

Dzwonek w aplikacji działa zawsze; e-mail i push zależą od ustawień osoby (kolumna „Domyślnie”).

### Mechanik i biuro (zespół)

| Zdarzenie | Kto | Domyślnie |
| --- | --- | --- |
| Nowe zadanie (ktoś Ci je przydzielił) | osoba przypisana do zadania | push |
| Zadanie zdjęte z Twojej listy | osoba, której zabrano zadanie | – |
| Nowe zadania do wzięcia (przy zasadzie „mechanicy sami biorą zadania”) | mechanicy; biuro pomijamy, bo samo przydziela | push |
| Zgłoszenie potrzeby (część, praca dodatkowa) | biuro i właściciel, którzy wyceniają | push |
| Decyzja w zgłoszeniu – przez biuro albo klienta (zatwierdzone: zadanie jest na liście mechanika) | mechanik, który zgłosił | push |
| Część zamówiona | mechanik, który zgłosił | – |
| Część dostarczona | zgłaszający i osoby przypisane do wstrzymanego zadania | push |
| Odpowiedź klienta na prośbę o akceptację (prace dodatkowe, kosztorys) | osoba, która wysłała prośbę; gdy jej nie ma w zespole – osoby z prawem decyzji | push i e-mail |
| Link do akceptacji wygasł bez odpowiedzi | jak wyżej | e-mail |
| Wszystkie zadania zlecenia zakończone – można oznaczyć jako gotowe do odbioru | biuro i właściciel | push |

Zasady: nikt nie dostaje powiadomienia o własnym działaniu; anulowane zadania nie liczą się do „wszystkie zakończone”; ustawienia pokazują tylko te typy, które dana rola może dostać.

### Klient

| Zdarzenie | Kanał | Kiedy |
| --- | --- | --- |
| Przyjęcie pojazdu | SMS albo push, e-mail | przy przyjęciu zlecenia, gdy pole „Powiadom klienta” jest zaznaczone |
| Gotowe do odbioru | SMS albo push, e-mail | przy zmianie statusu na „Gotowe do odbioru”, w oknie z polem „Powiadom klienta” |
| Prośba o akceptację prac dodatkowych albo kosztorysu | SMS albo push, albo e-mail | biuro wysyła ręcznie i samo wybiera kanał (istniejący przepływ, etap 3) |

Raport końcowy dla klienta dojdzie z zadaniem E5.7.

---

## 2. Zespół: dzwonek, lista i ustawienia

- **Dzwonek** jest w panelu bocznym (komputer) i w prawym górnym rogu (telefon). Licznik odświeża się co 30 s przy widocznej karcie, po powrocie do karty i od razu po powiadomieniu push. Nowe zdarzenia pokazują się także jako wyskakujące okienko.
- **Lista** (kliknięcie w dzwonek: ostatnie 15; strona „Powiadomienia”: wszystkie, z filtrem „nieprzeczytane” i doczytywaniem). Kliknięcie powiadomienia oznacza je jako przeczytane i przenosi do zlecenia albo do „Moich zadań”. Gdy powiadomienie dotyczy innego warsztatu tej samej osoby, aplikacja sama go przełącza; nieprzeczytane w innych warsztatach pokazuje podpowiedź w dzwonku.
- **Ustawienia** (strona „Powiadomienia” → „Ustawienia” albo menu użytkownika): dla każdego typu przełączniki push i e-mail oraz włączenie push na tym urządzeniu z próbnym powiadomieniem. E-maile idą na adres konta, w języku warsztatu.
- **Wspólny telefon:** subskrypcja push należy do osoby, nie do warsztatu. Przy wylogowaniu push na tym urządzeniu jest wyłączany, a po zalogowaniu kogoś innego strona pokazuje „Włącz”, a nie „Włączone”. Jedna osoba ma najwyżej 10 urządzeń (najstarsze są usuwane).

---

## 3. Klient: wiadomości, strona statusu, ustawienia

### Ustawienia warsztatu i karta zlecenia

- **Ustawienia → Powiadomienia klienta:** dla „Przyjęcie pojazdu” i „Gotowe do odbioru” – czy proponować wysłanie (pole „Powiadom klienta” zaznaczone od razu) oraz kanały: telefon (SMS albo push) i e-mail. Domyślnie oba zdarzenia i oba kanały. Zmiany trafiają do dziennika zdarzeń.
- **Nowe zlecenie:** krok „4. Powiadomienie klienta” z opisem, którymi kanałami wyślemy (np. „SMS, e-mail”). Gdy klient nie ma numeru ani adresu albo z nich zrezygnował, pole jest nieaktywne z wyjaśnieniem.
- **Zmiana statusu na „Gotowe do odbioru”:** okno „Zmień status i powiadom” z zaznaczonym polem; biuro może je odznaczyć i zmienić sam status.
- **Karta „Powiadomienia klienta” w zleceniu:** dziennik wiadomości (co, którym kanałem, z jakim skutkiem), ręczna wysyłka lub ponowienie (wybór kanałów), link do strony statusu z kopiowaniem i unieważnieniem („nowy link”, gdy poszedł na zły numer). Numer i adres widzi tylko rola z dostępem do danych kontaktowych.

### Karta klienta

Karta „Wiadomości o naprawie”: przełączniki SMS i e-mail (rezygnacja klienta) oraz lista „zarejestrowanych telefonów”, czyli urządzeń z włączonym push, z możliwością wyłączenia. Rezygnacja klient może też zgłosić sam na stronie statusu albo jednym kliknięciem w e-mailu.

### Reguły wysyłki

- **Automatycznie tylko raz** na zlecenie i zdarzenie; potwierdzenie biura („Powiadom klienta”) albo ręczna wysyłka wysyła ponownie.
- **Push zamiast SMS-a:** gdy klient włączył powiadomienia na stronie statusu, a numer w jego karcie jest ten sam co przy włączeniu, wiadomość idzie push (bez kosztu SMS-a). Gdy push przestanie działać (klient wyłączył powiadomienia, zmienił telefon), zadanie w kolejce wysyła SMS-a. Po zmianie numeru w karcie klienta stare urządzenie przestaje być używane i wiadomości idą SMS-em.
- **SMS bez polskich znaków** (kodowanie GSM-7, tańsze). W logach SMS jest bez numeru i linku.
- **Rezygnacja** z SMS-ów albo e-maili (karta klienta, strona statusu, e-mail) zatrzymuje wiadomości automatyczne. Prośby o akceptację wysyła biuro świadomie na wybrany numer lub adres, więc rezygnacja ich nie blokuje.
- **Brak numeru lub adresu i rezygnacja** są odnotowane w dzienniku wiadomości jako „pominięte” z powodem.
- **E-mail:** w temacie, treści i stopce nadawcą jest warsztat (nazwa, telefon, adres), a technicznie wiadomość wysyła OXY z adresu `MAIL_FROM`. Nagłówki `List-Unsubscribe` i `List-Unsubscribe-Post` (RFC 8058) dają rezygnację jednym kliknięciem; nazwa warsztatu jest w treści zabezpieczona przed wstrzyknięciem HTML.
- **Treść i link** z wiadomości są tylko w zadaniu kolejki i znikają po wysłaniu; dziennik zdarzeń (`customer.notified`) nie zawiera numeru ani adresu.

### Strona statusu naprawy

Adres `/s/<token>` z SMS-a lub e-maila działa bez logowania i instalowania aplikacji.

- **Widać:** etap naprawy (przyjęty → w naprawie → gotowy do odbioru → odebrany) z datami, postęp prac („2 z 3”), planowany termin odbioru, informację „Pojazd czeka na odbiór” z adresem warsztatu, kontakt (telefon, e-mail, adres) i ustawienia powiadomień.
- **Nie widać:** cen, notatek, nazwisk zespołu ani danych klienta. Numer telefonu i adres e-mail są zamaskowane („••• ••• 200”, „j•••@example.com”).
- **Ustawienia klienta:** „Powiadomienia w tym telefonie” (push zamiast SMS-a; na iPhonie po dodaniu strony do ekranu początkowego) oraz przełączniki SMS i e-mail.
- **Ochrona linku:** token ma 24 znaki (144 bity) i jest wyliczany z sekretu serwera (HMAC), więc ten sam link można odtworzyć przy kolejnej wiadomości, a w bazie jest tylko jego skrót. „Nowy link” zwiększa wersję i unieważnia poprzedni. Po zamknięciu albo anulowaniu zlecenia link działa jeszcze 30 dni. Strona ma `noindex`, `no-referrer` i `no-store`, a dane ładują się dopiero w przeglądarce, więc podgląd linku w komunikatorze nie liczy się jako wyświetlenie. Zespół warsztatu widzi „Podgląd warsztatu” bez liczenia wyświetleń i bez zmian za klienta.
- Karta zlecenia pokazuje biuru, ile razy i kiedy ostatnio klient otworzył stronę.

---

## 4. Push (Web Push) – jak włączyć

1. Wygeneruj parę kluczy: `pnpm push:keys`.
2. Wklej wynik do `.env` (lokalnie) albo do zmiennych środowiskowych Netlify: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`; opcjonalnie `VAPID_SUBJECT` (`mailto:…` albo `https://…`, domyślnie adres z `MAIL_FROM`).
3. Uruchom serwer ponownie. Bez kluczy push jest wyłączony: zespół ma dzwonek i e-mail, klient SMS-a, a ustawienia pokazują informację, że push nie jest skonfigurowany na serwerze.

Zmiana kluczy unieważnia włączone powiadomienia – użytkownicy muszą włączyć je ponownie.

Wymagania i zachowanie:

- **HTTPS** (lokalnie wyjątek dla `localhost`). Działa w Chrome, Edge, Firefox i Safari 16.4+.
- **iPhone i iPad:** push działa tylko w aplikacji dodanej do ekranu początkowego (Udostępnij → „Dodaj do ekranu początkowego”). Strona pokazuje wtedy instrukcję zamiast przycisku.
- **Service worker** `public/sw.js` odbiera push, pokazuje powiadomienie i po dotknięciu otwiera aplikację (albo aktywuje otwartą kartę i odświeża licznik dzwonka). Manifest PWA (`public/manifest.webmanifest`) i ikony pozwalają zainstalować aplikację z przeglądarki; strona statusu ma własny manifest i ikonę.
- Wiadomość czeka w usłudze push do 24 h (zespół) albo 48 h (klient), gdy telefon jest bez zasięgu; znacznik (`tag`) podmienia powtórzoną wiadomość zamiast dublować.
- Subskrypcje, które usługa push uznała za nieważne (wygasłe albo zablokowane w telefonie: 404 / 410, a także 400 / 403 / 413), są usuwane (zespół) albo wyłączane (klient) – klient wraca wtedy do SMS-a. Chwilowe awarie (sieć, 5xx) są ponawiane.
- Najwyżej 5 zarejestrowanych telefonów jednego klienta.

---

## 5. Jak to działa

- **Jedna funkcja rozsyła zdarzenie** (`notifyTeam` w `server/db/notifications.ts`): zapis w tabeli `notification` (dzwonek) i zadania w kolejce (`push.send`, `email.send`) w tej samej transakcji co zmiana danych – nie ma sytuacji „zlecenie zmienione, ale powiadomienie zginęło”.
- **Wysyłka:** zaraz po żądaniu kolejka jest przetwarzana z limitem ok. 2,5 s (na Netlify po odpowiedzi, jeśli platforma na to pozwala); zaległości i ponowienia obsługuje funkcja cykliczna co 5 min. Zadania: `push.send` (maks. 5 prób), `customer-notification.send` (maks. 4 próby; push przechodzi na SMS-a przy ostatniej), `approval.expiry-check` (po terminie linku – jedno powiadomienie dla biura na prośbę).
- **Teksty** są w tłumaczeniach (`notifications.text.*` w `i18n/locales`), wspólne dla dzwonka, e-maila i push – serwer czyta te same pliki. Zespół dostaje treść w języku warsztatu; wiadomości do klientów są po polsku.
- **Sprzątanie:** funkcja cykliczna `housekeeping-cron` (codziennie 03:17 UTC) wywołuje `/api/internal/housekeeping` (klucz `INTERNAL_API_KEY`) i usuwa przeczytane powiadomienia starsze niż 90 dni, wszystkie starsze niż 180 dni, wykonane zadania kolejki starsze niż 30 dni i wyłączone telefony klientów sprzed roku.
- **Prywatność:** powiadomienia zespołu zawierają tylko teksty i liczby, bez danych kontaktowych klienta; treść powiadomienia jest niezmienna (wyzwalacz w bazie), odbiorca może tylko oznaczyć je jako przeczytane; linki prowadzą wyłącznie do ścieżek w aplikacji.

### Tabele (migracja `20260929080000_notifications`)

| Tabela | Opis | RLS |
| --- | --- | --- |
| `notification` | Powiadomienia zespołu (dzwonek) | ✔ FORCE: każdy czyta, oznacza i usuwa tylko swoje; dodać może każdy członek warsztatu |
| `notification_preference` | Kanały (e-mail, push) dla typu powiadomienia; brak wiersza = wartości domyślne | ✔ FORCE: czyta zespół, zmienia tylko właściciel wiersza |
| `push_subscription` | Urządzenia członków zespołu z włączonym push (należą do osoby, nie do warsztatu) | ✔ FORCE: tylko właściciel |
| `customer_push_subscription` | „Zarejestrowane telefony” klientów (push zamiast SMS-a) | ✔ FORCE |
| `customer_notification` | Dziennik wiadomości do klienta: zdarzenie, kanał, skutek, powód pominięcia | ✔ FORCE |
| `work_order_status_link` | Skrót tokenu strony statusu, wersja, liczba wyświetleń | ✔ FORCE |

Dochodzą kolumny: `organization_settings.customer_notifications` (zdarzenia i kanały automatyczne) oraz `customer.notify_sms` i `customer.notify_email` (rezygnacja klienta).

### Główne endpointy

| Endpoint | Rola |
| --- | --- |
| `GET /api/notifications`, `/summary`; `POST /read`; `GET /:id/target` | lista, licznik, oznaczanie, przejście do celu |
| `GET/PUT /api/notifications/preferences` | ustawienia kanałów osoby |
| `POST /api/push/subscriptions`, `/check`, `/unsubscribe`, `/test` | push zespołu na urządzeniu |
| `GET/PUT /api/org/notification-settings` | automatyczne powiadomienia klienta (uprawnienie `settings`) |
| `GET/POST /api/work-orders/:id/customer-notifications`, `POST /status-link` | dziennik, ręczna wysyłka i link (uprawnienie `customerNotification`: biuro i właściciel) |
| `DELETE /api/customers/:id/push-devices/:deviceId` | wyłączenie „zarejestrowanego telefonu” |
| `GET /api/public/status/:token`, `/manifest`; `POST /push`, `/preferences`, `/unsubscribe` | strona statusu klienta (bez logowania) |
| `POST /api/internal/housekeeping` | sprzątanie (klucz wewnętrzny) |

---

## 6. Uruchomienie i wdrożenie

1. `pnpm install` (nowa zależność `web-push`) i `pnpm db:migrate` (Netlify stosuje migracje przy wdrożeniu).
2. `pnpm push:keys` i zmienne `VAPID_*` – zob. sekcja 4.
3. Na Netlify pojawia się druga funkcja cykliczna, `housekeeping-cron`; wymaga `INTERNAL_API_KEY`, tak jak `jobs-cron`. Nie działa na podglądach wdrożeń.
4. SMS: bez zmian (`SMS_PROVIDER`, `SMSAPI_TOKEN`, nazwa nadawcy). Bramka nadal nie była sprawdzona na prawdziwym koncie (E6.3); domyślny tryb `log` zapisuje wiadomości tylko w logach serwera, a okna „Powiadom klienta” pokazują o tym ostrzeżenie.
5. **Uwaga:** tokeny linków statusu są liczone z `BETTER_AUTH_SECRET`. Zmiana sekretu unieważnia linki wysłane wcześniej (kolejna wiadomość wyśle nowy).

---

## 7. Do weryfikacji z prawnikiem (uzupełnienie punktu 6 dokumentu 04)

1. Wiadomości o przyjęciu pojazdu i gotowości do odbioru traktujemy jako **transakcyjne** (związane z realizacją usługi), z możliwością rezygnacji. Rejestr zgód na kontakt marketingowy (art. 398 PKE) to osobne zadanie E6.1.
2. **Push w telefonie klienta:** klient sam włącza go na stronie statusu (zgoda przeglądarki). Przechowujemy adres subskrypcji, numer telefonu i nazwę przeglądarki; wyłączone urządzenia usuwamy po roku. Do ustalenia: okres przechowywania i treść informacji na stronie.
3. **Strona statusu bez logowania:** każdy, kto ma link, widzi pojazd, etap naprawy i kontakt do warsztatu (bez cen i danych klienta). Do oceny: czy zakres danych jest wystarczająco ograniczony, a 30 dni po zamknięciu – właściwym okresem ważności linku.
4. **Dziennik wiadomości** (`customer_notification`) i wpisy `customer.notified` – okres przechowywania razem z pozostałymi dowodami.

---

## 8. Testy

| Zestaw | Zakres | Wynik |
| --- | --- | --- |
| `pnpm test` (dwa nowe pliki: `notifications.test.ts`, `notification-events.test.ts`) | Izolacja i uprawnienia (RLS), rozsyłanie według uprawnień i ustawień, teksty PL i EN, link do statusu (HMAC, wersje), przyjęcie i gotowość (automat raz, potwierdzenie ponownie), brak numeru i rezygnacja, push zamiast SMS-a z SMS-em jako zapasem, ponowienia, martwe urządzenia, wygaśnięcie linku, sprzątanie, szablony e-mail, SMS bez znaków spoza GSM-7, maskowanie na stronie statusu | 139 / 139 (razem z pozostałymi 11 plikami) |
| E2E etap 5 (API) | Push z prawdziwym szyfrowaniem (aes128gcm, VAPID) do atrapy usługi push z odszyfrowaniem treści, e-mail z `List-Unsubscribe`, SMS w logu bez numeru, strona statusu (etapy, maskowanie, wyświetlenia, podgląd), push zamiast SMS-a, rezygnacja jednym kliknięciem, unieważnienie linku, uprawnienia (403), usuwanie martwych urządzeń (410) | 64 / 64 |
| Przegląd w przeglądarce | Biuro (komputer i telefon), mechanik i klient (telefon 390 px): dzwonek, lista, ustawienia, okno „Powiadom klienta”, nowe zlecenie, ustawienia warsztatu, karta klienta, strona statusu – bez błędów w konsoli | ✓ |

## 9. Ograniczenia i następne kroki

- Dzwonek odświeża się co 30 s i po pushu; aktualizacje na żywo (WebSocket) dojdą później.
- Brakuje raportu końcowego dla klienta (E5.7), rejestru zgód (E6.1) i przypomnień o terminie odbioru.
- SMSAPI na produkcji wymaga testu na prawdziwym koncie (E6.3).
- Push natywny w aplikacjach ze sklepów (Capacitor) – zadanie E10.4.
- Brak godzin ciszy i grupowania powiadomień – do rozważenia po pilotażu.
