# OXY – moduły warsztatu (etapy 1–5)

**Wersja:** 0.4 · **Data:** 29.09.2026
**Powiązane:** [02-decyzje-produktowe.md](02-decyzje-produktowe.md), [03-architektura-i-infrastruktura.md](03-architektura-i-infrastruktura.md), [07-powiadomienia.md](07-powiadomienia.md), [README](../README.md)

Dokument opisuje, co działa w aplikacji po pięciu etapach budowy, jak przebiega praca w warsztacie, jakie reguły pilnuje system i co trzeba jeszcze sprawdzić przed pilotażem.

Decyzje D1–D7 zapadły 26.09.2026 (dokument 02). Etap 4 (rozliczenie zlecenia) powstał bez integracji zewnętrznych: faktury przez Fakturownię z wysyłką do KSeF, SMS-y z prawdziwej bramki i dane z CEPiK dojdą później – plan prac, dokument 05. Etap 5 (powiadomienia dla zespołu i klienta, strona statusu naprawy, push) opisuje osobno dokument [07-powiadomienia.md](07-powiadomienia.md); tu jest tylko jego skrót.

---

## 1. Przepływ pracy

```
Biuro: przyjęcie pojazdu ─► zlecenie z zadaniami ─► przydział mechaników
                                                        │
Mechanik: „Moje zadania” ─► Start / Pauza / Zakończ (czas pracy) ─► „Zgłoś potrzebę” (+ zdjęcia)
                                                        │
Biuro: „Potrzeby” ─► wycena (netto + VAT → brutto) ─► prośba o akceptację (SMS / e-mail / link)
                                                        │
Klient: strona z opisem, zdjęciami i cenami brutto ─► decyzja przy każdej pozycji + wyraźna zgoda
                                                        │
System: zatwierdzona praca = nowe zadanie dla mechanika, który ją zgłosił + pozycje w kosztorysie;
        odrzucona – mechanik kończy tylko pierwotny zakres; zlecenie wraca do realizacji; biuro dostaje e-mail

Biuro: kosztorys (cennik, części, robocizna, rabat, VAT) ─► kosztorys do akceptacji (ten sam link)
                                                        │
Klient: pozycje, sumy netto / VAT / brutto, dane warsztatu ─► „Akceptuję kosztorys” + zgoda na kwotę
                                                        │
Biuro: zamknięcie zlecenia ─► numer i data paragonu z kasy fiskalnej
```

## 2. Co działa

