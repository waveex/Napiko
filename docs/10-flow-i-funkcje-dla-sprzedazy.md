# Napiko – flow i funkcje aplikacji pod prezentacje sprzedażowe

**Wersja:** 0.1 · **Data:** 08.10.2026
**Powiązane:** [01-raport-analityczny.md](01-raport-analityczny.md) (rynek, konkurencja), [02-decyzje-produktowe.md](02-decyzje-produktowe.md), [04-moduly-warsztatu.md](04-moduly-warsztatu.md), [05-plan-prac.md](05-plan-prac.md), [07-powiadomienia.md](07-powiadomienia.md), [09-demo-powiadomien-checklista.md](09-demo-powiadomien-checklista.md) (przygotowanie SMS / e-mail / push do pokazu)

**Do czego służy ten dokument:** jest materiałem dla osoby, która rozmawia z warsztatami i buduje prezentację lub ofertę. Zbiera w jednym miejscu wszystkie przepływy pracy i funkcje aplikacji, razem z argumentem sprzedażowym przy każdym z nich i z jasnym oznaczeniem, czego jeszcze nie ma.

**Podstawa:** kod w repozytorium (stan 08.10.2026, gałąź `codex/design-blue-violet`) przeczytany ekran po ekranie oraz dokumenty 01–09. Gdy dokumentacja i kod się różnią, wygrywa kod; różnice opisano w sekcji 11.

**Legenda statusów**

| Znacznik | Znaczenie | Jak o tym mówić |
| --- | --- | --- |
| ✅ | działa w aplikacji dziś | pokazać na żywo |
| 🟡 | działa z zastrzeżeniem (konfiguracja zewnętrzna, część zakresu) | pokazać, ale powiedzieć, co jeszcze dochodzi |
| 🔜 | w planie, nie ma w aplikacji | tylko jako kierunek rozwoju, bez dat |

---

## 1. Napiko w minutę

**Jedno zdanie.** Napiko łączy biuro, mechaników i klienta warsztatu w jednym przepływie, od przyjęcia pojazdu po odbiór, a każda zgoda klienta na dodatkową płatność zostaje zapisana jako dowód.

**Trzy obietnice, każda ma pokrycie w działającej aplikacji**

1. **Koniec telefonów w sprawie prac dodatkowych.** Mechanik zgłasza usterkę ze zdjęciem, biuro wycenia, klient dostaje link, widzi zdjęcie i cenę brutto, decyduje na telefonie przy każdej pozycji. Decyzja zostaje zapisana razem z treścią, czasem i adresem IP.
2. **Koniec pytań „czy już gotowe?”.** Klient ma stronę statusu naprawy otwieraną z linku, bez logowania i bez instalacji. Dostaje wiadomość przy przyjęciu pojazdu i przy gotowości do odbioru. Jeśli włączy powiadomienia w telefonie, dostaje push zamiast płatnego SMS-a.
3. **Cały zespół widzi to samo.** Mechanik pracuje na telefonie (licznik czasu, zdjęcia, zgłoszenia), biuro dostaje gotową wycenę do decyzji, właściciel widzi na pulpicie, co wymaga reakcji i jak idzie miesiąc.

**Dlaczego to ma sens biznesowo** (źródło: raport rynkowy, dok. 01 i 02; liczby sprawdź przed użyciem w materiałach zewnętrznych)

- Polskie programy warsztatowe są głównie desktopowe i dobrze obsługują zlecenia, magazyn i faktury. Według naszego researchu z 09.2026 żaden z przebadanych polskich programów nie robi dobrze zdalnej akceptacji prac dodatkowych ani komunikacji z klientem.
- Typowy warsztat niezależny to ok. 6 osób: 4 mechaników, 1 osoba w biurze, 1 magazynier. W 2023 r. w Polsce było 22 119 warsztatów samochodowych (Instytut GiPA, za ISBtech, 02.2024).
- Zapis zgody ma też wymiar prawny. Art. 630 § 2 KC (sprawdzone w tekście przepisu 8.10.2026): „Przyjmujący zamówienie nie może żądać podwyższenia wynagrodzenia, jeżeli wykonał prace dodatkowe bez uzyskania zgody zamawiającego.” Chodzi więc o **zgodę**, a nie tylko o zawiadomienie (dokumenty 01 i 02 opisywały to jako obowiązek „uprzedzenia”, co jest uproszczeniem). **Czy akceptacja przez link spełnia wymogi formy w konkretnej umowie, ocenia prawnik (zadanie D.3). Nie obiecuj klientowi skuteczności prawnej, mów o tym, co zapisujemy.**
- Metryka sukcesu pilotażu jest już na pulpicie właściciela: odsetek zatwierdzonych prac dodatkowych i udział zleceń z akceptacją przez link.

**Hipoteza cenowa** (decyzja D8, do walidacji w rozmowach z warsztatami, nie podawać jako oferty)

| Plan | Hipoteza |
| --- | --- |
| Klient końcowy | zawsze bezpłatnie |
| Mechanik solo | 0 zł z limitem ok. 20 zleceń miesięcznie albo 49 zł |
| Warsztat (3 mechaników w cenie) | 149–199 zł netto miesięcznie, kolejny mechanik 39–49 zł |
| Pro (wiele lokalizacji, integracje) | 299–499 zł netto miesięcznie |
| Pakiet SMS | np. 500 SMS za 69 zł |

Punkt odniesienia: Tekmetric od 179 USD, Shopmonkey od 215–239 USD miesięcznie (cenniki dostawców wg dok. 01, 07.2026). Argument zwrotu: abonament spłaca się, jeśli dzięki akceptacjom warsztat sprzeda miesięcznie jedną dodatkową naprawę.

---

## 2. Kto jest kim

| Rola | Kim jest | Co robi w Napiko | Co zyskuje |
| --- | --- | --- | --- |
| **Właściciel** | Prowadzi warsztat | Wszystko co biuro, plus wyniki miesiąca, zarządzanie zespołem i ustawieniami | Widzi, czy akceptacje działają i ile warsztat zarabia na zleceniach |
| **Biuro** | Przyjmuje auta, rozmawia z klientem | Przyjęcie, przydział zadań, wyceny, wysyłka próśb o zgodę, kosztorys, zamknięcie z paragonem | Jedno miejsce zamiast telefonów, kartek i komunikatora |
| **Mechanik** | Pracuje przy pojeździe | „Moje zadania”, licznik czasu, zdjęcia, zgłaszanie potrzeb | Duże przyciski na telefonie, zgłoszenie zamiast dzwonienia do biura |
| **Mechanik solo** | Samodzielny albo pracuje dla kilku warsztatów | Własna mikroorganizacja, a także członkostwo w innych warsztatach (przełącznik) | Jedno konto, wiele miejsc pracy |
| **Klient warsztatu** | Osoba prywatna albo firma | Otwiera linki: akceptacja prac i status naprawy. Bez konta, bez aplikacji | Wie, co się dzieje i za ile, decyduje sam |

---

## 3. Jedna naprawa od początku do końca

Ten układ nadaje się na jeden slajd. Kolumny to tory, w których pracuje każda ze stron.

