# OXY – podsumowanie analizy i decyzje przed specyfikacją wymagań

**Faza:** 1 – analiza (waterfall) · **Wersja:** 0.2 · **Data:** 26.09.2026 · **Decyzje D1–D7:** podjęte 26.09.2026
**Na podstawie:** [01-raport-analityczny.md](01-raport-analityczny.md) oraz weryfikacji kluczowych faktów prawnych (punkt 2)

Punkt 1 zawiera wnioski w skrócie, punkt 2 wyniki weryfikacji w źródłach, a punkt 3 sprawy dla prawnika i doradcy podatkowego. Najważniejszy jest punkt 4: decyzje, bez których nie da się spisać specyfikacji wymagań (SRS). Przy każdej jest rekomendacja. Wystarczy odpisać „akceptuję” albo wskazać, co zmieniasz.

---

## 1. Najważniejsze wnioski

1. **Nisza to komunikacja, nie ERP.** Polskie programy (Integra Car 7, PAS24, Warsztat24, Asystent) dobrze obsługują zlecenia, magazyn i faktury. Według researchu żaden z nich nie robi dobrze tego, co opisałeś: cyfrowego przyjęcia pojazdu, inspekcji ze zdjęciami i wideo, zdalnej akceptacji prac dodatkowych, historii pojazdu po stronie klienta ani obsługi mechanika pracującego dla kilku organizacji.
2. **Scenariusz z klockami hamulcowymi to rdzeń produktu, a przy okazji wymóg prawny.** Przy wynagrodzeniu kosztorysowym warsztat, który nie uprzedzi klienta o znacznym wzroście kosztów, traci roszczenie o dopłatę (art. 630 § 2 KC). Zapis akceptacji w OXY chroni pieniądze warsztatu i to jest najmocniejszy argument sprzedażowy.
3. **Klient nie może być zmuszony do instalacji aplikacji.** Raporty i akceptacje muszą działać z linku w SMS-ie, zabezpieczonego kodem jednorazowym. Aplikacja i hub klienta to dodatek, który z czasem buduje efekt sieciowy.
4. **OXY nie zastąpi kasy fiskalnej i nie musi być programem do faktur.** Warsztat musi mieć kasę online, a kasa wirtualna jest dla warsztatów niedostępna. Faktury najrozsądniej wystawiać przez integrację z programem, który obsługuje KSeF (np. Fakturownia, inFakt).
5. **SMS-y mogą kosztować więcej niż abonament.** Przy 300 zleceniach miesięcznie i 3 SMS-ach na zlecenie to ok. 70–135 zł netto, a przy 8 SMS-ach 190–360 zł. Domyślnymi kanałami powinny więc być push i e-mail, a SMS-y tylko przy kluczowych zdarzeniach i w pakietach.
6. **Technologia pasuje do Twojego stacku:** Nuxt + TypeScript + Capacitor (jedna baza kodu na web, Androida i iOS), PostgreSQL z izolacją danych warsztatów (Row Level Security), tryb offline dla mechanika i hosting w UE.
7. **Pierwsza wersja z raportu (12 modułów) to dużo pracy jak na jedną osobę.** Proponuję podzielić ją na v1.0 (pilotaż) i v1.1 (start komercyjny); zob. decyzja D2.

---

## 2. Weryfikacja faktów (26.09.2026)