| Etap | Obszar | Funkcje |
| --- | --- | --- |
| 1 | Klienci | Lista z wyszukiwarką. Wyszukuje po nazwisku, telefonie, e-mailu, NIP, nr rej. i VIN; mechanik tylko po nazwisku, nr rej. i VIN. Karta klienta: pojazdy i historia zleceń. Telefon zapisywany jako +48… |
| 1 | Pojazdy | 19 rodzajów, m.in. auta, motocykle, rowery, wózki widłowe, ciągniki, maszyny i łodzie. Formularz dopasowuje pola: VIN albo nr ramy / seryjny, km albo motogodziny. Karta pojazdu z historią zleceń |
| 1 | Zlecenia | Przyjęcie w 3 krokach: klient → pojazd → zakres i zadania. Numeracja ZL/rok/nr osobna dla każdego warsztatu. Tablica statusów, archiwum, filtr „tylko moje” |
| 1 | Zadania | Zadania i podzadania (2 poziomy). Przydział wielu osób według polityki warsztatu: biuro / sami / mieszana. Pierwsze rozpoczęte zadanie przenosi zlecenie do realizacji |
| 2 | Mechanik | Ekran „Moje zadania” na telefon. Licznik czasu Start / Pauza / Zakończ – jeden naraz, start innego zadania wstrzymuje poprzednie. Sekcja „Do wzięcia”, gdy polityka pozwala brać zadania samemu |
| 2 | Potrzeby | Mechanik zgłasza część do zamówienia albo pracę dodatkową z pilnością (pilne / zalecane / może poczekać) i zdjęciami. Może wstrzymać zadanie do czasu dostawy części lub decyzji klienta |
| 2 | Biuro | Ekran „Potrzeby”: wycena (części + robocizna netto, VAT, brutto), decyzja z notatką (np. zgoda telefoniczna), zamówienie i dostawa części |
| 2 | Zdjęcia i filmy | Wysyłka prosto do magazynu S3. Zdjęcia są przed wysyłką pomniejszane do ok. 1600 px (decyzja D7) i czyszczone z metadanych EXIF, w tym GPS. Galeria w zleceniu i przy zgłoszeniu. Usuwanie: autor w ciągu doby albo biuro |
| 3 | Akceptacja klienta | Link wysyłany SMS-em lub e-mailem albo przekazywany osobiście, ważny 1–14 dni. Strona dla klienta bez logowania: opis, zdjęcia, ceny brutto, decyzja przy każdej pozycji, wyraźna zgoda na koszt, uwagi dla warsztatu. Biuro widzi otwarcie linku i odpowiedź, może wycofać prośbę i od razu wysłać nowy link po wygaśnięciu |
| 4 | Dane firmy | W ustawieniach: pełna nazwa, NIP (z sumą kontrolną; firmy z UE – numer VAT), adres, kontakt, rachunek (IBAN z sumą kontrolną), stawka roboczogodziny netto, domyślny VAT, stopka kosztorysu |
| 4 | Cennik usług | Usługi z ceną stałą albo z normą czasu (cena = norma × stawka roboczogodziny), kategorie, wyszukiwarka, VAT. Nazwy w aktywnym cenniku się nie powtarzają. Usunięcie z cennika nie zmienia istniejących kosztorysów |
| 4 | Kosztorys | Pozycje: robocizna, części, inne – z cennika albo wpisane ręcznie (ilość, jednostka, cena netto, rabat, VAT). Wartość pozycji i sumy netto / VAT / brutto, zestawienie według stawek VAT. Zatwierdzone wyceny zgłoszeń trafiają do kosztorysu same (robocizna i części osobno) |
| 4 | Akceptacja kosztorysu | Ten sam link co przy pracach dodatkowych. Klient widzi dane warsztatu, pozycje, sumy i stopkę; akceptuje całość z wyraźną zgodą na kwotę albo odrzuca z uwagą. Po zmianie kosztorysu biuro widzi, że zaakceptowana wersja jest nieaktualna |
| 4 | Zamknięcie zlecenia | Okno zamknięcia z numerem i datą paragonu z kasy fiskalnej (decyzja D4a). Paragon można uzupełnić albo poprawić także w zamkniętym zleceniu. Karta „Rozliczenie” z kwotą kosztorysu i paragonem |
| 5 | Powiadomienia zespołu | Dzwonek w panelu (komputer i telefon): lista, licznik, przejście do zlecenia. Nowe zadanie, zadania do wzięcia, zgłoszenie potrzeby, decyzja, część zamówiona i dostarczona, odpowiedź klienta, wygaśnięcie linku, wszystkie zadania zakończone. Każda osoba wybiera kanały (dzwonek, e-mail, push) osobno dla każdego typu. Push w przeglądarce i w aplikacji zainstalowanej na telefonie (PWA) |
| 5 | Wiadomości do klienta | Przy przyjęciu pojazdu i gotowości do odbioru (decyzja D5): SMS albo push i e-mail. Pole „Powiadom klienta” jest zaznaczone od razu, biuro może je odznaczyć; ustawienia warsztatu wybierają zdarzenia i kanały. Dziennik wiadomości i ponowna wysyłka w zleceniu; rezygnacja klienta z SMS-ów i e-maili |
| 5 | Status naprawy | Strona bez logowania: etap naprawy, postęp prac, termin odbioru, kontakt do warsztatu; bez cen i danych klienta. Klient włącza na niej powiadomienia w telefonie (push zamiast SMS-a) albo rezygnuje z wiadomości. Biuro widzi liczbę otwarć i może unieważnić link |