| # | Krok | Biuro | Mechanik | Klient | System |
| --- | --- | --- | --- | --- | --- |
| 1 | **Przyjęcie** | Wybiera klienta i pojazd, opisuje zakres, rozpisuje zadania, zaznacza „Powiadom klienta” | – | Dostaje SMS lub push oraz e-mail z linkiem do statusu | Nadaje numer ZL/rok/nr, kolejkuje wiadomości |
| 2 | **Przydział** | Przydziela zadania (albo mechanicy biorą sami) | Dostaje powiadomienie | – | Powiadomienie: dzwonek, push |
| 3 | **Realizacja** | – | Start licznika, zdjęcia przy zadaniu | Widzi etap „W naprawie” i postęp „2 z 3” | Pierwszy start przenosi zlecenie do „W realizacji” |
| 4 | **Znaleziono usterkę** | – | „Zgłoś potrzebę”: opis, pilność, zdjęcia, opcjonalnie wstrzymanie zadania | – | Biuro dostaje push |
| 5 | **Wycena** | Części i robocizna netto, VAT, brutto | – | – | Zgłoszenie dostaje status „Wycenione” |
| 6 | **Zgoda** | Wysyła link (SMS, e-mail, osobiście) albo zapisuje zgodę telefoniczną | – | Otwiera link, widzi zdjęcia i cenę brutto, decyduje przy każdej pozycji, zaznacza zgodę na kwotę | Zlecenie „Czeka na akceptację”; zapis treści, skrótu SHA-256, czasu, IP |
| 7 | **Skutek decyzji** | Widzi odpowiedź (dzwonek, push, e-mail, pulpit) | Nowe zadanie albo „wykonaj tylko pierwotny zakres” | – | Pozycje trafiają do kosztorysu, zlecenie wraca do „W realizacji” |
| 8 | **Kosztorys** | Uzupełnia z cennika, wysyła do akceptacji | – | Akceptuje całość i zgadza się na kwotę | Zapisuje wersję i skrót pozycji |
| 9 | **Koniec prac** | Dostaje „wszystkie zadania zakończone” | Kończy ostatnie zadanie | – | – |
| 10 | **Odbiór** | „Gotowe do odbioru” z powiadomieniem | – | Wiadomość, strona: „Pojazd czeka na odbiór” z adresem | – |
| 11 | **Zamknięcie** | Wpisuje numer i datę paragonu z kasy | – | Etap „Odebrany” | Zlecenie tylko do odczytu |
| 12 | **Po fakcie** | Dziennik zdarzeń, wyniki miesiąca | – | Link działa jeszcze 30 dni | – |

---

## 4. Flow po flow

Dla każdego przepływu: kto go uruchamia, co się dzieje, argument sprzedażowy i granice (czego jeszcze nie ma).

### F1. Start: konto, warsztat, zespół ✅

**Kto:** właściciel lub biuro.

1. Rejestracja: imię i nazwisko, e-mail, hasło (min. 10 znaków). Weryfikacja adresu jest przełączana konfiguracją.
2. Po zalogowaniu wybór drogi: **zakładam warsztat**, **pracuję jako mechanik solo**, **czekam na zaproszenie** albo **jestem klientem** (ta ostatnia pokazuje na razie informację, że historia pojazdów dojdzie z modułem klienta).
3. Założenie organizacji: nazwa, identyfikator, rodzaj (warsztat lub mechanik solo). Twórca zostaje właścicielem.
4. **Lista „Przygotuj warsztat do pracy”** na pulpicie: dane firmy, stawka roboczogodziny, cennik, zespół, pierwsze zlecenie. Znika po uzupełnieniu albo po ukryciu.
5. **Zespół:** zaproszenie e-mailem z rolą Biuro lub Mechanik (link ważny 7 dni, można anulować). Zaproszony akceptuje lub odrzuca.
6. **Ustawienia:** zasada przydzielania zadań (biuro / mechanicy sami / mieszana), nazwa nadawcy SMS, strefa czasowa, język dokumentów, logo, dane firmy, powiadomienia dla klienta.

**Argument:** gotowy do pracy w jeden dzień, bez instalacji i bez serwera w warsztacie. Lista kroków prowadzi za rękę.
**Granice:** zmiana roli i usunięcie osoby z zespołu 🔜 (E7.1), logowanie dwuetapowe 🔜 (E7.6), import klientów z CSV / Excela 🔜 (E9.4).

### F2. Klienci i pojazdy ✅

**Kto:** biuro (mechanik widzi tylko nazwisko, numer rejestracyjny i VIN).

- **Klienci:** osoba prywatna lub firma (NIP), telefon zapisywany jako +48…, notatki wewnętrzne. Wyszukiwarka po nazwisku, telefonie, e-mailu, NIP, numerze rejestracyjnym i VIN.
- **Pojazdy – 19 rodzajów:** samochód osobowy, dostawczy i ciężarowy, autobus, przyczepa, kamper, motocykl, motorower, quad, rower, rower elektryczny, hulajnoga elektryczna, ciągnik, maszyna rolnicza, wózek widłowy, maszyna budowlana, łódź, sprzęt ogrodniczy, inny.
- Formularz dopasowuje pola do rodzaju: **VIN** (17 znaków z kontrolą), **numer ramy** (rowery) albo **numer fabryczny** (maszyny); licznik w **km**, **motogodzinach** albo bez licznika.
- **Karta klienta:** pojazdy, historia zleceń, ustawienia wiadomości o naprawie, telefony z włączonym push.
- **Karta pojazdu:** historia zleceń.

**Argument:** jedno narzędzie dla warsztatu samochodowego, serwisu rowerowego, motocyklowego i maszyn rolniczych. To wyróżnik wobec programów nastawionych tylko na auta.
**Granice:** podpowiedzi marek i modeli oraz generacji 🔜 (K.1–K.4, dziś marka i model wpisywane ręcznie), skan kodu Aztec z dowodu rejestracyjnego 🔜 (K.5), dozór UDT i przeglądy według motogodzin 🔜 (K.6).

### F3. Przyjęcie pojazdu ✅

**Kto:** biuro, w kilka minut, na komputerze lub telefonie.

1. **Klient:** wyszukanie albo dodanie nowego od ręki.
2. **Pojazd:** wybór spośród pojazdów klienta albo dodanie nowego (przy jednym pojeździe wybiera się sam).
3. **Zakres prac:** opis zgłoszony przez klienta, stan licznika, planowany odbiór, lista zadań (każde pole to osobne zadanie).
4. **Powiadomienie klienta:** pole zaznaczone od razu, gdy ustawienia warsztatu tak zakładają i klient ma numer lub adres. Pod polem widać, którymi kanałami pójdzie wiadomość (np. „SMS, e-mail”).
5. Zlecenie dostaje numer **ZL/2026/0007** (osobna numeracja dla każdego warsztatu). Zdjęcia dodaje się na karcie zlecenia.

**Co dostaje klient:** wiadomość z linkiem do strony statusu naprawy (F9).
**Argument:** przyjęcie bez kartki i bez przepisywania. Klient od pierwszej minuty ma kontakt z warsztatem w telefonie.
**Granice:** pełny **protokół przyjęcia z podpisem klienta** (schemat uszkodzeń, rzeczy w pojeździe, stan paliwa) 🔜 (E5.1, E5.2, K.7). Dziś przyjęcie to zlecenie ze stanem licznika, opisem i zdjęciami.

### F4. Zlecenie, zadania i przydział ✅

**Kto:** biuro i mechanicy.

- **Tablica zleceń** w 5 kolumnach: Przyjęte, W realizacji, Czeka na akceptację, Czeka na części, Gotowe do odbioru. **Przeciąganie kart** zmienia status (przeniesienie do „Gotowe” otwiera okno z pytaniem o powiadomienie klienta). Archiwum zamkniętych, wyszukiwarka (numer, rejestracja, marka, klient), filtr „tylko moje”. Na telefonie widok z listą i filtrem statusu.
- **Karta zlecenia:** pojazd, klient, zakres, terminy, zadania z postępem „2 z 3”, potrzeby i prace dodatkowe, kosztorys, zdjęcia, rozliczenie, wiadomości do klienta.
- **Zadania i podzadania** (2 poziomy), do każdego **jeden lub kilku wykonawców**.
- **Trzy zasady przydziału** do wyboru dla warsztatu: biuro przydziela / mechanicy sami biorą / tryb mieszany.
- **Statusy zlecenia (7):** przyjęte, w realizacji, czeka na akceptację, czeka na części, gotowe do odbioru, zamknięte, anulowane. **Statusy zadania (7):** do zrobienia, w trakcie, wstrzymane, czeka na części, czeka na akceptację, zrobione, anulowane.
- **Automaty:** pierwsze uruchomione zadanie przenosi zlecenie z „Przyjęte” do „W realizacji”. Gdy ostatnie zadanie jest zrobione, do listy zadań dochodzi zadanie **„Wydanie auta”** (nie liczy się do postępu prac, wycofuje się samo, gdy praca wraca), a biuro dostaje powiadomienie „można oznaczyć jako gotowe do odbioru”.
- **Zamknięte zlecenie jest tylko do odczytu.**