| Teza z raportu | Wynik | Źródło |
|---|---|---|
| KSeF obowiązkowy od 1.02.2026 (najwięksi) i od 1.04.2026 (pozostali); odbiór faktur przez KSeF od 1.02.2026 dla wszystkich | Potwierdzone | [inFakt](https://www.infakt.pl/blog/ksef-najmniejsze-firmy-maja-czas-do-2027-roku-jak-dziala-odroczenie/) |
| Mikroprzedsiębiorcy mogą wystawiać faktury poza KSeF do 31.12.2026, jeśli faktury B2B nie przekraczają 10 000 zł brutto miesięcznie. Przekroczenie limitu jest nieodwracalne. Kary od 2027 | Potwierdzone | [inFakt](https://www.infakt.pl/blog/ksef-najmniejsze-firmy-maja-czas-do-2027-roku-jak-dziala-odroczenie/) |
| Faktury z kasy i faktury uproszczone (paragon z NIP do 450 zł) poza KSeF: do 30.09 czy do 31.12.2026? | **Rozstrzygnięte: do 31.12.2026** (art. 145n ust. 1 pkt 1 ustawy o VAT). Daty 30.09 nie potwierdza żadne źródło | [sklepfiskalny.pl](https://sklepfiskalny.pl/pl/n/KSeF-a-wystawianie-faktur-na-kasie-fiskalnej-zasady-w-2026-i-od-2027-roku/128), [KSeFakt](https://ksefakt.pl/ksef-faktura-uproszczona-paragon-do-450/) |
| Warsztat musi mieć kasę online od pierwszej sprzedaży osobie prywatnej, także przy wymianie opon i sprzedaży części | Potwierdzone. Podstawa: rozporządzenie MF w sprawie zwolnień z obowiązku stosowania kas (§ 4, wyłączenie ze zwolnień); kasy online dla napraw pojazdów od 1.01.2020 | [Solidna Księgowa](https://solidnaksiegowa.com/kasa-fiskalna-w-warsztacie-samochodowym-obowiazki-mechanika/), [Poradnik Przedsiębiorcy](https://poradnikprzedsiebiorcy.pl/-kasa-fiskalna-dla-mechanika) |
| Kasa wirtualna niedostępna dla warsztatów | Potwierdzone. Nowelizacja od 1.04.2026 (Dz.U. 2025 poz. 1345) objęła tylko automaty, urządzenia samoobsługowe i e-parkingi | [Infor](https://mojafirma.infor.pl/wiadomosci/7453598,koniec-z-pudelkiem-na-biurku-jak-oprogramowanie-zastepuje-kasy-fiskalne-pelna-lista-branz-po-nowelizacji.html) |
| Marketing SMS-em i e-mailem wymaga uprzedniej zgody (art. 398 PKE), także wobec firm, osobno dla każdego kanału. Prezes UKE może nałożyć karę do 3% przychodu | Potwierdzone | [Prawo.pl](https://www.prawo.pl/biznes/zgody-marketingowe-i-kontakty-handlowe-co-mowi-prawo-komunikacji-elektronicznej,530981.html) |
| API CEPiK udostępnia dane pojazdów zarejestrowanych w Polsce (ponad 60 parametrów, m.in. marka, model, rok produkcji) bezpłatnie, także do celów komercyjnych, z obowiązkiem podania źródła; limit 100 zapytań na minutę (sprawdzone przy D1) | Potwierdzone | [gov.pl](https://www.gov.pl/web/cepik/api-dla-centralnej-ewidencji-pojazdow-i-kierowcow-api-do-cepik), [cepik.gov.pl](http://www.cepik.gov.pl/interfejs-dla-cepik) |
| Kod Aztec w dowodzie rejestracyjnym zawiera dane techniczne pojazdu i numer rejestracyjny, bez danych osobowych właściciela; dane są skompresowane, nie zaszyfrowane, a specyfikacja nie jest publiczna – licencję na dekoder daje PWPW (sprawdzone przy D1) | Potwierdzone | [Zaufana Trzecia Strona](https://zaufanatrzeciastrona.pl/post/historia-o-dowodach-rejestracyjnych-dekoderze-aztec-i-pewnym-monopolu/) |

**Co z tego wynika dla OXY:** od 1.01.2027 faktury dla firm, także wystawiane przy kasie (dziś często jako paragon z NIP), trzeba wystawiać w KSeF. Pierwsze warsztaty zaczną korzystać z OXY najpewniej już po tej dacie, więc faktury z KSeF muszą działać w pierwszej wersji, a nie dopiero w kolejnych.

---

## 3. Do oceny przez prawnika i doradcę podatkowego

Tych spraw nie rozstrzygnie research. Najlepiej zebrać je w jedną konsultację przed zamrożeniem SRS.

**Prawnik**
- Czy zaproszenie SMS do OXY i przypomnienia serwisowe to informacja handlowa (wymaga zgody z art. 398 PKE) i kto zbiera tę zgodę: warsztat czy OXY.
- Czy akceptacja prac dodatkowych w aplikacji to umowa zawarta na odległość (14 dni na odstąpienie) i jak ma brzmieć oświadczenie z art. 38 ustawy o prawach konsumenta.
- Role RODO: OXY jako podmiot przetwarzający dla warsztatu i jako samodzielny administrator w hubie klienta. Do tego wzory regulaminu, umowy powierzenia i polityki prywatności.
- Czy aplikacje mobilne OXY podlegają Cyber Resilience Act (obowiązek zgłaszania podatności od 11.09.2026) i przepisom o dostępności (EAA).
- Jak długo przechowywać dowody akceptacji i protokoły (przedawnienie roszczeń).
- Model płatności online bez licencji (dopiero przed v2).

**Doradca podatkowy**
- Fakturowanie abonamentu OXY w KSeF przy rozliczeniach przez Stripe.
- Wysyłanie e-paragonów do aplikacji klienta.
- Kasa w serwisach rowerowych (przy rozszerzeniu o rowery).

---

## 4. Decyzje do podjęcia

Do rozpoczęcia SRS potrzebne są decyzje **D1–D7**. Pozostałe mogą poczekać do fazy projektowania lub pilotażu.

### Blokujące specyfikację wymagań

#### D1. Typy pojazdów w pierwszej wersji
- **Opcje:** (a) auta osobowe i dostawcze oraz motocykle; (b) jak (a) plus rowery; (c) wszystkie typy od razu.
- **Rekomendacja: (a).** To największy rynek z gotowymi ułatwieniami (kod z dowodu rejestracyjnego, VIN). Model danych od początku traktuje pojazd jako ogólny „obiekt serwisowy” z typem, więc rowery mogą wejść już w v1.1 bez przebudowy. Maszyny rolnicze i wózki widłowe (motogodziny, dozór UDT) później.
- **Twoja decyzja (26.09.2026): szerzej niż rekomendacja.** W pierwszej wersji: auta, maszyny rolnicze, maszyny budowlane (podnośniki, koparki) i wózki widłowe. Do tego baza pojazdów, dzięki której formularz wypełnia się szybko (marki, modele, generacje, roczniki), oraz schematy części nadwozia i instalacji elektrycznej.
  - **Skutki:** model danych już obsługuje te typy (motogodziny, numer fabryczny). W planie prac doszedł etap K: katalog marek i modeli z otwartych danych CEPiK, generacje aut, własny katalog maszyn, skan kodu Aztec z dowodu rejestracyjnego, dozór UDT, własne schematy do oznaczania uszkodzeń i dokumentacja techniczna warsztatu.
  - **Ograniczenie prawne:** schematów elektrycznych i szczegółowych rysunków części producentów nie możemy narysować na podstawie cudzych materiałów ani skopiować – to utwory chronione, udostępniane na licencji (np. HaynesPro, TecAlliance). Cudze katalogi pojazdów chroni z kolei prawo do baz danych. Co kupić, rozstrzygnie D14.

#### D2. Zakres pierwszej wersji
- **Opcje:** (a) pełne v1 z raportu (12 modułów); (b) podział na v1.0 i v1.1.
- **Rekomendacja: (b).**
  - **v1.0, pilotaż w 3–5 warsztatach:**
    - konta i organizacje, w tym mechanik w kilku organizacjach i plan Solo;
    - klienci i pojazdy;
    - zlecenia → zadania → podzadania z przypisaniem do jednego lub kilku mechaników;
    - dashboard zleceń według pojazdów;
    - protokół przyjęcia pojazdu;
    - inspekcja ze zdjęciami i wideo;
    - raport częściowy z akceptacją i raport końcowy, dostępne z linku bez instalacji;
    - aplikacja mechanika: statusy, czas pracy, zgłaszanie potrzeb (części i prace), kolejka zdjęć działająca bez internetu;
    - powiadomienia e-mail, SMS i push z rejestrem zgód;
    - faktury przez jeden program z KSeF, numer paragonu wpisywany ręcznie;
    - log audytowy i podstawowe funkcje RODO.
  - **v1.1, start komercyjny:**
    - aplikacja klienta: hub, historia, przypomnienia, przekazanie historii przy sprzedaży pojazdu;
    - magazyn: stany, rezerwacje, marże;
    - pełny tryb offline;
    - integracja z drukarką fiskalną;
    - KPI;
    - subskrypcje i płatności za OXY.
  - **v2 i v3** jak w raporcie: hurtownie, płatności online, floty, rezerwacje, maszyny rolnicze i wózki widłowe.
- **Twoja decyzja (26.09.2026): (b).** Zmiana wynikająca z D1: maszyny rolnicze, budowlane i wózki widłowe przechodzą z v2 do v1.0.

#### D3. Faktury
- **Opcje:** (a) integracja z programem do faktur, który wysyła je do KSeF (warsztat ma tam konto, a OXY przekazuje dane); (b) własny moduł KSeF w OXY.
- **Rekomendacja: (a), na start z jednym programem**, wybranym po rozmowach z warsztatami (domyślnie Fakturownia). To mniej pracy i mniejsza odpowiedzialność za poprawność faktur. Własny moduł KSeF warto rozważyć w v2, przy większej skali.
- **Twoja decyzja (26.09.2026): (a)**, na start Fakturownia.

#### D4. Paragony
- **Opcje:** (a) w v1.0 numer paragonu wpisywany ręcznie przy zleceniu, integracja z drukarkami fiskalnymi w v1.1; (b) integracja od razu (1–2 producentów drukarek, lokalny program-mostek na komputerze w warsztacie).
- **Rekomendacja: (a).** Integracja z drukarkami wymaga lokalnego oprogramowania na Windowsie i testów na sprzęcie, więc nie warto blokować nią pilotażu.
- **Twoja decyzja (26.09.2026): (a).**

#### D5. Powiadomienia SMS
- **Nadawca:** (a) nazwa warsztatu, która budzi większe zaufanie klienta (każdą nazwę trzeba zgłosić i zatwierdzić w bramce SMS); (b) wspólna nazwa „OXY”.
- **Rozliczenie:** (a) mały pakiet SMS w abonamencie i dokupowanie kolejnych; (b) wszystkie SMS-y płatne osobno.
- **Rekomendacja:** nazwa warsztatu (z „OXY” jako rezerwą) oraz mały pakiet w abonamencie z możliwością dokupienia kolejnych. SMS-y tylko przy trzech zdarzeniach: przyjęcie pojazdu, prośba o akceptację i pojazd gotowy do odbioru. Pozostałe powiadomienia przez push i e-mail.
- **Twoja decyzja (26.09.2026): (a) w obu punktach.** Nadawcą jest nazwa warsztatu (rezerwowo „OXY”), w abonamencie jest mały pakiet SMS z możliwością dokupienia kolejnych. SMS-y przy trzech zdarzeniach, jak w rekomendacji.

#### D6. Historia pojazdu i widoczność wpisów
- **Co widzi nowy właściciel po przekazaniu historii:** (a) zakres prac i daty, bez cen i danych poprzedniego właściciela; (b) pełna historia z cenami; (c) nic.
- **Rekomendacja: (a).** Dodatkowo warsztat może oznaczać notatki jako wewnętrzne, niewidoczne dla klienta. Sam hub klienta to v1.1, ale ta decyzja wpływa na model danych już w v1.0.
- **Twoja decyzja (26.09.2026): (a).**

#### D7. Zdjęcia i wideo: limity i przechowywanie
- **Rekomendacja:**
  - wideo do 60 s w 720p, zdjęcia kompresowane na telefonie (ok. 1600 px);
  - zdjęcia zostają w historii pojazdu, a wideo jest przechowywane 24 miesiące, potem usuwane albo archiwizowane za dopłatą;
  - dowody akceptacji (migawka oferty i decyzja klienta) są przechowywane co najmniej do przedawnienia roszczeń; okres potwierdzi prawnik.
- **Twoja decyzja (26.09.2026): zgodnie z rekomendacją.** Zdjęcia są już pomniejszane na telefonie do 1600 px (wcześniej 2560 px).

### Mogą poczekać

| # | Decyzja | Rekomendacja | Kiedy potrzebna |
|---|---|---|---|
| D8 | Cennik | Stała opłata z 3 mechanikami w cenie i dopłatą za kolejnych; darmowy plan Solo z limitem zleceń. Raport proponuje 149–199 zł netto miesięcznie, ale polskie programy chmurowe kosztują kilkadziesiąt złotych, więc kwotę trzeba sprawdzić w rozmowach z warsztatami. Argument cenowy: abonament zwraca się, jeśli dzięki akceptacjom warsztat sprzeda miesięcznie jedną dodatkową naprawę | Przed v1.1 (pilotaż może być bezpłatny) |
| D9 | Backend: Supabase czy własny Node.js + PostgreSQL; PowerSync w chmurze czy na własnym serwerze | Decyzja po krótkim teście technicznym (proof of concept) | Faza projektowania |
| D10 | AI | Nie w v1.0. W v1.1 zamiana notatek głosowych mechanika na tekst (oszczędza czas, niskie ryzyko prawne) | Przed v1.1 |
| D11 | Płatności online | W v2; najprostszy technicznie jest Stripe Connect z BLIK-iem, operatora wybierzemy później | Przed v2 |
| D12 | Pilotaż | Teraz 5–8 rozmów z warsztatami z Podlasia, jeszcze przed zamrożeniem SRS. Potem pilotaż w 3–5 warsztatach. Kryteria sukcesu, np. co najmniej połowa zleceń z cyfrową akceptacją i odsetek klientów otwierających link | Rozmowy równolegle z SRS |
| D13 | Forma prawna i nazwa | Przed inwestycją w branding sprawdzić, czy znak „OXY” nie koliduje z zarejestrowanymi znakami (bazy EUIPO i UPRP). Formę prawną ustalić przed pierwszą umową z warsztatem (regulamin, umowa powierzenia) | Przed pilotażem |
| D14 | Dane techniczne z licencji (dopisana po D1) | Na pilotaż wystarczy katalog z CEPiK, własna lista maszyn i własne schematy do oznaczania uszkodzeń. Przed v1.1 zebrać ceny i zdecydować, co kupujemy: LECTURA API (katalog maszyn budowlanych i rolniczych oraz wózków widłowych), HaynesPro albo TecAlliance (schematy elektryczne i dane serwisowe; HaynesPro obejmuje auta, motocykle i ciężarówki), PWPW (licencja dekodera kodu Aztec) | Przed v1.1; zapytania to zadanie D.7 w planie prac |

---

## 5. Następne kroki

1. ~~Twoje decyzje D1–D7~~ – podjęte 26.09.2026. Plan prac z etapami i zadaniami: [05-plan-prac.md](05-plan-prac.md).
2. **SRS 0.1** wg ISO/IEC/IEEE 29148:
   - wymagania dla ról (biuro, mechanik, klient, właściciel, administrator OXY);
   - przypadki użycia;
   - reguły biznesowe (statusy, akceptacje, zgody);
   - wymagania niefunkcjonalne (offline, bezpieczeństwo, RODO, dostępność);
   - słownik pojęć.
3. **Równolegle:** scenariusz rozmów z warsztatami i lista pytań do prawnika.
4. **Klikalny prototyp** kluczowych ekranów (przyjęcie pojazdu, akceptacja przez link, widok dnia mechanika) do pokazania warsztatom przed zamrożeniem SRS.