### Pulpit według roli

Pulpit (`/app`) pokazuje to, co w danej roli najważniejsze. Liczniki liczy serwer (`GET /api/dashboard`) na pełnych danych, w strefie czasowej warsztatu – nie z list obciętych do kilku pozycji. Sekcji, do której rola nie ma uprawnień, serwer nie liczy ani nie wysyła.

| Rola | Co widać |
| --- | --- |
| Mechanik | Bieżące zadanie z licznikiem i przyciskami Pauza / Zakończ, zgłoszeniem potrzeby i zdjęciem – a gdy licznik stoi, następne zadanie ze Startem. Czas pracy dziś, zadania zrobione dziś, kolejka i zadania czekające na część lub decyzję klienta. Co dzieje się z potrzebami, które zgłosił. Zadania do wzięcia (polityka „sami biorą”) |
| Biuro | „Wymaga uwagi” – od najpilniejszych: zlecenia po terminie odbioru, potrzeby do wyceny (z liczbą pilnych), odpowiedzi klientów z ostatnich 48 godzin, wygasłe linki, wyceny bez decyzji, części do zamówienia i zamówione, pojazdy gotowe do odbioru, zlecenia bez zadań albo z zadaniami bez wykonawcy, prośby czekające na klienta. „Warsztat dziś”: odbiory, przyjęte i zamknięte zlecenia, zlecenia według statusu, zespół teraz (kto przy czym pracuje, czas pracy dziś, kolejka). Lista kroków konfiguracji warsztatu (dane firmy, stawka roboczogodziny, cennik, zespół, pierwsze zlecenie) – znika po uzupełnieniu albo ukryciu |
| Właściciel | To samo co biuro oraz „Wyniki miesiąca” od 1. dnia miesiąca ze zmianą wobec tego samego okresu poprzedniego miesiąca: wartość zamkniętych zleceń (z kosztorysów, brutto), liczba zamkniętych zleceń ze średnim czasem od przyjęcia i udziałem akceptacji przez link, zatwierdzone prace dodatkowe z odsetkiem akceptacji, czas pracy zespołu |

Biuro i właściciel, którzy mają przydzielone zadania, widzą nad sprawami do załatwienia pasek „Twoja praca” z licznikiem i przyciskami Start / Pauza / Zakończ. Pulpit odświeża się co minutę i po powrocie do karty przeglądarki. Mechanik ma pulpit w dolnym menu na telefonie.

## 3. Role i uprawnienia

| Uprawnienie | Właściciel | Biuro | Mechanik |
| --- | :---: | :---: | :---: |
| Klienci, pojazdy, zlecenia – odczyt | ✓ | ✓ | ✓ |
| Dane kontaktowe klienta (telefon, e-mail, NIP, notatki) | ✓ | ✓ | – |
| Dodawanie i zmiana klientów, pojazdów, zleceń, zadań | ✓ | ✓ | – |
| Przydział zadań innym | ✓ | ✓ | – |
| Branie zadań samemu (zależnie od polityki) | ✓ | ✓ | ✓ |
| Status i czas pracy – własne zadania | ✓ | ✓ | ✓ |
| Zgłaszanie potrzeb, zdjęcia | ✓ | ✓ | ✓ |
| Ceny, wycena, decyzje, prośby o akceptację | ✓ | ✓ | – |
| Rozliczenia: stawka roboczogodziny, cennik, kosztorys, paragon (uprawnienie `billing`) | ✓ | ✓ | – |
| Wyniki warsztatu na pulpicie (uprawnienie `report`) | ✓ | – | – |
| Dane firmy – odczyt / zmiana | ✓ / ✓ | ✓ / ✓ | ✓ (bez stawki) / – |
| Wiadomości do klienta: wysyłka, dziennik, link do statusu (uprawnienie `customerNotification`) | ✓ | ✓ | – |
| Automatyczne powiadomienia klienta w ustawieniach warsztatu (uprawnienie `settings`) – zmiana | ✓ | ✓ | – |
| Własne powiadomienia, kanały i push na własnym urządzeniu | ✓ | ✓ | ✓ |