**Argument:** biuro widzi całą pracę warsztatu na jednej tablicy, a mechanik tylko swoje zadania.

### F5. Praca mechanika na telefonie ✅

**Kto:** mechanik.

- Ekran **„Moje zadania”** z grupami: *Teraz pracujesz*, *Do zrobienia*, *Czeka na część lub decyzję*, *Zrobione dziś*, *Do wzięcia* (gdy zasada pozwala brać zadania samemu).
- **Licznik czasu: Start, Pauza, Zakończ.** Jeden licznik naraz: start innego zadania wstrzymuje poprzedni. Czas liczy zegar bazy danych. Po 10 godzinach pracy licznika aplikacja przypomina, żeby go zatrzymać.
- **Zdjęcia i filmy** prosto przy zadaniu.
- **Zgłoszenie potrzeby** przy zadaniu (F6).
- **Pulpit mechanika:** bieżące zadanie z licznikiem, następne ze Startem, czas pracy dziś, zadania zrobione dziś, kolejka, co dzieje się z zgłoszonymi potrzebami.
- **Aplikacja instalowana z przeglądarki (PWA):** ikona na ekranie telefonu, skróty „Moje zadania” i „Powiadomienia”, push.
- Dolne menu na telefonie, duże przyciski.

**Zdjęcia – szczegóły techniczne, dobre na pytania:** przed wysyłką pomniejszane do ok. 1600 px i zapisywane od nowa jako JPEG, co usuwa dane EXIF z lokalizacją GPS. Pliki idą bezpośrednio do magazynu S3, nie przez serwer aplikacji. Dozwolone: JPG, PNG, WebP, HEIC, MP4, MOV, WebM, PDF, do 200 MB. Usuwać może autor w ciągu doby albo biuro.

**Argument:** mechanik nie pisze elaboratów. Robi zdjęcie, wybiera pilność, wysyła. Biuro dostaje komplet informacji do wyceny.
**Granice:** zdjęcia i zadania bez zasięgu (kolejka offline) 🔜 (E8.2, E10.5), limit wideo 60 s / 720p 🔜 (E8.3), wspólny widok dnia dla mechanika w kilku warsztatach 🔜 (E8.4; dziś jest przełącznik warsztatu, a dzwonek pokazuje nieprzeczytane w innych warsztatach), notatki głosowe 🔜 (E10.8), natywne aplikacje ze sklepów 🔜 (E10.4).

### F6. Praca dodatkowa: od znaleziska do zgody klienta ✅ (flow główny, pokazać zawsze)

**Kto:** mechanik, biuro, klient, ponownie mechanik.

1. **Mechanik: „Zgłoś potrzebę”.** Rodzaj: *część do zamówienia* albo *praca dodatkowa*. Pilność w trzech stopniach jak w cyfrowej inspekcji: **pilne** (bezpieczeństwo albo blokuje pracę), **zalecane** (warto przy tej wizycie), **może poczekać**. Opis, zdjęcia lub film. Opcja **„Nie mogę kontynuować zadania bez tego”** wstrzymuje zadanie do dostawy części albo decyzji klienta.
2. **Biuro dostaje powiadomienie** (dzwonek, push) i widzi zgłoszenie na ekranie **„Potrzeby”** (osobna lista „do obsłużenia” i „zakończone”).
3. **Wycena:** części netto + robocizna netto, stawka VAT, wynik brutto. Notatka biura (np. dostawca i termin), widoczna tylko dla biura. **Pracy dodatkowej bez wyceny nie da się zatwierdzić ani wysłać klientowi.**
4. **Decyzja – dwie drogi:**
   - **Link do klienta** (F7) przez SMS, e-mail albo przekazany osobiście,
   - **zgoda telefoniczna:** biuro zatwierdza lub odrzuca i wpisuje, jak klient przekazał decyzję (np. „zgoda telefoniczna, 26.09 o 14:20”). Wpis trafia do dziennika.
5. **Skutki zatwierdzenia:**
   - praca dodatkowa staje się **nowym zadaniem** przypisanym temu, kto ją zgłosił,
   - wstrzymane zadanie wraca do mechanika,
   - wycena trafia do **kosztorysu** (robocizna i części osobno),
   - zlecenie wraca do „W realizacji”,
   - mechanik dostaje powiadomienie z decyzją.
6. **Skutki odrzucenia:** mechanik dostaje komunikat „Wykonaj tylko pierwotny zakres”.
7. **Części:** po zatwierdzeniu biuro oznacza *zamówione*, potem *zrealizowane*. Mechanik dostaje powiadomienie „Część dostarczona, możesz wrócić do pracy”.

**Argument:** usterka znaleziona w środku naprawy nie zatrzymuje pracy na pół dnia w oczekiwaniu na telefon. Mechanik i biuro mają jeden wspólny, widoczny stan sprawy.
**Granice:** automatyczna lista kontrolna inspekcji (zielone / żółte / czerwone punkty zamieniane jednym kliknięciem w zgłoszenie) 🔜 (E5.4). Dziś mechanik zgłasza ręcznie, ale pilność ma te same trzy stopnie.

### F7. Akceptacja klienta przez link ✅ (flow główny, pokazać zawsze)

**Kto:** biuro wysyła, klient odpowiada.

**Wysyłka (biuro):**

- wybór pozycji do akceptacji (tylko wycenione),
- kanał: **SMS**, **e-mail** albo **„sam przekażę link”** (klient przy ladzie, komunikator),
- wiadomość do klienta nad listą prac,
- ważność linku **1–14 dni** (domyślnie 3),
- **podgląd** w tej samej postaci, jaką zobaczy klient (otwarcie z konta warsztatu nie liczy się jako otwarcie klienta i nie pozwala odpowiedzieć za niego).

**Co widzi klient** (telefon, bez logowania, bez instalacji):

- nagłówek z **logo i nazwą warsztatu**, pojazd i numer rejestracyjny, wiadomość od warsztatu,
- dla każdej pozycji: pilność, opis, **zdjęcia lub film**, **cena brutto** z podziałem na części i robociznę oraz VAT,
- przy każdej pozycji dwa duże przyciski: **„Akceptuję”** / **„Nie teraz”**,
- podsumowanie („Zatwierdzone pozycje: 2, razem 540 zł brutto”) i **pole zgody** na łączną kwotę,
- uwagi dla warsztatu, przycisk **„Wyślij decyzję”**,
- po wysłaniu: potwierdzenie i podsumowanie decyzji.

**Co widzi biuro:** czy i kiedy klient **otworzył link**, jego odpowiedź i uwagi; może **wycofać** prośbę i wysłać nową. Gdy link wygaśnie bez odpowiedzi, dostaje powiadomienie i widzi sprawę w „Wymaga uwagi”.

**Dowód zgody – co dokładnie zapisujemy**

| Zapis | Po co |
| --- | --- |
| Treść pokazana klientowi: pozycje, opisy, ceny brutto, zdjęcia, plus **skrót SHA-256** | Wykazać, na co klient się zgodził, nawet gdy wycena zmieni się później |
| Decyzja przy każdej pozycji, zgoda na łączną kwotę, uwagi | Wyraźna zgoda na dodatkową płatność |
| Data, godzina, adres IP, przeglądarka | Okoliczności złożenia oświadczenia |
| Wpis w dzienniku zdarzeń, którego nie da się zmienić | Ochrona przed późniejszą zmianą danych |

**Zabezpieczenia linku:** token 192 bity losowości, w bazie tylko jego skrót; strona wyłączona z indeksowania, bez nagłówka Referer i bez pamięci podręcznej; dane ładują się dopiero w przeglądarce, więc **podgląd linku w komunikatorze nie oznacza prośby jako otwartej**; limit zapytań do stron publicznych.

