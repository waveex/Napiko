# 05 — Plan prac OXY

Stan na 29.09.2026. Żywa wersja ze statusami to artefakt **„Plan prac OXY”** (https://claude.ai/artifact/EcRpKhpcZeHpkwwfG4pcNN) — tam zmienia się statusy i tam są aktualne. Ten dokument to zrzut struktury planu: etapy, zadania, kto je robi i co od czego zależy.

Właściciel: **Claude** (budowa aplikacji), **Michał**, **prawnik**, **warsztaty** (pilotaż). Rozmiar: S — do dnia pracy, M — kilka dni, L — tydzień lub więcej. „Po:” — zadania, które muszą być skończone wcześniej.

## Podsumowanie

| Wydanie | Etapy | Zadania | Zrobione |
|---|---|---|---|
| v1.0 — pilotaż w 3–5 warsztatach | E0, E1, E2, E3, D, E4, K, E5, E6, E7, E8, E9 | 64 | 22 |
| v1.1 — start komercyjny | E10 | 9 | 0 |
| v2 — rozwój | E11 | 4 | 0 |

## Zrobione

- **E0 Fundament techniczny** — Konta, warsztaty i role; Izolacja danych warsztatów (RLS); Pliki, dziennik zdarzeń, kolejka, e-mail; Konfiguracja Netlify i dokumentacja architektury.
- **E1 Klienci, pojazdy, zlecenia** — Klienci; Pojazdy wszystkich typów; Zlecenia, zadania i przydział mechaników.
- **E2 Widok mechanika** — Moje zadania i licznik czasu; Zgłaszanie potrzeb i wycena; Zdjęcia i filmy w zleceniu.
- **E3 Akceptacja klienta przez link** — Prośba o akceptację i strona klienta; Dowód zgody i skutki w zleceniu.

## v1.0 — pilotaż w 3–5 warsztatach

### D · Decyzje i sprawy formalne

Rzeczy po Twojej stronie – bez nich nie ruszy pilotaż. Można je robić równolegle z budową.

- **D.1 Zatwierdź decyzje D1–D7 albo wskaż zmiany** (Michał · S · zrobione). Decyzje zapisane w dokumencie 02 (26.09.2026). D1 szerzej niż rekomendacja: auta, maszyny rolnicze i budowlane, podnośniki i wózki widłowe już w v1.0, z katalogiem pojazdów i schematami – nowy etap K. D2–D7 zgodnie z rekomendacjami.
- **D.2 Rozmowy z 5–8 warsztatami z Podlasia** (Michał · S). Pokaż działającą aplikację (przyjęcie, akceptacja klienta, widok mechanika). Zapytaj o cenę, program do faktur, kasę fiskalną i SMS-y. Scenariusz rozmowy przygotuje Claude.
- **D.3 Konsultacja prawna przed pilotażem** (prawnik · M). Pytania z dokumentów 02 (pkt 3), 04 (pkt 6) i 07 (pkt 7): forma dokumentowa akceptacji, treść zgody, umowa na odległość, role RODO, okresy przechowywania, SMS-y a zgody (PKE), push w telefonie klienta, strona statusu bez logowania. Doszły: odczyt kodu Aztec z dowodu rejestracyjnego (K.5), prawa do dokumentacji wgrywanej przez warsztaty (K.8), przypomnienia o terminach UDT a zgody (K.6).
- **D.4 Regulamin, polityka prywatności, umowa powierzenia** (prawnik · M · po: D.3). Teksty prawne OXY: regulamin dla warsztatów, polityka prywatności, wzór umowy powierzenia danych (warsztat = administrator, OXY = podmiot przetwarzający).
- **D.5 Znak „OXY” i forma prawna** (Michał · S). Sprawdzenie w bazach EUIPO i UPRP, czy nazwa nie koliduje z zarejestrowanymi znakami (D13). Forma prawna przed pierwszą umową z warsztatem.
- **D.6 Konta usług zewnętrznych** (Michał · S · po: D.1). Netlify Pro (region UE), magazyn plików w UE (np. OVHcloud), poczta z serwerami w UE, SMSAPI (z nazwą nadawcy), konto testowe Fakturowni, domena. Claude przygotuje listę kroków do każdego konta.
- **D.7 Zapytania o ceny licencji danych** (Michał · S · wstrzymane). Później (26.09.2026: najpierw to, co działa bez integracji). LECTURA API – katalog maszyn budowlanych i rolniczych oraz wózków widłowych; HaynesPro albo TecAlliance – schematy elektryczne i dane serwisowe aut; PWPW – licencja dekodera kodu Aztec. Treść zapytań przygotuje Claude. Odpowiedzi są potrzebne do decyzji D14 przed v1.1.

### E4 · Rozliczenie zlecenia i faktury

Kosztorys, paragon (numer ręcznie) i faktury przez Fakturownię z wysyłką do KSeF.

- **E4.1 Dane firmy warsztatu** (Claude · S · zrobione). Nazwa, NIP, adres, konto bankowe, stawka roboczogodziny i stopka dokumentów w ustawieniach warsztatu.
- **E4.2 Cennik usług warsztatu** (Claude · M · zrobione · po: E4.1). Usługi z ceną stałą albo liczone z roboczogodzin (norma czasu), stawki VAT, szybkie dodawanie do kosztorysu.
- **E4.3 Kosztorys zlecenia** (Claude · L · zrobione · po: E4.2). Pozycje: usługi i części (ilość, cena netto, VAT, rabat), sumy netto i brutto. Zatwierdzone prace dodatkowe trafiają do kosztorysu automatycznie z wyceny. Wysłane wersje zapisane w prośbach o akceptację (treść + skrót), zmiany pozycji w dzienniku zdarzeń.
- **E4.4 Kosztorys wstępny do akceptacji przy przyjęciu** (Claude · M · zrobione · po: E4.3). Klient zatwierdza zakres i szacunkową cenę przez ten sam link co prace dodatkowe (art. 630 KC – warsztat musi uprzedzić o wzroście kosztów).
- **E4.5 Numer paragonu przy zamknięciu zlecenia** (Claude · S · zrobione · po: E4.3). Pole na numer i datę paragonu z kasy fiskalnej (D4, wariant a). Integracja z drukarką fiskalną w v1.1.
- **E4.6 Faktury przez Fakturownię (KSeF)** (Claude · L · wstrzymane · po: E4.3, D.1, D.6). Później – integracja zewnętrzna. Połączenie konta warsztatu (token API przechowywany w zaszyfrowanej postaci), faktura z kosztorysu dla firmy i osoby prywatnej, status wysyłki do KSeF, PDF w zleceniu, ponowienia w kolejce.
- **E4.7 Testy i dokumentacja rozliczeń** (Claude · S · zrobione · po: E4.4, E4.5). Testy bazy i scenariusze E2E: cennik, kosztorys, akceptacja kosztorysu, paragon. Test faktury razem z E4.6.

### K · Katalog pojazdów i maszyn

Szybkie wypełnianie formularza: marki, modele, generacje i roczniki aut, maszyn rolniczych i budowlanych, podnośników i wózków widłowych. Schematy do oznaczania uszkodzeń i dokumentacja techniczna warsztatu (D1).

- **K.1 Katalog marek i modeli z CEPiK** (Claude · L · wstrzymane). Później – integracja zewnętrzna. Import otwartych danych CEPiK (bezpłatne, także do użytku komercyjnego, z podaniem źródła): marki, modele i lata produkcji pojazdów zarejestrowanych w Polsce – auta osobowe, dostawcze i ciężarowe, motocykle, ciągniki rolnicze. Wspólny słownik dla wszystkich warsztatów, odświeżany okresowo.
- **K.2 Generacje aut** (Claude · M · wstrzymane · po: K.1). Później – wymaga danych z zewnątrz (K.1). Generacje z latami produkcji dla najpopularniejszych modeli (Wikidata na licencji CC0 i uzupełnienia ręczne); wybór rocznika zawęża listę generacji. Pełniejsze dane z licencji po decyzji D14.
- **K.3 Własny katalog marek i modeli** (Claude · M). Maszyny rolnicze, budowlane (koparki, ładowarki), podnośniki i wózki widłowe oraz podstawowa lista marek i modeli aut: własne zestawienie producentów i serii modeli, bez kopiowania cudzych katalogów (ochrona baz danych). Później rozszerzenie o dane z CEPiK (K.1) i z licencji (D14).
- **K.4 Formularz pojazdu z podpowiedziami** (Claude · M · po: K.3). Typ → marka → model → generacja i rocznik, z wyszukiwaniem po kilku literach. Wpis spoza listy jest dozwolony; brakujące modele trafiają do panelu OXY do zatwierdzenia i dopisania do katalogu.
- **K.5 Skan kodu Aztec z dowodu rejestracyjnego** (Claude · M · wstrzymane · po: K.4, D.3). Później – wymaga licencji dekodera. Aparat w telefonie odczytuje z kodu dane techniczne i numer rejestracyjny (kod nie zawiera danych właściciela) i wypełnia formularz. Sposób dekodowania do potwierdzenia z prawnikiem: licencja PWPW albo dostawca komercyjny.
- **K.6 Maszyny: motogodziny i dozór UDT** (Claude · M). Numer fabryczny, udźwig, przeglądy według motogodzin, terminy badań UDT dla wózków widłowych i podnośników. Lista zbliżających się terminów w warsztacie; przypomnienia dla klienta po zgodzie (E6.1).
- **K.7 Schematy do oznaczania uszkodzeń** (Claude · M). Własne rysunki: sylwetki nadwozi (osobowy, kombi, SUV, dostawczy, ciężarowy, motocykl) i maszyn (ciągnik, koparka, ładowarka, podnośnik, wózek widłowy). Używane w protokole przyjęcia (E5.1) i w inspekcji (E5.4).
- **K.8 Dokumentacja techniczna warsztatu** (Claude · M). Instrukcje serwisowe i schematy elektryczne wgrywane przez warsztat, przypięte do marki i modelu, widoczne tylko w tym warsztacie. Warsztat odpowiada za prawa do plików (zapis w regulaminie, D.4). Schematów producentów OXY nie kopiuje ani nie udostępnia innym – to utwory chronione, dostępne na licencji.

### E5 · Przyjęcie pojazdu, inspekcja, raport końcowy

Protokół z podpisem klienta, inspekcja ze zdjęciami, raport i status naprawy dla klienta.

- **E5.1 Protokół przyjęcia pojazdu** (Claude · L · po: K.7). Stan licznika i paliwa, uszkodzenia na schemacie pojazdu ze zdjęciami, rzeczy pozostawione w pojeździe, uwagi klienta, zakres i termin.
- **E5.2 Podpis klienta pod protokołem** (Claude · M · po: E5.1). Podpis na ekranie przy ladzie albo potwierdzenie przez link (SMS) z takim samym dowodem jak przy akceptacjach.
- **E5.3 Dokumenty PDF** (Claude · M · po: E5.1, E4.1). Protokół przyjęcia, zlecenie naprawy, raport końcowy i dowód zgody klienta jako PDF z danymi warsztatu.
- **E5.4 Inspekcja pojazdu z listą kontrolną** (Claude · L). Szablony dla typów pojazdów i maszyn, punkty zielone / żółte / czerwone ze zdjęciem; punkt żółty lub czerwony jednym kliknięciem staje się zgłoszeniem do wyceny.
- **E5.5 Zdjęcia widoczne dla klienta** (Claude · S). Przełącznik przy każdym zdjęciu w galerii zlecenia – decyduje, co trafi do raportu dla klienta.
- **E5.6 Status naprawy dla klienta** (Claude · M · zrobione). Strona bez logowania z linku w SMS-ie albo e-mailu: etap naprawy (przyjęty → w naprawie → gotowy do odbioru → odebrany), postęp prac, termin odbioru i kontakt do warsztatu, bez cen i danych klienta. Powiadomienie „pojazd gotowy do odbioru” przy zmianie statusu. Link można unieważnić, klient może włączyć powiadomienia w telefonie albo zrezygnować z wiadomości (dokument 07).
- **E5.7 Raport końcowy dla klienta** (Claude · M · po: E4.3, E5.5). Wykonane prace, zdjęcia, stan licznika, zalecenia na kolejną wizytę (pozycje „może poczekać”), kwota i faktura PDF – z linku, bez instalowania aplikacji.
- **E5.8 Notatki wewnętrzne** (Claude · S). Przy zleceniu, zadaniu i pojeździe: notatka wewnętrzna albo widoczna dla klienta. Wewnętrzne nie trafiają do raportu ani do historii pojazdu przekazywanej nowemu właścicielowi (D6).

### E6 · Powiadomienia i zgody

Rejestr zgód, SMS przy 3 zdarzeniach, powiadomienia w aplikacji dla zespołu.

- **E6.1 Rejestr zgód klienta** (Claude · M · po: D.3). Zgody osobno dla SMS i e-maila (art. 398 PKE): data, źródło, treść, wycofanie jednym kliknięciem z wiadomości. Wiadomości transakcyjne oddzielone od marketingu.
- **E6.2 Powiadomienia dla klienta według zdarzeń** (Claude · M · częściowo · po: E6.1, E5.6). Przyjęcie pojazdu, prośba o akceptację (jest), gotowy do odbioru, raport końcowy. SMS tylko przy 3 zdarzeniach (D5), reszta e-mailem. Zrobione (29.09.2026): przyjęcie i gotowość do odbioru – SMS albo push (push zamiast SMS-a, gdy klient włączył powiadomienia w telefonie) i e-mail, pole „Powiadom klienta” przy zleceniu, ustawienia warsztatu, dziennik wiadomości, rezygnacja klienta. Brakuje: raportu końcowego (E5.7) i rejestru zgód (E6.1).
- **E6.3 SMSAPI na produkcji** (Claude · M · wstrzymane · po: D.6). Później – integracja zewnętrzna. Test na prawdziwym koncie, nazwa nadawcy warsztatu, raporty doręczenia, licznik SMS-ów warsztatu (pod pakiety w abonamencie).
- **E6.4 Powiadomienia w aplikacji dla zespołu** (Claude · M · zrobione). Dzwonek z listą (komputer i telefon), strona „Powiadomienia” i ustawienia kanałów osobno dla każdego typu: nowa potrzeba od mechanika, odpowiedź klienta, przydzielone zadanie, część dostarczona, wszystkie zadania zakończone, wygaśnięcie linku.

### E7 · RODO i bezpieczeństwo

Prawa klienta, retencja danych, dokumenty prawne, zarządzanie zespołem, przegląd bezpieczeństwa.

- **E7.1 Zarządzanie zespołem** (Claude · S). Zmiana roli, usunięcie osoby z warsztatu (natychmiastowa utrata dostępu), przekazanie jej zadań.
- **E7.2 Eksport danych klienta** (Claude · S). Na żądanie klienta (art. 15 i 20 RODO): dane, pojazdy, zlecenia i zgody w jednym pliku.
- **E7.3 Usunięcie i anonimizacja klienta** (Claude · M · po: D.3). Art. 17 RODO z zachowaniem dokumentów, które warsztat musi przechowywać (faktury, dowody zgód).
- **E7.4 Automatyczne okresy przechowywania** (Claude · M · po: D.1, D.3). Zadanie cykliczne: wideo po 24 miesiącach (D7), dowody zgód i dziennik po okresie ustalonym z prawnikiem.
- **E7.5 Strony prawne w aplikacji** (Claude · S · po: D.4). Regulamin, polityka prywatności, akceptacja regulaminu i umowy powierzenia przy zakładaniu warsztatu.
- **E7.6 Przegląd bezpieczeństwa** (Claude · M). Polityka CSP, limity zapytań na stronach publicznych, logowanie dwuetapowe dla właściciela i biura, skan zależności, test uprawnień ról.

### E8 · Mechanik na telefonie

Aplikacja instalowana z przeglądarki, zdjęcia bez zasięgu, praca w kilku warsztatach.

- **E8.1 Aplikacja instalowana z przeglądarki (PWA)** (Claude · S · częściowo). Ikona na ekranie telefonu, start od razu w „Moich zadaniach”, pełny ekran. Zrobione (29.09.2026): manifest (tryb standalone, ikony, skróty „Moje zadania” i „Powiadomienia”), service worker, instalacja z przeglądarki. Brakuje: startu od razu w „Moich zadaniach” i sprawdzenia na prawdziwych telefonach.
- **E8.2 Zdjęcia bez zasięgu** (Claude · M · po: E8.1). Zdjęcia i filmy zrobione bez internetu czekają w telefonie i wysyłają się same, gdy wróci zasięg.
- **E8.3 Limity wideo** (Claude · M · po: D.1). Nagrania do 60 s w 720p (D7): nagrywanie w aplikacji z tymi ustawieniami, a dla filmów z galerii sprawdzenie długości przed wysyłką. Zdjęcia są już pomniejszane do ok. 1600 px.
- **E8.4 Mechanik w kilku warsztatach** (Claude · M). Wspólny widok dnia z zadaniami ze wszystkich warsztatów, w których pracuje, bez przełączania organizacji.
- **E8.5 Powiadomienia push** (Claude · M · zrobione · po: E8.1, E6.4). Push w zainstalowanej aplikacji: nowe zadanie dla mechanika, odpowiedź klienta dla biura. Działa w przeglądarce i w PWA (Web Push, klucze VAPID z `pnpm push:keys`), każda osoba wybiera kanały; na iPhonie tylko po dodaniu strony do ekranu początkowego (dokument 07).

### E9 · Wdrożenie i pilotaż

Produkcja w UE, testy w repozytorium, monitoring, import danych, pilotaż w 3–5 warsztatach.

- **E9.1 Testy E2E i CI w repozytorium** (Claude · M). Scenariusze etapów 1–3 jako testy Playwright w repo (dziś są w plikach roboczych Claude) i plik GitHub Actions do uruchamiania przy każdej zmianie.
- **E9.2 Środowisko produkcyjne w UE** (Claude · M · po: D.6). Netlify Pro w regionie UE, baza w UE, magazyn plików i poczta w UE, domena, zmienne środowiskowe, pierwsze wdrożenie.
- **E9.3 Monitoring i kopie zapasowe** (Claude · M · po: E9.2). Zgłaszanie błędów (dostawca w UE), kopie bazy z odtwarzaniem do punktu w czasie, sprawdzona procedura odtworzenia.
- **E9.4 Import klientów i pojazdów** (Claude · M). Wczytanie danych z pliku CSV / Excel z innych programów warsztatowych, z podglądem i wykrywaniem duplikatów.
- **E9.5 Panel administratora OXY** (Claude · M). Lista warsztatów, pomoc techniczna, blokada konta, podgląd kolejki zadań i błędów – bez dostępu do danych klientów warsztatów.
- **E9.6 Instrukcje dla warsztatu** (Claude · S). Krótkie instrukcje dla biura i mechanika ze zrzutami ekranów, plan wdrożenia w jeden dzień.
- **E9.7 Pilotaż w 3–5 warsztatach** (warsztaty · L · po: E9.2, E4.6, E5.7, E6.2, D.4). Kryteria sukcesu (D12), np. co najmniej połowa zleceń z cyfrową akceptacją i odsetek klientów otwierających link. Zbieranie uwag i poprawki.

## v1.1 — start komercyjny

### E10 · Start komercyjny

Konto klienta, abonamenty, magazyn, aplikacje w sklepach, offline, kasa fiskalna, raporty.

- **E10.1 Konto klienta (hub)** (Claude · L · po: E6.1). Zaproszenie SMS za zgodą, historia pojazdów ze wszystkich warsztatów, przypomnienia serwisowe, przekazanie historii przy sprzedaży pojazdu: zakres prac i daty, bez cen i danych poprzedniego właściciela (D6).
- **E10.2 Abonamenty i płatności za OXY** (Claude · L · po: D.1). Plany: mechanik solo bezpłatnie, warsztat z mechanikami w cenie i dopłatą za kolejnych; płatności kartą i BLIK, faktury za abonament, okres próbny. Pakiet SMS w abonamencie z możliwością dokupienia kolejnych (D5).
- **E10.3 Magazyn części** (Claude · L · po: E4.3). Stany, przyjęcia dostaw, rezerwacje części do zleceń, marże, inwentaryzacja, zamówienia do dostawców.
- **E10.4 Aplikacje w Google Play i App Store** (Claude · L · po: E8.1). Aplikacja mechanika i klienta (Capacitor, jedna baza kodu), logowanie w aplikacji, aparat, powiadomienia push.
- **E10.5 Pełny tryb offline mechanika** (Claude · L · po: E8.2). Zadania, statusy i czas pracy działają bez internetu i synchronizują się po powrocie zasięgu.
- **E10.6 Integracja z drukarką fiskalną** (Claude · L · po: E4.5). Program-mostek na komputerze w warsztacie (Windows), 1–2 producentów drukarek, paragon ze zlecenia jednym kliknięciem.
- **E10.7 Raporty i wskaźniki** (Claude · M · po: E4.3). Przychód, czas pracy wobec normy, skuteczność akceptacji prac dodatkowych, obłożenie mechaników.
- **E10.8 Notatki głosowe mechanika** (Claude · M). Nagranie zamienione na tekst w zgłoszeniu potrzeby albo notatce do zadania (D10).
- **E10.9 Dane techniczne z licencji** (Claude · L · po: D.7). Integracja z dostawcą wybranym w D14 (np. HaynesPro albo TecAlliance): schematy elektryczne i dane serwisowe aut, dostawczych i ciężarowych; katalog maszyn z LECTURA. Dla maszyn rolniczych, budowlanych i wózków – dokumentacja producentów wgrywana przez warsztat (K.8).

## v2 — rozwój

### E11 · Rozwój

Hurtownie części, płatności online, floty i klienci firmowi, rezerwacje terminów.

- **E11.1 Hurtownie części** (Claude · L · po: E10.3). Katalogi i zamówienia w hurtowniach (np. Inter Cars, Auto Partner) prosto ze zgłoszenia potrzeby.
- **E11.2 Płatności online klienta** (Claude · L · po: E5.7). Zapłata za naprawę z linku (BLIK, karta) – operator do wyboru (D11).
- **E11.3 Rezerwacje terminów online** (Claude · M). Kalendarz stanowisk i mechaników, rezerwacja przez klienta z przypomnieniem.
- **E11.4 Floty i klienci firmowi** (Claude · L). Wiele pojazdów jednego klienta, akceptacje przez osobę kontaktową firmy, zestawienia miesięczne.