Mechanik widzi nazwisko klienta i pojazd, ale nie widzi danych kontaktowych klienta, cen, kosztorysu, paragonu ani notatek biura (minimalizacja danych).

## 4. Reguły, których pilnuje system

- **Izolacja warsztatów:** każda tabela ma `org_id`, wymuszone RLS i złożone klucze obce `(org_id, id)`. Nie da się podpiąć pojazdu, zlecenia, zadania, zgłoszenia ani pliku z innego warsztatu – sprawdzają to testy.
- **Spójność zleceń:** podzadanie, zgłoszenie, zdjęcie i pozycja prośby muszą należeć do tego samego zlecenia (wyzwalacze w bazie).
- **Zamknięte zlecenie jest tylko do odczytu** – można je jedynie ponownie otworzyć.
- **Czas pracy:** jedna osoba ma w warsztacie najwyżej jeden uruchomiony licznik (unikalny indeks). Czas liczy zegar bazy, a zatrzymanie lub zakończenie zadania zatrzymuje liczniki.
- **Praca dodatkowa bez wyceny nie może zostać zatwierdzona ani wysłana klientowi** – klient musi znać koszt.
- **Kwoty kosztorysu** liczymy w groszach na liczbach całkowitych (bez błędów zaokrągleń): netto pozycji = ilość × cena × (1 − rabat), VAT od netto pozycji, zaokrąglenie połówek w górę przy każdej pozycji. Sumy to suma pozycji – zgadzają się co do grosza z tym, co widzi klient. Ta sama funkcja liczy w aplikacji i na serwerze.
- **Kosztorys:** pozycja z wyceny zgłoszenia musi należeć do tego samego zlecenia (wyzwalacz), a ta sama wycena trafia do kosztorysu tylko raz (unikalny indeks). Ilość > 0, cena ≥ 0, rabat i VAT 0–100% (ograniczenia w bazie). W zamkniętym zleceniu kosztorysu nie da się zmienić.
- **Jeden kosztorys naraz czeka na klienta** – kolejną wersję wyśle się po odpowiedzi, wycofaniu albo wygaśnięciu linku.
- **Zlecenie wraca do realizacji**, gdy nic już nie czeka na klienta: po odpowiedzi albo po wycofaniu prośby.
- **Powiadomienia zespołu** powstają w tej samej transakcji co zmiana danych, więc nie zginą po błędzie. Nikt nie dostaje powiadomienia o własnym działaniu. Zawierają tylko teksty i liczby, bez danych kontaktowych klienta; treści nie da się zmienić, odbiorca może je tylko oznaczyć jako przeczytane.
- **Wiadomości do klienta** wychodzą automatycznie raz na zlecenie i zdarzenie; ponowna wysyłka wymaga decyzji biura. Rezygnacja klienta z SMS-ów albo e-maili zatrzymuje wiadomości automatyczne, ale nie prośby o akceptację, które biuro wysyła świadomie.
- **Dziennik zdarzeń** (łańcuch skrótów, bez możliwości zmian) obejmuje:
  - zmiany statusów,
  - przydziały,
  - zgłoszenia, wyceny i decyzje,
  - zdjęcia,
  - wysłanie, otwarcie, odpowiedź i wycofanie prośby o akceptację (prace dodatkowe i kosztorys),
  - dane firmy, cennik, pozycje kosztorysu i zapis paragonu,
  - wysłanie wiadomości do klienta, zmianę ustawień powiadomień klienta, unieważnienie linku statusu i wyłączenie telefonu klienta.

  Wpisy nie powielają danych kontaktowych klienta.

## 5. Dowód zgody klienta (etap 3)