**Argument:** klient decyduje świadomie, widząc zdjęcie i cenę. Warsztat ma dowód. Skraca to pętlę z godzin do minut, bo klient odpowiada tam, gdzie jest.
**Granice:** opcja „przypomnij później” z datą lub przebiegiem 🔜 (jest w koncepcji z dok. 01, bez zadania w planie; dziś „Nie teraz” oznacza odrzucenie pozycji), eksport dowodu zgody do PDF 🔜 (dok. 04, sekcja 7), ocena prawna formy dokumentowej (art. 77² KC) i zgody na dodatkową płatność **czeka na prawnika** (D.3).

### F8. Cennik, kosztorys i dane firmy ✅

**Kto:** biuro i właściciel (uprawnienie `billing`; mechanik tych danych nie widzi).

- **Dane firmy:** pełna nazwa, **NIP z kontrolą sumy** (firmy z UE: numer VAT), adres, kontakt, **numer rachunku z kontrolą sumy (IBAN)**, stawka roboczogodziny netto, domyślny VAT, **stopka kosztorysu** (np. gwarancja na części).
- **Cennik usług:** cena stała albo **norma czasu × stawka roboczogodziny**, kategorie, wyszukiwarka, VAT. Zmiana ceny nie zmienia kosztorysów już utworzonych.
- **Kosztorys zlecenia:** pozycje *robocizna / część / inne*, z cennika albo ręcznie: ilość, jednostka, cena netto, rabat, VAT. Sumy netto, VAT i brutto oraz **zestawienie według stawek VAT**. Zatwierdzone wyceny prac dodatkowych **trafiają do kosztorysu same**.
- **Rachunek w groszach na liczbach całkowitych:** sumy zgadzają się co do grosza z tym, co widzi klient. Tę samą funkcję liczy aplikacja i serwer.
- **Wysyłka kosztorysu do akceptacji** tym samym linkiem co prace dodatkowe. Klient widzi dane wystawcy, pozycje, sumy i stopkę i podejmuje **jedną decyzję o całości** (akceptuję / nie akceptuję), z zaznaczeniem zgody na kwotę brutto.
- **Kontrola wersji:** jeśli biuro zmieni kosztorys po wysyłce lub po akceptacji, karta zlecenia ostrzega, że klient widział albo zaakceptował inną wersję.
- Jeden kosztorys czeka na klienta naraz.

**Argument:** kosztorys z kwotą zaakceptowaną przez klienta, zanim ruszy praca. Brak sporów „a miało być taniej”.
**Granice:** **faktury i KSeF** przez Fakturownię 🔜 (E4.6, wstrzymane do czasu integracji), PDF kosztorysu i dokumentów 🔜 (E5.3), magazyn i marże 🔜 (E10.3). Napiko nie zastępuje kasy fiskalnej.

### F9. Status naprawy dla klienta ✅

**Kto:** wiadomość uruchamia biuro (lub automat), czyta klient.

- Link `…/s/<token>` z SMS-a lub e-maila. **Bez logowania i bez instalacji.**
- **Etapy:** Przyjęty → W naprawie → Gotowy do odbioru → Odebrany, z datami; postęp prac („2 z 3”); planowany termin odbioru; komunikat **„Pojazd czeka na odbiór”** z adresem warsztatu; komunikat **„Warsztat czeka na Twoją decyzję”**, gdy jest prośba o zgodę.
- **Kontakt do warsztatu:** adres, przycisk „Zadzwoń”, „Napisz e-mail”.
- **Ustawienia klienta na tej stronie:** **powiadomienia push w tym telefonie** (zamiast SMS-a) oraz przełączniki SMS i e-mail. Rezygnacja jednym kliknięciem także z e-maila.
- **Czego nie widać:** cen, notatek, nazwisk zespołu. Telefon i e-mail klienta są zamaskowane. Strona odświeża się co minutę. Można ją dodać do ekranu początkowego.
- **Biuro w karcie zlecenia:** dziennik wiadomości (co, którym kanałem, z jakim skutkiem), ręczna wysyłka lub ponowienie, link z kopiowaniem, **liczba wyświetleń**, „Nowy link” unieważniający poprzedni (gdy poszedł na zły numer). Link działa jeszcze 30 dni po zamknięciu zlecenia.

**Cztery wiadomości do klienta:** przyjęcie pojazdu i gotowość do odbioru (wysyłane automatycznie, raz na zlecenie), prośba o zgodę na prace i kosztorys do akceptacji (wysyła biuro świadomie).

**Argument kosztowy:** SMS to koszt (ok. 70–135 zł netto miesięcznie przy 300 zleceniach i 3 SMS-ach na zlecenie, dok. 02). Gdy klient włączy powiadomienia w telefonie, dostaje **push zamiast SMS-a, bez kosztu**. Jeśli push przestanie działać, system sam wysyła SMS. SMS pisany jest bez polskich znaków (alfabet GSM-7), więc mieści się w 160 znakach.
**Granice:** bramka SMSAPI jest zaprogramowana i zgodna z dokumentacją, ale **nie była testowana na prawdziwym koncie** (E6.3), a domyślny tryb to zapis do logu 🟡. Push wymaga kluczy VAPID i HTTPS 🟡. Na iPhonie push działa tylko po dodaniu strony do ekranu początkowego. Raport końcowy dla klienta 🔜 (E5.7), rejestr zgód marketingowych 🔜 (E6.1), raporty doręczenia SMS 🔜. Przygotowanie do pokazu na prawdziwych telefonach: [09-demo-powiadomien-checklista.md](09-demo-powiadomien-checklista.md).

### F10. Gotowe do odbioru i zamknięcie zlecenia ✅

**Kto:** biuro.

1. Gdy ostatnie zadanie jest zrobione, na liście zadań pojawia się **„Wydanie auta”** i biuro dostaje powiadomienie. Zmiana statusu na **„Gotowe do odbioru”** otwiera okno **„Zmień status i powiadom”** z zaznaczonym polem; można je odznaczyć i zmienić sam status.
2. Przy odbiorze **zamknięcie zlecenia** (kończy też zadanie „Wydanie auta”) z **numerem i datą paragonu z kasy fiskalnej**. Okno pokazuje kwotę kosztorysu.
3. Paragon można uzupełnić lub poprawić także w zamkniętym zleceniu. Karta „Rozliczenie” pokazuje kwotę kosztorysu i paragon.
4. Zamknięte zlecenie można ponownie otworzyć przez zmianę statusu.

**Granice:** fiskalizacja zostaje po stronie warsztatu (kasa online). Napiko zapisuje tylko numer i datę paragonu. Integracja z drukarką fiskalną 🔜 (E10.6).

### F11. Powiadomienia dla zespołu ✅

- **Dzwonek** w panelu (komputer i telefon): lista, licznik, przejście prosto do zlecenia, strona „Powiadomienia” z filtrem nieprzeczytanych. Odświeża się co 30 s i od razu po pushu. Przy powiadomieniu z innego warsztatu aplikacja sama przełącza warsztat.
- **10 typów:** nowe zadanie, zadanie zdjęte z listy, zadania do wzięcia, nowa potrzeba od mechanika, decyzja w zgłoszeniu, część zamówiona, część dostarczona, odpowiedź klienta, brak odpowiedzi klienta (link wygasł), wszystkie zadania zakończone.
- **Każda osoba wybiera kanały osobno dla każdego typu:** dzwonek (zawsze), e-mail, push. Domyślne ustawienia są rozsądne (np. odpowiedź klienta: push i e-mail).
- **Push w przeglądarce i w aplikacji zainstalowanej na telefonie.** Na wspólnym telefonie push wyłącza się przy wylogowaniu.
- Reguły: nikt nie dostaje powiadomienia o własnym działaniu; powiadomienie powstaje w tej samej transakcji co zmiana danych, więc **nie zginie po błędzie**; treść zawiera tylko teksty i liczby, bez danych kontaktowych klienta.

**Argument:** biuro nie musi odświeżać ekranu ani dzwonić do mechanika. Wie, że klient odpowiedział, w chwili odpowiedzi.
**Granice:** aktualizacje na żywo (WebSocket) 🔜, godziny ciszy i grupowanie powiadomień 🔜.

### F12. Pulpit dopasowany do roli ✅

Liczniki liczy serwer na pełnych danych, w strefie czasowej warsztatu. Sekcji, do której rola nie ma uprawnień, serwer nie liczy ani nie wysyła. Odświeża się co minutę i po powrocie do karty.

| Rola | Co widzi |
| --- | --- |
| **Mechanik** | Bieżące zadanie z licznikiem, Pauza / Zakończ, zgłoszenie potrzeby i zdjęcie. Gdy licznik stoi, następne zadanie ze Startem. Czas pracy dziś, zrobione dziś, kolejka, zadania czekające na część lub decyzję, status zgłoszonych przez niego potrzeb, zadania do wzięcia |
| **Biuro** | **„Wymaga uwagi”**, od najpilniejszych: zlecenia po terminie odbioru, potrzeby do wyceny (z liczbą pilnych), odpowiedzi klientów z ostatnich 48 godzin, wygasłe linki, wyceny bez decyzji, części do zamówienia i zamówione, pojazdy gotowe do odbioru, zlecenia bez zadań lub z zadaniami bez wykonawcy, prośby czekające na klienta (z informacją, które jeszcze nieotwarte). **„Warsztat dziś”:** planowane odbiory, przyjęte i zamknięte dziś, zlecenia według statusu, **zespół teraz** (kto przy czym pracuje, czas pracy dziś, kolejka). Pasek „Twoja praca” z licznikiem, gdy biuro ma własne zadania |
| **Właściciel** | To samo co biuro oraz **„Wyniki miesiąca”** od 1. dnia miesiąca, ze zmianą wobec tego samego okresu poprzedniego miesiąca: wartość zamkniętych zleceń (z kosztorysów, brutto), liczba zamkniętych zleceń ze średnim czasem od przyjęcia i **udziałem akceptacji przez link**, **zatwierdzone prace dodatkowe z odsetkiem akceptacji**, czas pracy zespołu |

**Argument:** każdy dostaje ekran dla siebie. Właściciel widzi jedną liczbę, która pokazuje, czy Napiko się zwraca: odsetek zatwierdzonych prac dodatkowych.
**Granice:** raporty rentowności i obłożenia mechaników 🔜 (E10.7). Wartość zamkniętych zleceń bez kosztorysu nie jest wliczana (pulpit to mówi).

### F13. Dziennik zdarzeń i zaufanie ✅

- **Dziennik zdarzeń** (menu Organizacja → Dziennik zdarzeń; widzą go właściciel i biuro): zmiany statusów, przydziały, zgłoszenia, wyceny, decyzje, zdjęcia, wysyłka / otwarcie / odpowiedź / wycofanie próśb o zgodę, dane firmy, cennik, pozycje kosztorysu, paragon, wiadomości do klienta, zmiany ustawień. Wpisy nie powielają danych kontaktowych klienta.
- **Wpisów nie da się zmienić ani usunąć.** Każdy zawiera skrót poprzedniego (łańcuch). Strona pokazuje znacznik **„Łańcuch nienaruszony”** albo ostrzeżenie o naruszeniu.
- **Kotwica dziennika:** raz na dobę „głowa” łańcucha każdego warsztatu jest zapisywana poza bazą, w magazynie z blokadą obiektów, i porównywana z bazą. Przepisanie dziennika staje się wykrywalne. Wymaga konfiguracji magazynu produkcyjnego 🟡.

**Argument:** w razie sporu warsztat pokazuje, kto, kiedy i co zrobił. Wiedza o tym, że dziennik jest niezmienny, uspokaja właścicieli.

---

## 5. Wszystkie funkcje na jednej stronie

| Obszar | Funkcje | Status |
| --- | --- | --- |
| **Konta i zespół** | Rejestracja e-mailem, reset hasła, 3 role (właściciel, biuro, mechanik), zaproszenia, wiele organizacji na jednym koncie, mechanik solo, przełącznik warsztatu | ✅ |
| **Klienci i pojazdy** | Osoby i firmy, NIP, 19 rodzajów pojazdów, VIN / numer ramy / numer fabryczny, km / motogodziny, historia, wyszukiwarka | ✅ |
| **Zlecenia** | Przyjęcie w 3 krokach, numeracja ZL/rok/nr, tablica z przeciąganiem, archiwum, wyszukiwarka, planowany odbiór, 7 statusów | ✅ |
| **Zadania i czas** | Zadania i podzadania, wielu wykonawców, 3 zasady przydziału, licznik Start / Pauza / Zakończ, czas wg zegara bazy | ✅ |
| **Potrzeby i prace dodatkowe** | Zgłoszenie z pilnością i zdjęciami, wstrzymanie zadania, wycena netto / VAT / brutto, decyzja biura lub klienta, części (zamówione → zrealizowane) | ✅ |
| **Zdjęcia i filmy** | Wysyłka do S3, pomniejszanie, usuwanie EXIF / GPS, galeria przy zleceniu i zgłoszeniu | ✅ |
| **Akceptacja klienta** | Link SMS / e-mail / osobiście, strona bez logowania, decyzja per pozycja, zgoda na kwotę, dowód (SHA-256, czas, IP), wycofanie, wygaśnięcie | ✅ |
| **Rozliczenie** | Dane firmy (NIP, IBAN), cennik, kosztorys, akceptacja kosztorysu, numer i data paragonu | ✅ |
| **Wiadomości do klienta** | Przyjęcie i gotowość automatycznie, prośby o zgodę, SMS / push / e-mail, rezygnacja, dziennik wiadomości, ponowienie | ✅ (SMS i push po konfiguracji 🟡) |
| **Status naprawy** | Strona z linku, etapy, postęp, termin, kontakt, push w telefonie klienta, unieważnienie linku, licznik wyświetleń | ✅ |
| **Powiadomienia zespołu** | Dzwonek, 10 typów, kanały per typ, push, PWA | ✅ |
| **Pulpit** | Trzy widoki według roli, „Wymaga uwagi”, „Warsztat dziś”, „Wyniki miesiąca” | ✅ |
| **Bezpieczeństwo i audyt** | Izolacja danych warsztatów w bazie, dziennik zdarzeń z łańcuchem skrótów, kotwica w S3, minimalizacja danych dla mechanika | ✅ (kotwica 🟡) |
| **Interfejs** | Polski i angielski, motyw jasny / ciemny / systemowy, układ na telefon i komputer, instalacja z przeglądarki | ✅ |
| **Protokół przyjęcia z podpisem, inspekcja DVI, raport końcowy, PDF-y** | – | 🔜 (E5.1–E5.5, E5.7) |
| **Faktury i KSeF, magazyn, hurtownie** | – | 🔜 (E4.6, E10.3, E11.1) |
| **Konto klienta (hub), przypomnienia serwisowe, rejestr zgód** | – | 🔜 (E10.1, E6.1) |
| **Tryb offline, aplikacje w sklepach, notatki głosowe** | – | 🔜 (E8.2, E10.4, E10.5, E10.8) |
| **Płatności online, rezerwacje, floty** | – | 🔜 (v2, E11) |

---

## 6. Role i uprawnienia

„Każdy widzi to, czego potrzebuje” to realna reguła w kodzie, nie hasło.

| Uprawnienie | Właściciel | Biuro | Mechanik |
| --- | :---: | :---: | :---: |
| Klienci, pojazdy, zlecenia – odczyt | ✓ | ✓ | ✓ |
| Dane kontaktowe klienta (telefon, e-mail, NIP, notatki) | ✓ | ✓ | – |
| Dodawanie i zmiana klientów, pojazdów, zleceń, zadań | ✓ | ✓ | – |
| Przydział zadań innym | ✓ | ✓ | – |
| Branie zadań samemu (zależnie od zasady warsztatu) | ✓ | ✓ | ✓ |
| Status i czas pracy własnych zadań | ✓ | ✓ | ✓ |
| Zgłaszanie potrzeb, zdjęcia | ✓ | ✓ | ✓ |
| Ceny, wycena, decyzje, prośby o akceptację | ✓ | ✓ | – |
| Rozliczenia: stawka, cennik, kosztorys, paragon | ✓ | ✓ | – |
| Wiadomości do klienta, link do statusu | ✓ | ✓ | – |
| Wyniki miesiąca na pulpicie | ✓ | – | – |
| Dziennik zdarzeń | ✓ | ✓ | – |
| Własne powiadomienia, kanały i push | ✓ | ✓ | ✓ |