| Co zapisujemy | Po co |
| --- | --- |
| Treść pokazaną klientowi: pozycje, opisy, ceny brutto, zdjęcia (`snapshot`) i jej skrót SHA-256 | Można wykazać, na co dokładnie klient się zgodził, nawet gdy wycena się później zmieni |
| Decyzję przy każdej pozycji, zaznaczoną zgodę na łączny koszt, uwagi klienta | Wyraźna zgoda na dodatkową płatność |
| Datę i godzinę, adres IP, przeglądarkę | Identyfikacja okoliczności złożenia oświadczenia |
| Wpis `approval.answered` w dzienniku (ze skrótem treści) | Ochrona przed późniejszą zmianą danych |

Przy kosztorysie (etap 4) treść zawiera dodatkowo dane warsztatu (nazwa, NIP, adres, kontakt), wszystkie pozycje z wartościami, sumy według stawek VAT, stopkę i skrót pozycji kosztorysu (`estimateHash`). Klient podejmuje jedną decyzję o całości; akceptacja wymaga zaznaczenia zgody na podaną kwotę brutto. Gdy biuro zmieni kosztorys po wysyłce, skrót przestaje się zgadzać i karta zlecenia pokazuje, że klient zaakceptował inną wersję.

Zabezpieczenia linku:

- token ma 192 bity losowości, a w bazie jest tylko jego skrót;
- strona jest wyłączona z indeksowania i działa bez nagłówka Referer;
- dane ładują się dopiero w przeglądarce, więc podgląd linku w komunikatorze nie oznacza prośby jako otwartej;
- zespół warsztatu widzi podgląd, ale nie może odpowiedzieć w imieniu klienta.

## 6. Do weryfikacji z prawnikiem przed pilotażem

Poniższe punkty to założenia techniczne – wymagają potwierdzenia.

1. Czy zatwierdzenie przez link spełnia **formę dokumentową** (art. 77² KC) i wymóg **wyraźnej zgody na dodatkową płatność** (art. 10 ustawy o prawach konsumenta)? Do sprawdzenia także treść zgody i informacji na stronie klienta.
2. **Ceny dla konsumentów** pokazujemy jako brutto (ustawa o informowaniu o cenach towarów i usług). Czy układ „części + robocizna, w tym VAT” wystarcza?
3. **Role w RODO:** warsztat jest administratorem danych klientów, OXY podmiotem przetwarzającym. Potrzebne są wzór umowy powierzenia i klauzula informacyjna. Strona klienta podaje dziś nazwę warsztatu jako administratora.
4. **SMS z linkiem** traktujemy jako wiadomość transakcyjną, niezbędną do realizacji umowy, a nie marketing. Zaproszenie do konta klienta (hub) będzie wymagało zgody (PKE) – to kolejny etap.
5. **Okres przechowywania** dowodów zgody, zdjęć i dziennika – do ustalenia; proponujemy okres przedawnienia roszczeń.
6. **Wizerunek i tablice rejestracyjne na zdjęciach:** zasady dla zdjęć pokazywanych klientowi.
7. **Akceptacja kosztorysu przez link** jako uzgodnienie wynagrodzenia kosztorysowego (art. 630 KC): czy treść zgody i zapis wersji kosztorysu wystarczą, także gdy warsztat później rozszerza zakres (wtedy prosi o zgodę na prace dodatkowe).
8. **Paragon:** OXY zapisuje tylko numer i datę paragonu z kasy warsztatu – obowiązki fiskalne zostają po stronie warsztatu. Do potwierdzenia z doradcą podatkowym, zanim dojdą faktury (KSeF).
9. **Powiadomienia i strona statusu naprawy** (etap 5): wiadomości transakcyjne z możliwością rezygnacji, push w telefonie klienta, zakres danych na stronie bez logowania i okres ważności linku – zob. [07-powiadomienia.md](07-powiadomienia.md), punkt 7.

## 7. Ograniczenia i następne kroki