Mechanik widzi nazwisko klienta i pojazd, ale **nie widzi** danych kontaktowych, cen, kosztorysu, paragonu ani notatek biura.

---

## 7. Zaufanie: bezpieczeństwo, dane, dowody

Punkty na pytania właścicieli: „gdzie są moje dane?”, „czy inny warsztat je zobaczy?”, „co z RODO?”.

| Temat | Co jest w aplikacji | Status |
| --- | --- | --- |
| **Izolacja warsztatów** | Każda tabela ma identyfikator warsztatu, a baza wymusza izolację (Row Level Security z `FORCE`). Zapomniany filtr w kodzie daje pusty wynik, a nie wyciek. Test pilnuje tego automatycznie dla każdej tabeli | ✅ |
| **Spójność danych** | Złożone klucze obce: nie da się podpiąć pojazdu, zlecenia, zadania ani pliku z innego warsztatu. Wyzwalacze pilnują, że zgłoszenie i zdjęcie należą do tego samego zlecenia | ✅ |
| **Dziennik jako dowód** | Niezmienny, łańcuch skrótów, dzienna kotwica poza bazą | ✅ / 🟡 kotwica |
| **Minimalizacja danych** | Mechanik bez danych kontaktowych i cen; strona statusu bez cen i z zamaskowanym kontaktem; zdjęcia bez GPS; powiadomienia bez danych kontaktowych | ✅ |
| **Linki dla klienta** | Tokeny losowe (192 bity) lub liczone z sekretu (144 bity), w bazie tylko skrót; `noindex`, brak Referer, brak cache; limit zapytań do stron publicznych | ✅ |
| **Kolejka zadań** | Wysyłka SMS i e-maili poza żądaniem użytkownika, z ponowieniami. Awaria bramki nie blokuje pracy. SMSAPI dostaje klucz idempotencji, więc ponowienie nie wyśle duplikatu | ✅ |
| **Jakość** | 174 testy automatyczne (weryfikacja z 08.10.2026, dok. 09). Workflow CI w repozytorium: lint, typy, migracje na czystej bazie, testy na roli bez uprawnień superużytkownika. Uruchamia się na pull requesty i push do `main`, a domyślna gałąź to `master` (dok. 09, ryzyko 7) | ✅ |
| **RODO** | Model: warsztat administratorem, Napiko podmiotem przetwarzającym. Wymaga umowy powierzenia, regulaminu i polityki prywatności | 🔜 (D.3, D.4) |
| **Hosting w UE, kopie zapasowe, monitoring** | Zaplanowane (Netlify Pro region UE, Neon Frankfurt, magazyn UE). Środowisko produkcyjne **jeszcze nie istnieje** | 🔜 (D.6, E9.2, E9.3) |
| **Eksport i usunięcie danych klienta, retencja** | – | 🔜 (E7.2–E7.4) |
| **Logowanie dwuetapowe, CSP, pentest** | – | 🔜 (E7.6) |

**Nie mów** „hosting w UE” ani „zgodne z RODO” jako stanu obecnego. Mów „zaprojektowane pod RODO, hosting w UE w planie wdrożenia”.

---

## 8. Na tle konkurencji

Źródło: raport z 09.2026 (dok. 01, sekcja 1.2–1.5). To wnioski z researchu cenników i opisów produktów, nie z testów. **Sprawdź aktualność przed użyciem na zewnątrz.**

| Funkcja | Polskie programy (Integra Car, PAS24, Warsztat24, Asystent) | Liderzy USA (Tekmetric, Shopmonkey) | **Napiko dziś** |
| --- | --- | --- | --- |
| Zlecenia, zadania, czas pracy | ✔ | ✔ | ✅ |
| Zdalna akceptacja pozycji ze zdjęciem i ceną | brak w badanych | ✔ | ✅ |
| Dowód zgody (treść, skrót, czas, IP) | n/d | n/d | ✅ |
| Status naprawy dla klienta bez logowania | rzadko | ✔ | ✅ |
| Push zamiast SMS-a (bez kosztu) | brak | n/d | ✅ |
| Mechanik w kilku warsztatach, jedno konto | brak | brak | ✅ (wspólny widok dnia 🔜) |
| Wiele rodzajów pojazdów i maszyn (19) | częściowo | głównie auta | ✅ |
| Dostęp z telefonu i przeglądarki, bez instalacji na Windows | głównie desktop | chmura | ✅ |
| Cyfrowa inspekcja (DVI) ze zdjęciami | słabo | ✔ | 🔜 |
| Faktury, KSeF, kasy fiskalne, hurtownie, magazyn | ✔ (silna strona) | ✔ | 🔜 |
| Konto klienta z historią pojazdu | brak | portal warsztatu | 🔜 |

**Pozycjonowanie, które broni się faktami:** Napiko nie jest kolejnym programem do faktur. To warstwa komunikacji i akceptacji, której brakuje w polskich programach. Dziś działa **obok** księgowości i kasy warsztatu, a integracje (Fakturownia z KSeF, drukarka fiskalna) są w planie.

**Dane DVI z USA** (inspekcje z 20+ zdjęciami: średnia wartość zlecenia o ok. 30% wyższa, AutoVitals; dobre praktyki inspekcji +27–28%, raport Detect Auto 2026) to marketing dostawców z innego rynku. Kierunek jest spójny, ale skali nie przenoś na Polskę. Zmierz to w pilotażu.

---

## 9. Czego jeszcze nie ma i jak o tym mówić

| Brakuje | Co jest dziś zamiast | Jak powiedzieć | Plan |
| --- | --- | --- | --- |
| Protokół przyjęcia z podpisem, schemat uszkodzeń | Zlecenie ze stanem licznika, opisem i zdjęciami | „Zdjęcia przy przyjęciu już są, podpis klienta pod protokołem dochodzi” | E5.1, E5.2, K.7 |
| Inspekcja DVI z listą kontrolną | Zgłoszenia z trzystopniową pilnością i zdjęciami | „Pilność jak w inspekcji, lista kontrolna dochodzi” | E5.4 |
| Raport końcowy i PDF-y | Status naprawy, kosztorys na stronie | „Klient widzi wszystko w linku, PDF dochodzi” | E5.3, E5.7 |
| Faktury i KSeF | Numer i data paragonu | „Dziś zapisujemy paragon; fakturę wystawiasz w swoim programie, integracja z Fakturownią w planie” | E4.6 |
| Konto klienta (hub), przekazanie historii przy sprzedaży auta | Historia po stronie warsztatu | „Hub dla klienta to kolejny etap” | E10.1 |
| Katalog marek i modeli, skan Aztec | Ręczne wpisanie | „Podpowiedzi marek dochodzą” | K.1–K.5 |
| Magazyn części, hurtownie | Zgłoszenie części ze statusami ręcznie | „Zamówienia z hurtowni w planie” | E10.3, E11.1 |
| Praca bez zasięgu | Praca online | „Zdjęcia w kolejce offline w planie” | E8.2, E10.5 |
| Aplikacje w sklepach | Aplikacja instalowana z przeglądarki (PWA) | „Działa jak aplikacja, ikona na ekranie” | E10.4 |
| Zmiana roli i usunięcie osoby, 2FA | Zaproszenia i 3 role | „Zarządzanie zespołem w planie” | E7.1, E7.6 |
| Płatności online, rezerwacje, floty | – | „Wersja 2” | E11 |

**Etap projektu (05-plan-prac):** działają etapy E0–E5 (fundament, klienci i zlecenia, mechanik, akceptacja, rozliczenie, powiadomienia). Przed pilotażem w 3–5 warsztatach brakuje m.in. protokołu przyjęcia z podpisem, raportu końcowego, faktur, spraw RODO i formalnych (regulamin, umowa powierzenia), środowiska produkcyjnego w UE oraz konfiguracji SMS i poczty.