- **SMS:** bramka SMSAPI jest zaprogramowana, ale nie była testowana z prawdziwym kontem. Lokalnie i domyślnie działa tryb `log` – SMS trafia tylko do logów, bez numeru i tokenu. Do uruchomienia potrzebne są `SMS_PROVIDER=smsapi`, `SMSAPI_TOKEN` i zarejestrowana nazwa nadawcy.
- **Brakuje jeszcze:**
  - raportu końcowego dla klienta;
  - faktur (Fakturownia/KSeF) – po integracjach, zadanie E4.6;
  - katalogu pojazdów z danymi CEPiK i skanu kodu Aztec – po integracjach (etap K);
  - dokumentów PDF (kosztorys, protokół);
  - konta klienta (hub z historią pojazdu);
  - magazynu i zamówień u hurtowni;
  - eksportu dowodu zgody do PDF;
  - przeciągania kart na tablicy.
- **Powiadomienia push** działają w przeglądarce i w aplikacji zainstalowanej z przeglądarki (PWA), ale wymagają kluczy VAPID (`pnpm push:keys`) – bez nich zespół ma dzwonek i e-mail, a klient SMS-a. Ograniczenia: [07-powiadomienia.md](07-powiadomienia.md), punkt 9.
- **Aplikacje mobilne (Capacitor):** ikony dynamiczne są już w paczce klienta; mechanizm logowania dla aplikacji mobilnej jest do zaprojektowania. Natywny push w aplikacjach ze sklepów – razem z Capacitorem (E10.4).

## 8. Testy

| Zestaw | Zakres | Wynik |
| --- | --- | --- |
| `pnpm test` (14 plików) | Baza: RLS i izolacja warsztatów, dziennik, kolejka, schemat, rdzeń warsztatu, praca mechanika, akceptacje, rozliczenia (rachunek w groszach, NIP, IBAN, reguły kosztorysu i cennika), dane demo, pulpit (liczniki, granice dnia i miesiąca w strefie warsztatu, kwoty co do grosza, uprawnienie `report`, izolacja), powiadomienia (rozsyłanie, wiadomości do klienta, push, strona statusu – dwa pliki) | 153 / 153 |
| E2E etap 1 (API) | Klienci, pojazdy, zlecenia, zadania, polityki przydziału, uprawnienia ról, izolacja | 53 / 53 |
| E2E etap 2 (API) | Licznik czasu, zgłoszenia, wycena, decyzje, części, zdjęcia, kolejka usuwania plików | 44 / 44 |
| E2E etap 3 (API) | Wysyłka e-mail / SMS / link, strona klienta, podgląd warsztatu, zgoda, wygaśnięcie, wycofanie, dziennik | 44 / 44 |
| E2E etap 4 (API) | Dane firmy, cennik, kosztorys, akceptacja kosztorysu, wyceny w kosztorysie, wycofanie, zamknięcie z paragonem, uprawnienia mechanika | 58 / 58 |
| E2E etap 5 (API) | Push z prawdziwym szyfrowaniem do atrapy usługi push, e-mail z `List-Unsubscribe`, SMS w logu bez numeru, strona statusu (etapy, maskowanie, wyświetlenia), push zamiast SMS-a, rezygnacja jednym kliknięciem, unieważnienie linku, uprawnienia | 64 / 64 |
| Przegląd w przeglądarce | Biuro (desktop i telefon), mechanik i klient (telefon 390 px), w tym kosztorys, cennik, akceptacja kosztorysu i zamknięcie, a w etapie 5 dzwonek, ustawienia powiadomień, okno „Powiadom klienta” i strona statusu – bez błędów w konsoli | ✓ |
| Przegląd pulpitu (29.09.2026) | Właściciel, biuro i dwóch mechaników na danych przykładowych: telefon 390 px i desktop 1440 px, jasny i ciemny motyw, pauza i wznowienie pracy z pulpitu, start z paska „Twoja praca”, ukrycie listy konfiguracji – bez błędów w konsoli i bez przewijania w poziomie | ✓ |