---

## 10. Scenariusz demo (ok. 15 minut)

**Przygotowanie.** Pełna lista kroków dla SMS, e-maili i push na prawdziwych telefonach jest w [09-demo-powiadomien-checklista.md](09-demo-powiadomien-checklista.md). Wariant lokalny:

```bash
pnpm run local                                       # Docker, migracje, serwer na http://localhost:3000
DEMO_OWNER_EMAIL=ja@example.com pnpm db:seed:demo    # PowerShell: $env:DEMO_OWNER_EMAIL="ja@example.com"; pnpm db:seed:demo
```

Seed wymaga istniejącego konta właściciela z dokładnie jedną organizacją i tworzy 9 zleceń z zadaniami oraz trzech mechaników (`mechanik1..3@demo.oxy.invalid`). Hasło kont demo to `DEMO_PASSWORD` albo losowe, które wypisze skrypt.

Przy wariancie lokalnym: e-maile czytasz w Mailpit (`http://localhost:8025`), SMS-y trafiają tylko do logu serwera (`[sms:log]`), a link do strony statusu kopiujesz z karty „Powiadomienia klienta”. Telefon klienta symulujesz oknem przeglądarki o szerokości 390 px. Zadania demo są przypisane do właściciela, więc **zdjęcie go z zadania i przydzielenie go mechanikowi jest częścią pokazu**.

**Do historii użyj zlecenia** Joanna Kamińska – Kia Ceed, „Przegląd przed wyjazdem”, zadanie „Kontrola układu hamulcowego”. Pasuje do przykładu z klockami hamulcowymi.

| Czas | Akt | Gdzie / kto | Pokaż | Powiedz |
| --- | --- | --- | --- | --- |
| 0:00 | **Pulpit właściciela** | Komputer, właściciel | „Wymaga uwagi”, „Warsztat dziś”, „Wyniki miesiąca” | „Rano widzisz, co wymaga reakcji, bez dzwonienia do nikogo” |
| 2:00 | **Przyjęcie** | Komputer, biuro | Nowe zlecenie: klient, pojazd, zakres, pole „Powiadom klienta”. Karta „Powiadomienia klienta” | „Klient ma link zanim wyjdzie z warsztatu” |
| 3:30 | **Status klienta** | Telefon (390 px) | Strona statusu: etapy, termin, kontakt, zamaskowany telefon, włączenie push | „Bez logowania, bez aplikacji, bez cen” |
| 5:00 | **Przydział i praca** | Komputer, potem telefon mechanika | Przydział zadania; w telefonie „Moje zadania”, Start licznika | „Mechanik widzi tylko swoje zadania i duże przyciski” |
| 6:00 | **Znaleziona usterka** | Telefon mechanika | „Zgłoś potrzebę”: *praca dodatkowa*, *pilne*, zdjęcie, „Nie mogę kontynuować bez tego” | „Zdjęcie, pilność, wysłane w 30 sekund” |
| 7:30 | **Wycena i wysyłka** | Komputer, biuro | Dzwonek, „Potrzeby”, wycena, „Wyślij do akceptacji klienta”, podgląd | „Biuro wycenia raz, klient decyduje sam” |
| 9:00 | **Decyzja klienta** | Telefon klienta | Link: zdjęcie, cena brutto, „Akceptuję” / „Nie teraz”, zgoda na kwotę, „Wyślij decyzję” | „Klient wie, za co płaci. To jest moment, który dziś kończy się telefonem” |
| 10:30 | **Skutek** | Komputer, biuro i telefon mechanika | Dzwonek, nowe zadanie u mechanika, pozycja w kosztorysie, wpis „Klient odpowiedział” | „Nikt nic nie przepisuje” |
| 11:30 | **Dowód** | Komputer, właściciel | Dziennik zdarzeń, znacznik „Łańcuch nienaruszony”, opis zapisu zgody | „Zapisujemy treść, cenę, czas i adres IP” (bez deklaracji prawnych) |
| 12:30 | **Odbiór** | Komputer, potem telefon klienta | „Zmień status i powiadom”, strona: „Pojazd czeka na odbiór”, zamknięcie z paragonem | „Klient przychodzi wtedy, kiedy auto jest gotowe” |
| 14:00 | **Wyniki** | Komputer, właściciel | „Wyniki miesiąca”: odsetek zatwierdzonych prac dodatkowych | „Tę liczbę mierzymy w pilotażu” |

**Na zapas (30 sekund każdy):** przełączenie języka na angielski i motyw ciemny; zasady przydziału w Ustawieniach; cennik i kosztorys z normą czasu; ustawienia powiadomień zespołu.

**Ekrany do zrzutów na slajdy**

| Ekran | Adres | Uwaga |
| --- | --- | --- |
| Pulpit biura i właściciela | `/app` | Komputer 1440 px |
| Tablica zleceń | `/app/orders` | Komputer |
| Przyjęcie pojazdu | `/app/orders/new` | Komputer |
| Karta zlecenia | `/app/orders/<id>` | Komputer, z potrzebą i kosztorysem |
| Moje zadania | `/app/my-tasks` | Telefon 390 px, z włączonym licznikiem |
| Potrzeby (wycena) | `/app/requests` | Komputer |
| Akceptacja klienta | `/approve/<token>` | Telefon 390 px |
| Status naprawy | `/s/<token>` | Telefon 390 px |
| Cennik | `/app/price-list` | Komputer |
| Dziennik zdarzeń | `/app/audit` | Komputer |
| Dzwonek i powiadomienia | `/app/notifications` | Telefon i komputer |

---

## 11. Obiekcje i odpowiedzi

| Pytanie | Odpowiedź (zgodna z tym, co jest w aplikacji) |
| --- | --- |
| „Klienci nie zainstalują aplikacji.” | Nie muszą. Wszystko działa z linku w SMS-ie lub e-mailu: akceptacja prac i status naprawy. Aplikacja jest tylko dla zespołu (i też z przeglądarki) |
| „Mechanicy nie lubią pisać.” | Zgłoszenie to zdjęcie, wybór pilności i jedno kliknięcie. Przyciski są duże, ekran jest na telefon. Notatki głosowe są w planie |
| „Co z fakturami i KSeF?” | Dziś zapisujemy numer i datę paragonu z Twojej kasy. Faktury wystawiasz w swoim programie. Integracja z Fakturownią (KSeF) jest w planie. Napiko nie zastępuje kasy fiskalnej |
| „Mam już program warsztatowy.” | Napiko dziś działa obok. Zajmuje się komunikacją i akceptacjami, których tamte programy nie robią dobrze. Import klientów z pliku jest w planie, integracje z programami później |
| „Ile to kosztuje?” | Pilotaż planujemy jako bezpłatny (D8). Cennik jest w trakcie walidacji; celem jest poziom rzędu jednej roboczogodziny miesięcznie (dok. 01). **Nie podawaj kwot jako oferty** |
| „SMS-y będą mnie kosztować fortunę.” | SMS tylko przy kluczowych zdarzeniach. Klient może włączyć push w telefonie i wtedy dostaje wiadomość bez kosztu SMS-a. SMS pisany jest bez polskich znaków, żeby mieścił się w jednej wiadomości |
| „Czy ta zgoda jest ważna w sądzie?” | Zapisujemy treść pokazaną klientowi, jej skrót, decyzję przy każdej pozycji, zgodę na kwotę, czas i adres IP. Ocenę skuteczności prawnej robi prawnik przed pilotażem. **Nie obiecuj więcej** |
| „Gdzie są dane? Kto je widzi?” | Każdy warsztat ma izolowane dane, wymuszone w bazie. Mechanik nie widzi danych kontaktowych ani cen. Hosting w UE jest planowany na etap wdrożenia produkcyjnego |
| „Co, jeśli klient nie odpowie?” | Link ma termin ważności (1–14 dni). Po wygaśnięciu biuro dostaje powiadomienie i widzi sprawę w „Wymaga uwagi”, może wysłać nowy link albo zapisać decyzję telefoniczną |
| „Co, jeśli wyślę link na zły numer?” | „Nowy link” unieważnia poprzedni. Prośby o zgodę można też wycofać |
| „Mamy kilku mechaników i różne zasady pracy.” | Trzy zasady przydziału: biuro przydziela, mechanicy sami biorą albo mieszana. Wielu wykonawców przy jednym zadaniu |
| „Czy działa u nas bez internetu?” | Nie, wymaga połączenia. Praca bez zasięgu (kolejka zdjęć) jest w planie |
| „A rowery / maszyny rolnicze / wózki?” | Tak. 19 rodzajów pojazdów, numer ramy lub fabryczny zamiast VIN, motogodziny zamiast kilometrów |

---

## 12. Szkielet prezentacji (14 slajdów)

| # | Slajd | Komunikat | Źródło w dokumencie |
| --- | --- | --- | --- |
| 1 | **Problem** | Usterka w środku naprawy kończy się telefonem, czekaniem i sporem o cenę | 1 |
| 2 | **Napiko w jednym zdaniu** | Warsztat, mechanik i klient w jednym przepływie, zgoda zapisana jako dowód. Trzy obietnice | 1 |
| 3 | **Jedna naprawa od A do Z** | Tabela torów: biuro, mechanik, klient, system | 3 |
| 4 | **Przyjęcie w kilka minut** | Klient, pojazd, zakres, powiadomienie. Klient ma link od razu | F3 |
| 5 | **Mechanik na telefonie** | Moje zadania, licznik, zdjęcia, zgłoszenie jednym kliknięciem | F5 |
| 6 | **Praca dodatkowa: od znaleziska do zgody** (slajd główny) | Zdjęcie → wycena → link → decyzja → nowe zadanie | F6, F7 |
| 7 | **Co widzi klient** | Dwa zrzuty z telefonu: akceptacja i status naprawy | F7, F9 |
| 8 | **Kosztorys, który klient akceptuje** | Cennik, norma czasu, rachunek co do grosza, wersje | F8 |
| 9 | **Pulpit dla każdej roli** | Wymaga uwagi, Warsztat dziś, Wyniki miesiąca | F12 |
| 10 | **Zespół i role** | 3 role, 3 zasady przydziału, mechanik solo i w kilku warsztatach | F1, 6 |
| 11 | **Zaufanie** | Izolacja danych, dziennik z łańcuchem, minimalizacja danych | F13, 7 |
| 12 | **Na tle rynku** | Komunikacja i akceptacje jako luka polskich programów | 8 |
| 13 | **Gdzie jesteśmy i dokąd idziemy** | Działa: E0–E5. Dochodzi: protokół z podpisem, raport, faktury, hub klienta | 9 |
| 14 | **Pilotaż** | 3–5 warsztatów, przykładowe kryterium sukcesu (D12): co najmniej połowa zleceń z akceptacją przez link, mierzone na pulpicie | 1, F12 |

---

## 13. Rozbieżności i ryzyka wykryte przy zbieraniu materiału

Rzeczy do naprawienia lub świadomego ominięcia, zanim pokażesz aplikację klientom. Nic z tego nie zostało zmienione w kodzie.

| # | Co | Gdzie | Ryzyko | Rekomendacja |
| --- | --- | --- | --- | --- |
| 1 | ~~**Strona startowa obiecuje więcej, niż aplikacja potrafi.**~~ **Naprawione:** nowa strona główna i podstrony nie obiecują protokołu z podpisem ani historii pojazdu, a te funkcje są oznaczone „w planie” (zob. [13-strona-marketingowa.md](13-strona-marketingowa.md)). Opis pierwotny: „Przebieg, uszkodzenia i zdjęcia w protokole podpisanym przez klienta” oraz „Klient ma bezpłatny dostęp do historii napraw swoich pojazdów” | `i18n/locales/pl.json` (`landing.features.intake`, `landing.features.history`), strona `/` | Protokół z podpisem (E5.1–E5.2) i hub klienta (E10.1) nie istnieją. Każdy, kto otworzy stronę główną, może zapytać o te funkcje | Przeformułować opisy na to, co działa (zdjęcia przy przyjęciu, akceptacje, status naprawy), albo oznaczyć jako „wkrótce” |
| 2 | **Nieaktualny tekst przy zapisie decyzji w zgłoszeniu:** „Akceptację przez link wyślesz w kolejnym etapie. Na razie zapisz, jak klient przekazał decyzję” | `requests.decisionHint` w `pl.json`, używany w `WorkRequestCard.vue` | Pojawia się w oknie decyzji biura na demo i zaprzecza temu, co pokazujesz (link już działa) | Zmienić tekst na opis zgody telefonicznej |
| 3 | **Dokumentacja modułów twierdzi, że brakuje przeciągania kart na tablicy** | `docs/04-moduly-warsztatu.md`, sekcja 7 | Tablica zleceń już to potrafi (`app/pages/app/orders/index.vue`). Materiały sprzedażowe oparte na dokumencie 04 niedoszacują produktu | Uaktualnić dokument 04 |
| 4 | **SMS domyślnie w trybie `log`, SMTP domyślnie lokalny** | `.env.example`, dok. 09 | Bez konfiguracji klient nie dostanie SMS-a, a e-maile kończą błędem w kolejce | Zob. dok. 09, sekcje 1–4; zrobić test dymny dzień przed pokazem |
| 5 | **Środowisko produkcyjne nie istnieje** (Netlify, baza w UE, magazyn, poczta) | dok. 05 (D.6, E9.2), dok. 09 | Nie można pokazać aplikacji pod docelowym adresem ani obiecać hostingu w UE | Pokaz lokalny albo na wdrożeniu testowym; nie deklarować lokalizacji danych |
| 6 | **Zmiana `nuxt.config.ts` (cel `es2022` dla literałów BigInt) jest niezatwierdzona w git** | `git status` | Netlify buduje z repozytorium, więc wdrożenie nie zobaczy tej zmiany. Nie sprawdzono, czy build bez niej się nie powiedzie | Zatwierdzić zmianę przed wdrożeniem (zob. dok. 09, ryzyko 6) |
| 7 | **Liczby i twierdzenia rynkowe pochodzą z researchu, nie z pomiarów** | dok. 01, 02 | Cenniki konkurentów i dane DVI z USA łatwo zdezaktualizować lub zakwestionować | Podawać ze źródłem i datą albo pominąć w materiałach zewnętrznych |

---

## 14. Co sprawdzono przy pisaniu tego dokumentu

- Przeczytano kod ekranów: strona startowa, rejestracja i onboarding, nowe zlecenie, tablica i karta zlecenia, moje zadania, potrzeby, akceptacja klienta, status naprawy, zespół, dziennik zdarzeń, pulpit i jego sekcje, nawigacja.
- Zweryfikowano w kodzie reguły: uprawnienia ról (`shared/permissions.ts`), statusy i słowniki (`shared/workshop.ts`), automaty statusów (`server/utils/task-status.ts`), skutki decyzji (`server/utils/work-requests.ts`), akceptacje i tokeny (`server/utils/approvals.ts`), wysyłka SMS (`server/lib/sms.ts`), szablony e-maili, kotwica dziennika (`server/db/audit-anchor.ts`), limity plików (`shared/schemas.ts`), pomniejszanie zdjęć (`app/composables/useStorageUpload.ts`).
- Liczby: 19 rodzajów pojazdów, 3 role, 7 statusów zlecenia, 7 statusów zadania, 10 typów powiadomień zespołu, 4 zdarzenia wiadomości do klienta, ważność linku 1–14 dni (domyślnie 3) wynikają bezpośrednio z kodu.
- **Nie uruchamiano aplikacji ani testów** w ramach tego dokumentu. Liczba 174 testów pochodzi z weryfikacji w dok. 09 (08.10.2026). Opisy ekranów pochodzą z kodu i tłumaczeń, nie ze zrzutów.
- Twierdzenia o rynku, konkurencji i prawie pochodzą z dokumentów 01 i 02 i nie zostały tu ponownie zweryfikowane.
