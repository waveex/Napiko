# Napiko – analiza rynku, prawa, funkcji i architektury aplikacji dla warsztatów (stan: wrzesień 2026)

> **Dokument:** raport z researchu · faza 1 (analiza) · 26.09.2026
> **Weryfikacja i korekty:** zob. [02-decyzje-produktowe.md](02-decyzje-produktowe.md). Najważniejsza korekta: faktury z kas i faktury uproszczone (paragon z NIP do 450 zł) można wystawiać poza KSeF do **31.12.2026**. Daty 30.09.2026 nie potwierdza żadne źródło.

**Napiko ma realną niszę, ale nie jako kolejny program do zleceń i faktur, bo tych w Polsce jest wiele tanich lub darmowych. Nisza leży w komunikacji i akceptacjach.** Chodzi o cyfrowe przyjęcie pojazdu, raport częściowy ze zdjęciami lub wideo i zgodą klienta z pełnym dowodem, darmowy hub pojazdów dla klienta oraz mechanika pracującego w wielu organizacjach. Całość musi stać na elastycznym modelu pojazdu, który obsłuży też rowery, motocykle, maszyny rolnicze i wózki widłowe. W 2023 r. w Polsce działały 22 119 warsztaty samochodowe (dane Instytutu GiPA w analizie PETRONAS, ISBtech.pl, 02.2024). Obowiązkowy KSeF (2026/2027) i kasy online wymuszają dziś cyfryzację, co sprzyja nowemu graczowi, pod warunkiem że Napiko integruje się z hurtowniami zamiast konkurować z nimi katalogami części.

## TL;DR

- **Nisza:** polskie programy (Integra Car 7, PAS24, Warsztat24, Asystent, abcWarsztatu) dobrze pokrywają zlecenia, magazyn, faktury, CEPiK i import dokumentów z hurtowni. Brakuje im nowoczesnej komunikacji z klientem: cyfrowej inspekcji (DVI), akceptacji prac dodatkowych w aplikacji, historii pojazdu po stronie klienta i modelu „mechanik w wielu organizacjach”. Liderzy z USA kosztują od 179 USD miesięcznie (Tekmetric Start przy płatności rocznej, 199 USD przy miesięcznej, wg tekmetric.com/pricing) do 239 USD (Shopmonkey Basic przy płatności miesięcznej, wg shopmonkey.io/pricing). W Polsce jest miejsce na produkt tej klasy za ok. 99–299 zł netto miesięcznie.
- **Prawo:** najważniejsze są cztery obszary.
  - RODO: warsztat jest administratorem, Napiko podmiotem przetwarzającym, a w hubie klienta Napiko jest osobnym administratorem.
  - Prawo komunikacji elektronicznej (od 10.11.2024): osobna zgoda na marketing dla każdego kanału, kara do 3% przychodu.
  - Kodeks cywilny: art. 630 KC i forma dokumentowa zgody na rozszerzenie naprawy.
  - Fiskalizacja: kasa online od pierwszej sprzedaży konsumentowi, bez możliwości kasy wirtualnej. KSeF dla B2B obowiązuje od 1.04.2026 (mikroprzedsiębiorcy od 1.01.2027, sankcje od 2027).

  Aplikacje mobilne Napiko podlegają też Cyber Resilience Act: według Komisji Europejskiej od 11.09.2026 producenci muszą zgłaszać aktywnie wykorzystywane podatności i poważne incydenty przez platformę ENISA (ostrzeżenie w 24 h, zgłoszenie w 72 h).
- **Technologia i MVP:** jedna baza kodu Nuxt + TypeScript + Capacitor, PostgreSQL z Row Level Security (wspólna baza z tenant_id), synchronizacja offline dla mechanika (np. PowerSync), hosting w UE (OVHcloud). Płatności przez marketplace licencjonowanego operatora (Stripe Connect, Przelewy24, PayU, Tpay), więc bez własnej licencji. MVP obejmuje:
  - zlecenia z zadaniami i podzadaniami;
  - przyjęcie pojazdu, DVI i akceptacje;
  - aplikację mechanika z czasem pracy;
  - hub klienta i powiadomienia;
  - faktury przez integrację z KSeF;
  - prosty magazyn z zapotrzebowaniami.

  Integracje z hurtowniami, płatności online i rezerwacje przychodzą w kolejnych wersjach.

---

## 1. Rynek i konkurencja

### 1.1 Wielkość i struktura rynku w Polsce

| Wskaźnik | Wartość | Źródło / uwagi |
|---|---|---|
| Warsztaty samochodowe (2023) | 22 119 (bez zmian r/r, −11% w 7 lat) | Instytut GiPA w analizie PETRONAS, via ISBtech (02.2024) |
| Warsztaty niezależne wg Motointegratora | ok. 19,5 tys. | Swiatopon.info |
| Podmioty z PKD 45.20.Z | 82–221 tys., zależnie od metodologii | MotoFocus (07.2025), Swiatopon; większość nieaktywna lub poboczna |
| ASO (koniec 2022) | 1 493 | Raport Q Service Castrol via warsztat.pl |
| Warsztaty niezależne w sieciach | ok. 1/3 | Inter Cars / Q Service Castrol |
| ProfiAuto Serwis | >3 500 serwisów (2025, +16% r/r) | MOTOFAKTOR, profiauto.pl |
| Typowy warsztat niezależny | 6 osób: 4 mechaników, 1 osoba w biurze, 1 magazynier | ISBtech / PETRONAS |
| Średni wiek auta | >15 lat | Oferteo / Auto Service Manager |

**Co z tego wynika:**
- Realny rynek docelowy to 20–25 tys. aktywnych warsztatów samochodowych. Z wulkanizacjami i serwisami motocyklowymi, rowerowymi, rolniczymi i ciężarowymi jest to kilkadziesiąt tysięcy punktów.
- Typowy klient Napiko ma 3–6 mechaników i jedną osobę w biurze. Potrzebuje więc prostego interfejsu i ceny rzędu jednej roboczogodziny miesięcznie.
- Cyfryzacja postępuje nierówno: inwestują duże serwisy miejskie, a właściciele starszych aut wolą kontakt osobisty (MOTOFAKTOR, 2025). Aplikacja klienta musi więc działać także z linku w SMS, bez instalacji.

**UE:** według raportu Q Service Castrol (za Wolk) w 2022 r. do sieci serwisowych w Europie należało 75 tys. warsztatów, o 30% więcej niż w 2012. W Norwegii w sieciach jest 88% serwisów, w Niemczech, Francji, Włoszech i Szwecji ponad połowa. Całkowitej liczby warsztatów w UE nie zweryfikowano; przed biznesplanem ekspansji trzeba ją potwierdzić (Wolk, CLEPA).

### 1.2 Polscy konkurenci

| Produkt | Model / cena | Mocne strony | Luki |
|---|---|---|---|
| **Integra Car 7** (Integra Software, dystrybucja m.in. Inter Cars) | Licencja modułowa, „od kilku do nawet kilkunastu tysięcy złotych”, bez opłaty za każdego mechanika | Kosztorysy z normami czasowymi, dane TecRMI, aplikacje APP (przyjęcie) i PDS (mechanik), eksport do Optimy, Symfonii i Rewizora; obsługuje też ciężarowe, rolnicze i budowlane | Desktop z lokalną bazą; recenzje wskazują na „nieintuicyjność” |
| **PAS24** (ProfiAuto) | Cena niepublikowana, 20% rabatu dla sieci | Terminarz per stanowisko, historia ze zdjęciami, odczyt kodu AZTEC z dowodu rejestracyjnego, przechowalnia opon, SMS | Zamknięty w ekosystemie jednej hurtowni |
| **Warsztat24** | Licencja wieczysta na wersję, ok. 229 zł w promocji | Nielimitowani użytkownicy, KSeF, import z Inter Cars (nowe API) i ProfiAuto | Interfejs tekstowy, Windows |
| **Asystent (Chmura) Warsztat** (Meteoryt) | Desktop lub chmura | CEPiK, kod QR z dowodu rejestracyjnego, KSeF, JPK, logi użytkowników | Klasyczny interfejs, brak komunikacji z klientem |
| **SerwisGT PRO** (AcomNEX) | 1 590 / 2 099 zł | Przechowalnia opon, moduł płacowy | Desktop |
| **abcWarsztatu** (Binsoft) | Darmowy | Zlecenia, pojazdy, KSeF | Ograniczenia wersji darmowej |
| **mpWarsztat** | Test za darmo | macOS i Windows, chmura, aplikacja w App Store | Niszowy |

**Wniosek:** rynek to głównie desktop na Windows, licencje jednorazowe i silne powiązanie z hurtowniami (Inter Cars z Integrą, Moto-Profil z PAS24). Porównanie autozeszyt.pl (2026) wskazuje, że dla ok. 90% małych warsztatów liczą się: karta auta z historią, czytelny PDF dla klienta, działanie na telefonie, kopie zapasowe i prosta cena. Magazyn i integracje z hurtowniami rzadko decydują o wyborze. MVP Napiko powinno więc skupić się na procesie i komunikacji, a nie na ERP.

### 1.3 Benchmark zagraniczny

| System | Cena (od) | Wyróżniki |
|---|---|---|
| **Tekmetric** | Start: 199 USD/mies. przy płatności miesięcznej, 179 USD/mies. przy rocznej; Grow 349/309 USD, Scale 439/409 USD (tekmetric.com/pricing); rozbieżność 179 vs 199 USD między źródłami wynika z okresu rozliczeniowego | Nielimitowani użytkownicy, DVI, płatności Text-to-Pay, zamówienia części przez PartsTech i Nexpart, rozbudowane raporty |
| **Shopmonkey** | Basic: 239 USD/mies. przy płatności miesięcznej lub 215 USD/mies. przy rocznej, 3 licencje użytkowników w cenie, każda kolejna +20 USD/mies.; Clever 399/359 USD, Genius 499/449 USD (shopmonkey.io/pricing, 07.2026) | Workflow front-desk, szybki onboarding; w Basic tylko 2 szablony DVI, nielimitowane DVI od planu Clever |
| **AutoLeap** | 179–199 USD/mies. + opłata wdrożeniowa | CRM, marketing |
| **Fullbay** | Wycena indywidualna | Serwisy ciężarowe i floty |
| Shop-Ware, Mitchell 1, Garage Hive, TechMan, AutoVitals, Autoflow, CMMS (np. Fleetio), oprogramowanie serwisów rowerowych, marketplace’y (Motointegrator, Oponeo, ClickMechanic, Fixico, Autobutler) | Zwykle wycena indywidualna lub prowizje | DVI, dane techniczne, harmonogramy według liczników, rezerwacje online |

Dane w ostatnim wierszu opierają się na wiedzy ogólnej i nie zostały zweryfikowane w tym badaniu.

### 1.4 Dane o DVI

- AutoVitals: inspekcje z 20 lub więcej zdjęciami dają średnią wartość zlecenia (ARO) wyższą o 30,4% niż inspekcje z 5 lub mniej zdjęciami.
- Raport Detect Auto (2026, dane AutoVitals, Tekmetric i Detect Auto): dobre praktyki inspekcji wiążą się ze wzrostem ARO o 27–28%.
- Tekmetric zaleca 6–8 zdjęć przy rutynowych pracach.

**Ocena:** to marketingowe dane dostawców z USA. Kierunek jest spójny, ale skali nie należy przenosić wprost na Polskę. Warto zmierzyć to w pilotażu jako KPI: odsetek zaakceptowanych prac dodatkowych.

### 1.5 Macierz funkcji

| Funkcja | PL desktop | PAS24 | Liderzy USA | DVI (AutoVitals) | **Napiko** |
|---|---|---|---|---|---|
| Zlecenia, kosztorys, historia | ✔ | ✔ | ✔ | częściowo | Standard |
| Faktury, KSeF, kasa | ✔ | ✔ | n/d | – | Przez integracje |
| Magazyn, zamówienia części | ✔ | ✔ (1 hurtownia) | ✔ (wielu dostawców) | – | v1 prosty, v2 wielu dostawców |
| DVI ze zdjęciami i wideo | słabo | zdjęcia | ✔ | ✔✔ | **Wyróżnik** |
| Zdalna akceptacja pozycji (częściowa, odrzucenie, „na później”) | ✗ | ✗ | ✔ | ✔ | **Rdzeń Napiko** |
| Hub klienta z historią z wielu warsztatów | ✗ | ✗ | portal warsztatu | link | **Nisza** |
| Mechanik w wielu organizacjach lub samodzielny | ✗ | ✗ | ✗ | ✗ | **Nisza unikalna** |
| Wiele typów pojazdów | częściowo | ✗ | głównie auta | auta | **Nisza** |
| Tryb offline mechanika | n/d | ? | częściowo | ? | Wyróżnik |

---

## 2. Typy pojazdów i model danych

### 2.1 Taksonomia

| Kategoria | Identyfikatory | Licznik | Przeglądy i dozór | Katalogi |
|---|---|---|---|---|
| Osobowe, dostawcze | VIN, nr rej. | km | SKP/CEPiK | TecDoc, TecRMI, Autodata, HaynesPro |
| Ciężarowe, ciągniki siodłowe, autobusy | VIN, nr rej. | km, motogodziny | SKP co rok, legalizacja/sprawdzenie tachografu, ADR | TecDoc CV, producenci |
| Przyczepy, naczepy, kampery | VIN, nr rej. | – / km | SKP | Producenci osi i zabudów |
| Motocykle, skutery, motorowery, quady | VIN / nr ramy, nr rej. | km | SKP (pojazdy rejestrowane) | TecDoc (częściowo), producenci |
| Rowery, e-bike | Nr ramy; nr baterii i silnika | km (e-bike) | Brak | Hurtownie rowerowe |
| Hulajnogi elektryczne / UTO | Nr seryjny | km | Brak | Producenci |
| Ciągniki i maszyny rolnicze | VIN/PIN, nr seryjny, nr rej. (ciągniki) | motogodziny | SKP dla ciągników | Producenci (AGCO, CNH itp.) |
| Wózki widłowe, sprzęt magazynowy | Nr fabryczny, nr ewidencyjny UDT | motogodziny, cykle | Dozór UDT, konserwacja przez uprawnionego konserwatora | Producenci (Linde, Jungheinrich, Toyota) |
| Maszyny budowlane | PIN / nr seryjny | motogodziny | UDT dla części urządzeń | Producenci |
| Łodzie, skutery wodne | HIN, nr silnika | motogodziny | Rejestracja zależnie od typu | Producenci silników |
| Sprzęt ogrodniczy | Nr seryjny | motogodziny / brak | Brak | Producenci |

**Do weryfikacji:** częstotliwości SKP, tachografów i UDT podano według wiedzy ogólnej. Przed specyfikacją reguł przypomnień trzeba je potwierdzić w aktach prawnych. Planowana jest reforma SKP, dlatego terminy powinny być konfigurowalnymi regułami, a nie wartościami zapisanymi na sztywno.

### 2.2 Elastyczny model danych

Kluczowa decyzja: pojazd to w systemie ogólny **obiekt serwisowy (Asset)** z polem `asset_type`.
- **Pola wspólne:** marka, model, rok, lista identyfikatorów (typ + wartość), odczyty liczników z datą.
- **Pola specyficzne dla typu** (np. nr UDT, nr baterii e-bike) trafiają do JSONB walidowanego schematem JSON Schema przypisanym do typu. Dodanie łodzi czy kosiarki nie wymaga wtedy migracji bazy.
- **Hierarchia:** klient → powiązanie z obiektem → zlecenie (WorkOrder) → drzewo zadań (Job z `parent_id`) → przypisania do 1..n mechaników → pozycje (robocizna, część, usługa obca), ustalenia z inspekcji (Finding) i wpisy czasu pracy. Pełna lista encji jest w sekcji 9.2.

### 2.3 Segment na start

Rekomendacja: start od **niezależnych warsztatów samochodowych (osobowe i dostawcze) z 1–8 mechanikami**. To największy rynek, z dostępnymi integracjami (kod z dowodu rejestracyjnego, API Inter Cars i Auto Partner, TecDoc) i wyraźnym problemem: akceptacje prac dodatkowych załatwiane telefonicznie.
- **Motocykle** można dodać niemal od razu, bo mają te same identyfikatory.
- **Serwisy rowerowe** to dobry drugi segment: słabo scyfryzowane, bez CEPiK. Ich liczby w Polsce nie zweryfikowano.
- **Maszyny rolnicze** pasują do Podlasia, ale wymagają motogodzin i pracy w terenie.
- **Wózki widłowe** (UDT) są bliższe CMMS i nadają się na v3.

---

## 3. Funkcje i procesy

### 3.1 Cykl zlecenia

1. **Rezerwacja** – telefonicznie lub przez biuro w v1, online od v2.
2. **Przyjęcie** – skan kodu z dowodu rejestracyjnego lub VIN, licznik, paliwo lub bateria, uszkodzenia zaznaczone na schemacie, zdjęcia, rzeczy pozostawione w pojeździe, zakres prac, sposób wyceny (kosztorys lub ryczałt), limit prac bez pytania, zgody komunikacyjne, podpis na tablecie. Klient dostaje protokół w PDF.
3. **Diagnoza i DVI** – checklisty dla danego typu pojazdu, oceny OK / uwaga / pilne, zdjęcia, wideo, notatki głosowe.
4. **Raport częściowy (ApprovalRequest)** – pozycje z cenami brutto i mediami. Klient w aplikacji lub przez link akceptuje, odrzuca albo wybiera „przypomnij później” (z datą lub przebiegiem). Każda decyzja trafia do logu audytowego.
5. **Realizacja** – zadania i podzadania, start/stop czasu, zapotrzebowania na części.
6. **Kontrola jakości** – checklista, jazda próbna, zdjęcia „po”.
7. **Raport końcowy** – wykonane prace, części, zalecenia.
8. **Wydanie i płatność** – protokół wydania, paragon z kasy online lub faktura (KSeF dla B2B).
9. **Historia i przypomnienia** – odrzucone pozycje, przegląd, SKP, OC, sezon opon.

**Scenariusz z klockami hamulcowymi:**
- Mechanik zakłada Finding „klocki tył – 2 mm” ze zdjęciem oraz PartRequest.
- Biuro wycenia pozycję i wysyła ApprovalRequest; zlecenie ma status „czeka na klienta”.
- Jeśli klient akceptuje: dodawane jest zadanie „klocki tył”, a części są rezerwowane lub zamawiane.
- Jeśli klient odrzuca: pozycja trafia do „odrzucone – przypomnij”, a mechanik kończy tylko przód.

### 3.2 Panel administracji

| Obszar | Must-have (v1) | Nice-to-have (v2+) |
|---|---|---|
| Dashboard | Kanban zleceń per pojazd, filtry „czeka na klienta” i „czeka na części” | Widok stanowisk |
| Planowanie | Przydział przez biuro, samoprzydział lub tryb mieszany (polityka organizacji) | Automatyczny harmonogram według kompetencji |
| Czas pracy | Start/stop per zadanie, czas normatywny vs rzeczywisty | Akord, prowizje |
| Części i magazyn | Zapotrzebowania, rezerwacja pod zlecenie, stany, stany minimalne, marże | API hurtowni, inwentaryzacja, zwroty, depozyt opon |
| Dokumenty | Faktura przez integrację (KSeF), paragon przez kasę | Własny moduł KSeF |
| Flota B2B | Firma z wieloma pojazdami i osobą akceptującą | Limity, zbiorcze rozliczenia, auta zastępcze, szkody |
| KPI | ARO, odsetek akceptacji, wykorzystanie mechaników | Rentowność zleceń |
| Role | Właściciel, biuro, mechanik, magazynier (RBAC) | Wiele lokalizacji |

### 3.3 Aplikacja mechanika

- Widok dnia: moje zadania, licznik czasu, statusy (w toku, pauza, czeka na części, czeka na klienta, gotowe do kontroli jakości).
- Obsługa brudnymi rękami lub w rękawicach: przyciski min. 48–56 px, wysoki kontrast, obsługa jedną ręką, notatki głosowe zamiast pisania, skan kodów części i kodu QR zlecenia przyklejonego na aucie.
- Zdjęcia i wideo kompresowane na urządzeniu, z kolejką wysyłki działającą offline.
- Zgłoszenia potrzeb (części i prace) trafiają do biura, nie do klienta. Biuro zachowuje kontrolę nad cenami.
- Wiele organizacji obsługuje przełącznik kontekstu. Samodzielny mechanik to jednoosobowa mikroorganizacja.
- Offline: lokalna baza SQLite z synchronizacją. Konflikty rozwiązuje reguła „ostatni zapis wygrywa per pole”, a zmiany statusów waliduje serwer.

### 3.4 Aplikacja klienta (hub)

- Pojazdy, historia udostępniona przez warsztaty, dokumenty, akceptacje oraz czat bez ujawniania prywatnych numerów.
- Przypomnienia: SKP, OC (datę wpisuje klient), opony, odrzucone pozycje.
- **Przekazanie historii przy sprzedaży:** kod przekazania; nowy właściciel dostaje historię techniczną bez danych poprzedniego właściciela.
- Wiele warsztatów na jednym koncie.
- Rejestracja z zaproszenia albo samodzielna. **Każdy raport i akceptacja działają też przez bezpieczny link** (krótki czas ważności, kod OTP), bo wielu klientów nie zainstaluje aplikacji.
- **Wyszukiwarka warsztatów i rezerwacje** dopiero w v3, po zdobyciu masy krytycznej w regionie. Wcześniej katalog byłby pusty, a dodatkowo pociąga obowiązki z DSA, P2B i dyrektywy Omnibus.

### 3.5 Powiadomienia i koszty SMS

| Zdarzenie | Kanał | Charakter |
|---|---|---|
| Przyjęcie + protokół, prośba o akceptację, pojazd gotowy, dokument | SMS z linkiem, push, e-mail | Transakcyjne (wykonanie umowy) |
| Przypomnienie o odrzuconej pozycji lub przeglądzie | Push, e-mail | Graniczne; bezpieczniej za zgodą |
| Promocje warsztatu | SMS, e-mail | Marketing; zgoda z art. 398 PKE osobno dla każdego kanału |

**Ceny SMS** (netto za SMS krajowy; cenniki odczytane 12.08.2026 w zestawieniu ACTIO, czyli konkurenta tych bramek):
- SMSAPI: prepaid 0,17–0,11 zł; postpaid 0,14–0,08 zł przy abonamencie 49 zł.
- SerwerSMS: 0,19–0,10 zł przy abonamencie 49–299 zł.
- SMSPlanet: postpaid 6–10 gr.

**Szacunek:** 8 SMS na zlecenie przy 300 zleceniach miesięcznie to ok. 2 400 SMS, czyli ok. 200–350 zł na warsztat miesięcznie. Domyślnym kanałem powinien więc być push, a SMS-y sprzedawane w pakietach. WhatsApp Business API to opcja na v2 (opłaty za konwersację, szablony zatwierdzane przez Meta).

---

## 4. Prawo (Polska szczegółowo + UE)

### 4.1 Checklista prawna

| Obszar | Podstawa | Czego dotyczy w Napiko | Status 09.2026 |
|---|---|---|---|
| Dane osobowe | RODO; ustawa o ochronie danych osobowych (2018) | Role, umowa powierzenia (art. 28), DPIA, hosting w UE | Obowiązuje |
| VIN i nr rej. jako dane osobowe | TSUE C-319/22 (9.11.2023) | VIN jest daną osobową dla podmiotu, który może go powiązać z osobą | Orzecznictwo |
| Marketing elektroniczny | PKE art. 398 (od 10.11.2024), kary z art. 446 ust. 5 | Zgoda dla każdego kanału, także B2B; kara do 3% przychodu lub 1 mln zł | Obowiązuje |
| Usługi elektroniczne, cookies | UŚUDE (art. 10 uchylony na rzecz PKE); PKE art. 399 | Regulamin, baner zgód | Obowiązuje |
| Nadużycia SMS | Ustawa z 28.07.2023 (od 25.09.2023) | Blokowanie smishingu, zastrzeżone nadpisy podmiotów publicznych (CSIRT NASK), wykaz integratorów SMS dla podmiotów publicznych (UKE) | Obowiązuje; nie znaleziono obowiązku rejestracji nadpisów dla firm prywatnych |
| Umowa naprawy | KC art. 627 i nast., 629–632, 630, 77², 461, 638 | Akceptacje, protokoły, dowody | Obowiązuje |
| Konsument | Ustawa o prawach konsumenta | Zdalne rozszerzenie naprawy, odstąpienie, art. 38 | Obowiązuje; **do oceny prawnika** |
| KSeF | Ustawa o VAT (nowelizacja z 5.08.2025) | Faktury B2B | 1.02.2026 duzi, 1.04.2026 pozostali, 1.01.2027 mikro; sankcje od 1.01.2027 |
| Kasy | Art. 111 ustawy o VAT; rozporządzenie o zwolnieniach § 4 pkt 2 lit. c; rozporządzenie o kasach (Dz.U. 2025 poz. 861) | Kasa online obowiązkowa; kasa wirtualna niedozwolona | Obowiązuje |
| Split payment | Art. 108a ustawy o VAT, załącznik 15 | Części do pojazdów; faktury ≥15 tys. zł | Obowiązuje |
| Usługi płatnicze | Ustawa o usługach płatniczych (PSD2) | Marketplace u licencjonowanego operatora | Obowiązuje; w toku PSD3/PSR |
| Dostępność | Ustawa z 26.04.2024 (EAA), od 28.06.2025 | E-commerce B2C; mikroprzedsiębiorcy wyłączeni w zakresie usług | Obowiązuje |
| Cyberbezpieczeństwo | CRA 2024/2847 | Aplikacje mobilne Napiko | Art. 14 od 11.09.2026; całość od 11.12.2027 |
| Dane z pojazdów | Data Act 2023/2854 | Dostęp do danych pojazdu na żądanie użytkownika | Od 12.09.2025 |
| AI | AI Act 2024/1689 | Transkrypcja, sugestie; niskie ryzyko | Etapowo 2025–2027; trwa dyskusja o przesunięciach |
| Platformy | DSA, P2B, Omnibus | Tylko katalog warsztatów i opinie | v3 |
| Informacja techniczna | Rozporządzenie 2018/858 art. 61; MVBER przedłużone do 31.05.2028; SERMI | Dostęp niezależnych warsztatów do RMI | Obowiązuje |
| Odpady, dozór | Ustawa o odpadach (BDO); ustawa o dozorze technicznym (UDT) | Funkcje dla v3 | Obowiązuje |

### 4.2 RODO – model ról

- **Warsztat jest administratorem** danych swoich klientów. Podstawy: art. 6 ust. 1 lit. b (umowa), lit. c (obowiązki podatkowe), lit. f (dowody i roszczenia). **Napiko jest podmiotem przetwarzającym** na podstawie umowy powierzenia (DPA) w regulaminie B2B, z listą podprzetwarzających (hosting, SMS, e-mail, push).
- **Napiko jest samodzielnym administratorem** konta w hubie. Podstawą jest umowa o świadczenie usługi drogą elektroniczną.
- **Ryzyko współadministrowania (art. 26)** pojawia się, gdy Napiko sam ustala cele przetwarzania danych warsztatów, np. przez globalny rejestr VIN czy analitykę rynkową. Rekomendacja: łączyć obiekt między warsztatami **tylko z inicjatywy klienta** (to klient przypina pojazd do warsztatu). Warsztat nie widzi historii z innych warsztatów bez decyzji klienta.
- **Retencja a prawo do usunięcia:** dokumentację podatkową przechowuje się do przedawnienia zobowiązania podatkowego (co do zasady 5 lat od końca roku, w którym upłynął termin płatności podatku). Usunięcie konta w hubie nie usuwa danych w części systemu należącej do warsztatu; trzeba to wyjaśnić w klauzuli informacyjnej.
- **Zdjęcia i wideo:** tablice rejestracyjne i VIN to dane osobowe. Wizerunki osób należy minimalizować (instrukcja dla mechaników; rozmywanie twarzy w v2). Hosting w UE, szyfrowanie, logi dostępu. DPIA warto zrobić wcześnie.

### 4.3 Zaproszenie SMS do Napiko – zgoda krok po kroku

1. **Czyja to komunikacja:** SMS z linkiem do statusu zlecenia to komunikacja transakcyjna warsztatu (Napiko działa jako procesor). **Zaproszenie do założenia konta w Napiko** można jednak uznać za informację handlową Napiko, która wymaga zgody z art. 398 PKE na kanał SMS.
2. **Przebieg:** w protokole przyjęcia na tablecie osobny, domyślnie niezaznaczony checkbox: *„Chcę otrzymywać SMS-em informacje o moim zleceniu oraz zaproszenie do bezpłatnej aplikacji Napiko na numer …”*. Osobno zgoda na e-mail i osobno na marketing warsztatu. Klauzula z art. 13 RODO wskazuje warsztat i Napiko.
3. **Dowód zgody (ConsentRecord):** treść i wersja klauzuli, kanał, numer, znacznik czasu, pracownik i urządzenie, kliknięcie klienta (nie pracownika), potem SMS potwierdzający z linkiem do wycofania zgody (double opt-in).
4. **Treść zaproszenia:** neutralna, bez promocji, z identyfikacją nadawcy i opcją STOP.
5. **Do prawnika:** czy zaproszenie i przypomnienia serwisowe to komunikacja transakcyjna czy handlowa, oraz kto zbiera zgodę na komunikację Napiko po założeniu konta.

### 4.4 Prawo cywilne i konsumenckie – rozszerzenie naprawy

- **Umowa o dzieło (art. 627 KC):** wynagrodzenie kosztorysowe (art. 629–631) albo ryczałtowe (art. 632).
- **Art. 630 KC:** jeśli trzeba znacznie podwyższyć kosztorys z powodu prac, których nie dało się przewidzieć, wykonawca **musi uprzedzić zamawiającego**. Inaczej traci roszczenie o podwyższenie, a zamawiający może odstąpić od umowy, płacąc odpowiednią część wynagrodzenia. ApprovalRequest to więc **mechanizm zgodności z prawem**, nie tylko funkcja sprzedażowa.
- **Forma:** KC nie wymaga formy szczególnej. Na potrzeby dowodu wystarcza **forma dokumentowa (art. 77² KC)**, np. kliknięcie w aplikacji lub odpowiedź SMS, o ile da się ustalić osobę. Trzeba zapisać:
  - migawkę oferty (pozycje, ceny brutto, zdjęcia, hash);
  - tożsamość klienta (konto albo link z kodem OTP);
  - czas, IP i urządzenie;
  - decyzję dla każdej pozycji;
  - potwierdzenie wysłane klientowi.

  Zgodę telefoniczną biuro zapisuje z notatką i potwierdza SMS-em. Limit kwotowy w protokole przyjęcia („prace dodatkowe do 300 zł bez pytania”) ogranicza liczbę pytań do klienta.
- **Ustawa o prawach konsumenta (do weryfikacji):**
  - Rozszerzenie uzgodnione wyłącznie zdalnie można potraktować jako umowę zawartą na odległość. Wtedy obowiązują informacje z art. 12 i 14-dniowe prawo odstąpienia.
  - Art. 38 wyłącza to prawo dla usług w pełni wykonanych za wyraźną zgodą konsumenta, poinformowanego wcześniej o utracie prawa odstąpienia.
  - Rekomendacja: dodać takie oświadczenie na ekranie akceptacji albo zapisać w protokole przyjęcia, że prace dodatkowe są zmianą umowy zawartej w lokalu.
- **Rękojmia:** art. 638 KC odsyła do przepisów o sprzedaży; wobec konsumentów część zasad od 1.01.2023 jest w ustawie o prawach konsumenta. Do tego dobrowolna gwarancja warsztatu (pole „gwarancja do” przy każdej pozycji).
- **Odpowiedzialność za pojazd:** warsztat odpowiada za powierzoną rzecz; protokół przyjęcia ze zdjęciami chroni przed sporami o nowe uszkodzenia. **Art. 461 KC** daje prawo zatrzymania pojazdu do zapłaty (w Napiko status „wstrzymane wydanie”).

### 4.5 Podatki i fiskalizacja

- **KSeF:**
  - Terminy: od 1.02.2026 podatnicy ze sprzedażą >200 mln zł, od 1.04.2026 pozostali.
  - Mikroprzedsiębiorcy mogą do 31.12.2026 wystawiać faktury poza KSeF, dopóki ich wartość nie przekroczy 10 000 zł brutto w miesiącu. Przekroczenie jest trwałe: od faktury, która przekracza limit, wszystko idzie przez KSeF.
  - Od 1.01.2027 obowiązują sankcje (do 100% VAT z faktury) i numer KSeF w przelewach.
  - Schemat FA(3); tryby offline24, offline przy niedostępności i awaryjny. Faktury dla konsumentów (B2C) nie są objęte obowiązkiem.
  - **Konflikt źródeł:** część serwisów podaje, że wyłączenie dla faktur do 450 zł i faktur z kas trwa do 30.09.2026, inne że do końca 2026. Trzeba to potwierdzić u doradcy.
    *Aktualizacja 26.09.2026: rozstrzygnięte – do 31.12.2026 (art. 145n ust. 1 pkt 1 ustawy o VAT); zob. 02-decyzje-produktowe.md.*
- **Konsekwencja:** Napiko musi (a) łączyć się z API KSeF przez token lub certyfikat warsztatu albo (b) zlecać fakturę programowi księgowemu (Fakturownia, inFakt, wFirma, iFirma). **Dla MVP rekomendacja: wariant (b).**
- **Kasy:** naprawa pojazdów silnikowych i motorowerów, w tym opon, jest wyłączona ze zwolnień (§ 4 pkt 2 lit. c). Kasa online jest obowiązkowa od pierwszej sprzedaży osobie prywatnej lub rolnikowi ryczałtowemu, bez limitu 20 tys. zł. **Kasa wirtualna jest dla warsztatów niedostępna:** katalog branż jest zamknięty, a rozszerzenie od 1.04.2026 objęło tylko vending, urządzenia samoobsługowe i e-parking. Napiko nie może więc być kasą; musi współpracować z kasą lub drukarką fiskalną warsztatu.
- **Serwis rowerowy** nie naprawia pojazdów silnikowych, więc może korzystać z ogólnego limitu zwolnienia (do weryfikacji).
- **E-paragony:** kasa online może wydać paragon elektroniczny za zgodą nabywcy. Przesłanie go do aplikacji Napiko wymaga integracji z producentem kasy (do weryfikacji). Fakturę do paragonu dla firmy można wystawić tylko wtedy, gdy paragon ma NIP, więc Napiko powinno pytać o NIP przed paragonem.
- **MPP:** części samochodowe są w załączniku 15. Na fakturze ≥15 000 zł brutto dla podatnika musi być adnotacja „mechanizm podzielonej płatności”.
- **Abonament Napiko:** faktury Napiko dla warsztatów to faktury B2B, które muszą przejść przez KSeF. Faktura ze Stripe nie jest fakturą KSeF, dlatego potrzebny jest pipeline: Stripe → webhook → API Fakturowni lub inFaktu → KSeF.

### 4.6 Płatności

- **Nie potrzeba własnej licencji (MIP/KIP), jeśli pieniądze klientów nigdy nie trafiają na rachunek Napiko.** Każdy warsztat przechodzi KYC i ma swoje konto u licencjonowanego operatora.
- Wyjątek agenta handlowego jest w praktyce UE interpretowany wąsko, a projekt PSR ma go jeszcze zawęzić.
- Za świadczenie usług płatniczych bez zezwolenia (art. 150 ust. 1 UUP) grozi grzywna do 5 mln zł, do 2 lat pozbawienia wolności albo obie kary łącznie (Legal Geek, 05.2026). Numer przepisu o wyłączeniu agenta (art. 6 pkt 2 czy pkt 11 UUP) trzeba sprawdzić.
- BLIK działa w trybie split/marketplace u wszystkich sprawdzonych operatorów.

| Operator | Model | Karty w marketplace | Opłaty (publiczne) | Uwagi |
|---|---|---|---|---|
| **Stripe Connect** | Konta połączone, KYC po stronie Stripe; BLIK w PLN (funkcja `blik_payments` na koncie platformy i warsztatu) | ✔ | Wariant „Stripe handles pricing”: brak opłat dla platformy; wariant „You handle pricing”: opłata za aktywne konto + 0,25% + stała od wypłaty (kwot w PLN nie potwierdzono) | P24 przez Stripe ma listę zakazanych kodów MCC; kod napraw aut (7538) do weryfikacji |
| **Przelewy24 Marketplace** | Konto techniczne + konta sprzedawców; weryfikacja przelewem 1,50 zł i dowodem osobistym | do potwierdzenia | Prowizje „ustalane indywidualnie” | Krajowa instytucja płatnicza pod nadzorem KNF |
| **PayU Marketplace** | Subkonta w PayU, weryfikacja AML | do potwierdzenia | Negocjowane | Model Payment Facilitator nie pasuje do SaaS bez licencji |
| **Tpay Marketplace** | Podział płatności na sprzedawców, Partner Panel | **niewymienione** (instrukcja 05.2025) | Cennik 2026: Starter 0 zł/mies., 1,59% + 0,39 zł; Business 99 zł/mies., 0,99% | Stawki standardowe; marketplace może mieć inne |
| **Adyen for Platforms** | Hostowany KYC, split przy autoryzacji | ✔ | Opłata stała + opłata za metodę; minimum ok. 1 000 EUR/mies. (niezweryfikowane) | Za duży na start |

**Rekomendacja:** płatności online w aplikacji dopiero w v2. W v1 wystarczy terminal w warsztacie i link do płatności z konta warsztatu. Na v2 technicznie najprostszy jest Stripe Connect (BLIK i karty). Tpay i P24 mogą być tańsze dla BLIK, ale Tpay nie wymienia kart w trybie marketplace. **Paragon z kasy warsztatu trzeba wystawić także przy płatności online.**

### 4.7 Inne regulacje UE

- **CRA:** czysty SaaS co do zasady nie jest objęty. **Aplikacje mobilne są jednak produktami z elementami cyfrowymi.**
  - Według Komisji Europejskiej od 11.09.2026 producenci muszą zgłaszać aktywnie wykorzystywane podatności i poważne incydenty przez Single Reporting Platform ENISA: wczesne ostrzeżenie w 24 h, zgłoszenie w 72 h, a raport końcowy do 14 dni po udostępnieniu poprawki (podatność) lub w ciągu miesiąca (poważny incydent).
  - Od 11.12.2027 obowiązuje reszta wymagań (SBOM, okres wsparcia, oznakowanie CE).
  - KE opublikowała niewiążące wytyczne 27.07.2026.
  - Napiko potrzebuje procesu obsługi podatności od pierwszego wydania.
- **EAA:** mikroprzedsiębiorcy są wyłączeni z wymogów dla usług, a panel B2B nie jest usługą konsumencką. Hub z płatnościami może podlegać przepisom, gdy firma urośnie. WCAG 2.1 AA warto stosować od początku; pomaga to też przy obsłudze w rękawicach.
- **Data Act:** kierunek na v3+: przebieg i kody błędów przekazywane warsztatowi na żądanie użytkownika pojazdu.
- **AI Act:** transkrypcja i sugestie kosztorysu to niskie ryzyko. Wystarczy informować klienta, że treść wygenerowała AI.
- **Dostęp do RMI:** TSUE w C-319/22 potwierdził, że obowiązek producentów obejmuje VIN w formacie nadającym się do odczytu maszynowego, ale bez obowiązku API. Napiko wystarczą linki do portali producentów.

### 4.8 Sklepy z aplikacjami

- **Apple:** od 30.06.2022 aplikacja, w której można założyć konto, musi pozwalać je usunąć. Wymagane są etykiety prywatności i Privacy Manifest.
- **Subskrypcja B2B:** zakup wyłącznie w panelu web, bez zakupu i linków do zakupu w aplikacji, mieści się w regule 3.1.3(b) (multiplatform services), więc In-App Purchase nie jest potrzebny. DMA daje w UE dodatkowe możliwości linkowania, z opłatami Apple.
- **Google Play:** usuwanie konta w aplikacji i przez link webowy, formularz Data safety.

### 4.9 Ekspansja do UE

| Kraj | E-faktury B2B | Fiskalizacja |
|---|---|---|
| **Niemcy** | Odbiór od 1.01.2025; wystawianie od 1.01.2027 (obrót >800 tys. EUR), od 1.01.2028 wszyscy; EN 16931 (XRechnung, ZUGFeRD), bez centralnej platformy | KassenSichV / TSE |
| **Czechy** | Brak obowiązku B2B (do weryfikacji) | EET zniesiona w 2023; zapowiadane „EET 2.0” (termin niepewny) |
| **Litwa** | Raportowanie i.SAF (do weryfikacji) | Kasy fiskalne |
| **UE – ViDA** | Przyjęta 11.03.2025; e-faktury i raportowanie cyfrowe wewnątrzunijnych transakcji B2B od 1.07.2030 | – |

Marketing SMS: dyrektywa ePrivacy wymaga zgody, ale część krajów dopuszcza „soft opt-in” wobec własnych klientów. **Wniosek architektoniczny:** dokumenty sprzedaży jako interfejs z adapterami krajowymi (PL: KSeF FA(3); DE: XRechnung; pozostałe: PDF lub Peppol).

---

## 5. Integracje

| Integracja | API | Dostęp | Zakres | Wersja |
|---|---|---|---|---|
| **Inter Cars** | ✔ nowe API (docs.webapi.intercars.eu) + CSV; stary Web Service wygaszany | Umowa na API; warsztat dostaje ClientId i ClientSecret | Ceny, stany, faktury, dostawy, zamówienia | v1 import faktur, v2 pełna |
| **Auto Partner** | ✔ WebService (autopartner.pl/api) | Przez handlowca | Katalog, ceny, dostępność, zamówienia (do weryfikacji) | v2 |
| **Moto-Profil / ProfiAuto** | ✔ WS dokumentów (adres WS i numery Fiks/Motonet od partnera) | Przez partnera ProfiAuto | Import dokumentów | v2 |
| Hart, Gordon, LKQ; hurtownie rowerowe, rolnicze, wózków | nie zweryfikowano | Kontakt handlowy | – | v3 |
| TecDoc / TecAlliance, Autodata, HaynesPro | ✔ (licencje) | Wycena indywidualna (kosztów nie zweryfikowano) | Katalog, normy czasowe, dane naprawcze | v2/v3 |
| CEPiK, dekoder VIN | Publiczna „Historia pojazdu”; dostęp komercyjny ograniczony; dekodery komercyjne | Do weryfikacji | Dane techniczne | v1: kod z dowodu rejestracyjnego |
| **Fakturownia, inFakt, wFirma, iFirma** | ✔ REST, KSeF | Klucz API warsztatu | Faktury | **v1** |
| Subiekt nexo, Optima, Symfonia, enova365 | SDK, API, eksport | Lokalny agent lub eksport | Księgowość | v2 |
| **Kasy** (Posnet, Novitus, Elzab) | Protokoły producentów (LAN/USB/COM) | Lokalny **Napiko Bridge** (usługa Windows lub mini-PC) | Paragon z pozycjami zlecenia | v1 (1–2 producentów) |
| SMS (SMSAPI, SerwerSMS, JustSend, SMSPlanet, Twilio), e-mail (SES, Postmark, Brevo), push (FCM/APNs) | ✔ REST | Konta | Powiadomienia | v1 |
| Kalendarze, BDO | ✔ | OAuth / konto BDO | Terminy, odpady | v3 |

**Ryzyko:** hurtownie używają własnych programów do budowania lojalności. Dostęp do API zwykle wymaga umowy każdego warsztatu z hurtownią (tak działa np. Warsztat24). Napiko powinno mieć ekran „Połącz konto Inter Cars” i nie budować w v1 własnego katalogu części.

---

## 6. Architektura i technologia

### 6.1 Multi-tenancy

**Rekomendacja: wspólna baza PostgreSQL z `org_id` i Row Level Security.** Dla tysięcy małych najemców daje jedną migrację, tanią skalę i łatwe zapytania przekrojowe, których wymagają hub klienta i mechanik w wielu organizacjach.
- Schemat per najemca oznacza N migracji i trudny hub, więc nie jest polecany.
- Osobna baza per najemca ma sens tylko dla przyszłych dużych sieci.

Implementacja:
- `SET app.current_org` w każdej transakcji (lub claim JWT);
- polityki `org_id = current_setting(...)`;
- osobne polityki dla huba przez `AssetLink`/`ShareGrant`;
- automatyczne testy izolacji w CI.

### 6.2 Tożsamość i role

- **Jedno konto User**, do którego należą członkostwa (User × Organization × role[]) i profil klienta. Mechanik w A i B ma dwa członkostwa; właściciel mikroorganizacji ma rolę `owner`. Tak działają Slack, GitHub i Linear (przełącznik kontekstu).
- Biblioteki:
  - **Better Auth** (plugin organizations, TypeScript, pasuje do Nuxt);
  - **Zitadel** i **Logto** (natywne organizacje);
  - **Keycloak** (dojrzały, ale ciężki);
  - **Supabase Auth** (organizacje trzeba zamodelować samemu).
- RBAC uzupełniony regułami kontekstowymi, np. „samoprzydział dozwolony” czy „mechanik widzi zlecenia swojej lokalizacji”.
- **Log audytowy jako dowód:** tabela tylko do dopisywania z hashem łańcuchowym, migawka ApprovalRequest w PDF z SHA-256, aplikacja bez uprawnień UPDATE/DELETE.

### 6.3 Cross-platform

| Opcja | Mocne strony | Ograniczenia | Ocena |
|---|---|---|---|
| **Nuxt + Capacitor** | Jeden kod dla web i mobile, natywna kamera i pliki, natywne push (APNs/FCM), SQLite | Trzeba dbać o wydajność list i animacji | **Rekomendacja** |
| Ionic Vue (+ Capacitor) | Gotowe komponenty mobilne | Routing inny niż w Nuxt | Jako biblioteka UI w osobnej aplikacji mobilnej w monorepo |
| Quasar | Bardzo produktywny | Zastępuje Nuxt | Tylko w razie rezygnacji z Nuxt |
| **PWA** | Świetna dla biura na Windows (instalacja z Edge lub Chrome) i dla klienta z linku | iOS: push tylko po dodaniu do ekranu początkowego (od 16.4), brak podpowiedzi instalacji, brak background sync; od iOS 26 witryny z ekranu początkowego domyślnie otwierają się jako web app; w UE Apple wycofało się z blokady PWA 1.03.2024 | Uzupełnienie, **nie jedyna aplikacja mechanika na iOS** |
| Tauri / Electron | – | Niepotrzebne w v1 | Tylko dla Napiko Bridge |
| Flutter / React Native | Wydajność natywna | Nowy język lub ekosystem, osobny panel web | Nieopłacalne dla 1–3 osób |

**Offline:**
- **PowerSync** (Postgres → SQLite, reguły synchronizacji dla każdego użytkownika, SDK Vue, chmura lub self-host) najlepiej pasuje do Postgres z RLS.
- Alternatywy: ElectricSQL, RxDB.
- Offline potrzebuje tylko mechanik i przyjęcie pojazdu; biuro może działać online-first.

**Realtime:** SSE lub WebSocket z Nitro, Postgres LISTEN/NOTIFY albo Supabase Realtime.

### 6.4 Backend i usługi

- **API:** Nitro (Nuxt) jako BFF plus serwis Node/TypeScript: na start Hono lub Nitro, przy rozroście NestJS. AdonisJS to alternatywa „z bateriami”. Python (FastAPI) do AI i obrazów.
- **Baza:** PostgreSQL 16+ (RLS, JSONB, wyszukiwanie po nr rej. i VIN), ORM Drizzle.
- **BaaS:** **Supabase** (region UE lub self-host) daje Postgres z RLS, Auth, Storage i Realtime, jest zgodny z PowerSync i mocno przyspiesza MVP. Self-host ogranicza lock-in. Appwrite i PocketBase pasują słabiej.
- **Kolejki:** pg-boss lub BullMQ (SMS, KSeF, transkodowanie, przypomnienia).
- **Media:** S3 w UE (OVHcloud Object Storage, Scaleway, Hetzner). Kompresja na urządzeniu (zdjęcia ok. 1600 px, wideo 720p do 60 s), FFmpeg w kolejce, podpisane URL-e. Około 10 GB na warsztat miesięcznie przy 300 zleceniach, więc potrzebne są zasady retencji.
- **Powiadomienia:** Novu (open source; SMS, e-mail, push, in-app, preferencje użytkowników).
- **Billing:** Stripe Billing (opłata za mechanika, proporcjonalne rozliczenia) → faktura KSeF przez Fakturownię lub inFakt. Paddle (Merchant of Record) nie wystawia faktury KSeF polskiej firmy, co wymaga konsultacji z doradcą.
- **Bezpieczeństwo:** OWASP ASVS L2, OWASP MASVS, SBOM (CycloneDX) pod CRA, MFA dla administratorów, backup PITR, pentest przed startem.
- **i18n:** @nuxtjs/i18n od pierwszego dnia; waluty i stawki VAT jako konfiguracja.

### 6.5 Koszty infrastruktury (szacunki, netto miesięcznie, bez SMS)

| Pozycja | Pilotaż (≤20 warsztatów) | Wzrost (≤300) |
|---|---|---|
| Serwery (OVHcloud) | 100–300 zł | 600–1 500 zł |
| PostgreSQL / Supabase | 100–250 zł | 500–1 500 zł |
| Object Storage + transfer | 20–100 zł | 300–1 000 zł |
| PowerSync / Novu | 0–200 zł | 400–1 200 zł |
| E-mail, monitoring, backup | 0–200 zł | 300–900 zł |
| Konta Apple (99 USD/rok) i Google (25 USD jednorazowo) | ok. 35 zł | ok. 35 zł |
| **Razem** | **ok. 300–1 100 zł** | **ok. 2 100–6 100 zł** |

---

## 7. Model biznesowy i ceny

### 7.1 Ceny konkurencji

| Produkt | Model | Cena |
|---|---|---|
| Tekmetric | Stała opłata, nielimitowani użytkownicy | Start 179 USD/mies. przy płatności rocznej, 199 USD przy miesięcznej (tekmetric.com/pricing) |
| Shopmonkey | Plan + opłata za użytkownika | Basic 239 USD/mies. (215 USD przy płatności rocznej), 3 użytkowników w cenie, +20 USD za każdego kolejnego (shopmonkey.io/pricing) |
| AutoLeap | Plan + wdrożenie | 179–199 USD |
| Integra Car 7 | Licencja modułowa, bez opłaty za mechanika | od kilku do kilkunastu tys. zł |
| SerwisGT | Licencja | 1 590 / 2 099 zł |
| Warsztat24 | Licencja wieczysta na wersję | ok. 229 zł (promocja) |
| abcWarsztatu | Darmowy | 0 zł |
| Polskie programy chmurowe (autozeszyt.pl) | Abonament | „kilkadziesiąt złotych miesięcznie” |

### 7.2 Proponowany cennik Napiko (do walidacji w wywiadach)

- **Klient:** zawsze za darmo.
- **Solo** (mechanik jako mikroorganizacja): 0 zł z limitem ok. 20 zleceń miesięcznie albo 49 zł. Buduje sieć mechaników w wielu organizacjach.
- **Warsztat** (do 3 mechaników): 149–199 zł miesięcznie, każdy kolejny mechanik 39–49 zł, dwa miesiące gratis przy płatności rocznej.
- **Pro / Flota** (wiele lokalizacji, floty, integracje): 299–499 zł miesięcznie plus mechanicy.
- **Dodatki:** pakiety SMS (np. 500 SMS za 69 zł), miejsce na wideo, przechowalnia opon, integracja z kasą.
- **Okres próbny:** 30 dni bez karty i import danych z Excela lub popularnych programów (import to realna bariera zmiany programu).
- **Uzasadnienie modelu:** zarówno Tekmetric, jak i Integra reklamują się brakiem opłaty za użytkownika. Pakiet z 3 mechanikami w cenie łagodzi obawę „płacę za każdego”. To rekomendacja oparta na benchmarku, nie na badaniu skłonności do zapłaty.

### 7.3 Kanały dotarcia

- Sieci warsztatowe: ProfiAuto Serwis (>3 500), sieci Inter Cars, Q Service Castrol, Bosch Car Service, Premio. Trudne, bo mają własne programy, ale możliwe dla Napiko jako dodatku do komunikacji.
- Media: MotoFocus, warsztat.pl, MOTOFAKTOR, Auto Service Manager, Forum-Mechanika.pl, grupy mechaników na Facebooku, YouTube.
- Targi, np. Inter Cars Motor Show; stowarzyszenia i izby, np. SDCM, izby rzemieślnicze.
- Lokalnie na Podlasiu: bezpośrednie wizyty w 10–20 warsztatach, Cech Rzemiosł w Białymstoku, technika samochodowe.
- Program poleceń oraz efekt sieciowy przez klientów huba.

---

## 8. Waterfall

### 8.1 Fazy i dokumenty

| Faza | Dokumenty | Kryterium wyjścia |
|---|---|---|
| 1. Analiza | Wizja, analiza rynku, wywiady z 10–15 warsztatami, opinia prawna i podatkowa | Zatwierdzony zakres MVP |
| 2. Wymagania | **SRS wg ISO/IEC/IEEE 29148:2018**: wymagania funkcjonalne z ID, niefunkcjonalne (offline, bezpieczeństwo, WCAG, RODO, CRA), przypadki użycia dla ról (Biuro, Mechanik, Klient, Właściciel, Admin Napiko), reguły biznesowe (statusy, zgody, dokumenty), słownik, macierz śledzenia wymagań (RTM) | Przegląd i podpis |
| 3. Projekt | Model domeny (ERD), architektura C4, ADR, OpenAPI, model uprawnień (RBAC + RLS), model zagrożeń STRIDE, DPIA, makiety i prototyp w Figmie | Prototyp przetestowany z warsztatami |
| 4. Implementacja | Standardy kodu, CI/CD, SBOM | Gotowy przyrost |
| 5. Testy | Plan testów (wzór ISO/IEC/IEEE 29119): testy jednostkowe, integracyjne (środowisko testowe KSeF, kasy), izolacji najemców, E2E, terenowe w warsztacie (rękawice, słabe Wi-Fi), pentest | Kryteria akceptacji z RTM |
| 6. Wdrożenie | Migracja danych, szkolenia, regulamin, DPA, polityka prywatności, procedura CRA 24/72 h | Pilotaż w 3–5 warsztatach |

### 8.2 Ryzyka czystego waterfalla i jak je ograniczyć

- **Wymagania zamrożone bez użytkowników:** klikalny prototyp testowany z 5–8 warsztatami przed zamrożeniem SRS 1.0, jako formalny etap walidacji.
- **Zmiany prawa** (KSeF, CRA, SKP): wymagania prawne w osobnym, wersjonowanym rozdziale SRS z kontrolą zmian; logika podatkowa w adapterach.
- **Długo do pierwszego przychodu:** waterfall przyrostowy, czyli pełny cykl dla v1, a potem osobne cykle dla v1.1 i v2.
- **Integracje blokujące harmonogram:** techniczne proof of concept (KSeF, kasa, API Inter Cars, PowerSync) w fazie projektu, przed zatwierdzeniem harmonogramu.

---

## 9. Rekomendacja

### 9.1 Zakres MVP (v1): „Komunikacja i proces”

1. Strona produktu (Nuxt SSR), jedno konto z wieloma rolami, organizacje, zaproszenia pracowników.
2. Klienci (osoby i firmy), pojazdy (osobowe, dostawcze, motocykle; model gotowy na kolejne typy), kod z dowodu rejestracyjnego lub VIN.
3. Zlecenia → zadania → podzadania, 1..n mechaników przy zadaniu, statusy, kanban według pojazdów.
4. Protokoły przyjęcia i wydania: zdjęcia, podpis, limit kwotowy, zgody.
5. DVI (checklisty, zdjęcia, wideo, notatki głosowe) i ApprovalRequest (akceptacja / odrzucenie / „później”) z logiem dowodowym.
6. Aplikacja mechanika (Capacitor): offline, czas pracy, zgłaszanie potrzeb.
7. Hub klienta (aplikacja i link bez konta): akceptacje, dokumenty, historia, przypomnienia.
8. Powiadomienia push, e-mail i SMS z centrum zgód.
9. Proste części i magazyn: zapotrzebowania, rezerwacje, stany, marże.
10. Faktury przez API Fakturowni lub inFaktu (KSeF); paragony przez Napiko Bridge (1–2 producentów drukarek) albo ręczny numer paragonu.
11. KPI: ARO, odsetek akceptacji, czas rzeczywisty vs normatywny.
12. Subskrypcja (Stripe → faktura KSeF), panel administratora Napiko, log audytowy, funkcje RODO (DPA, eksport, usuwanie konta w aplikacji).

**v2:**
- API Inter Cars, Auto Partner i ProfiAuto;
- płatności online (Stripe Connect lub P24/Tpay);
- flota B2B z opiekunem akceptującym;
- wiele lokalizacji, przechowalnia opon, inwentaryzacja;
- własny moduł KSeF;
- rowery;
- WhatsApp, OCR faktur zakupowych.

**v3:**
- rezerwacje online i katalog warsztatów (DSA, P2B, Omnibus);
- maszyny rolnicze i wózki widłowe (motogodziny, UDT);
- BDO;
- TecDoc i TecRMI;
- Data Act;
- adapter DE (XRechnung) i kolejne języki.

### 9.2 Wstępny model domeny

- **User** 1–N **Membership** N–1 **Organization** (typ: warsztat lub solo); Membership ma role[] i lokalizacje[]. **User** 1–1 **ClientProfile**.
- **Organization** 1–N: Location, CustomerAccount, WorkOrder, InventoryItem, Supplier, PriceList, Subscription.
- **CustomerAccount** (rekord klienta w warsztacie) 0..1–1 ClientProfile (łączone po przyjęciu zaproszenia); N–N **Asset** przez **AssetLink** (właściciel, użytkownik, opiekun floty).
- **Asset** (globalny) 1–N: Identifier, MeterReading, ServiceHistoryEntry; `asset_type` → AssetTypeSchema.
- **WorkOrder** 1–1 Intake i Handover; 1–N: Job (drzewo), ApprovalRequest, Report, SalesDocument (odwołanie do KSeF lub kasy), Payment.
- **Job** 1–N: Assignment (→ Membership), TimeEntry, LineItem, Finding, Media. Finding 0..1–1 LineItem (propozycja).
- **ApprovalRequest** 1–N ApprovalItem 1–1 ApprovalDecision (decyzja, kanał, tożsamość, czas, hash migawki).
- **PartRequest** → PurchaseOrder → StockMovement → Reservation (Job).
- **ConsentRecord**, **NotificationLog**, **AuditEvent** (tylko dopisywanie), **Reminder** (Asset × typ × termin lub przebieg × źródło).

### 9.3 Otwarte decyzje właściciela produktu

1. Forma prawna (sp. z o.o. czy JDG) i ochrona znaku „Napiko” (sprawdzić kolizje w EUIPO i UPRP).
2. Segment startowy: rekomendacja – auta i motocykle, rowery w v2.
3. Cennik: stała opłata z pakietem mechaników czy opłata za mechanika; czy plan Solo jest darmowy.
4. SMS-y: nadpis każdego warsztatu czy wspólny „Napiko”; pakiety czy marża.
5. Udostępnianie historii: co widzi nowy właściciel pojazdu (ceny? dane warsztatu?); czy warsztat może oznaczać wpisy jako wewnętrzne.
6. Faktury: integracja (szybciej) czy własny moduł KSeF; wybór 1–2 partnerów.
7. Kasa: którzy producenci w v1; Napiko Bridge jako usługa Windows czy urządzenie.
8. Supabase czy własny Node + Postgres; PowerSync w chmurze czy self-host.
9. Płatności online: czy w v2 i u którego operatora.
10. AI (transkrypcja, sugestie kosztorysu): czy w v1.
11. Retencja mediów i kto płaci za przestrzeń.
12. Pilotaż: 5–10 warsztatów z Podlasia i kryteria sukcesu (np. ≥50% zleceń z cyfrową akceptacją).

Uporządkowana wersja tych decyzji z rekomendacjami: [02-decyzje-produktowe.md](02-decyzje-produktowe.md).

## Caveats – co wymaga weryfikacji

- **Prawnik:**
  - kwalifikacja zaproszenia SMS i przypomnień (art. 398 PKE);
  - czy zdalna akceptacja prac to umowa na odległość, i treść oświadczeń z art. 38 ustawy o prawach konsumenta;
  - role RODO w hubie i ryzyko współadministrowania;
  - wzory protokołów, regulaminu i DPA;
  - czy aplikacje podlegają CRA i EAA;
  - model płatności bez licencji i numer przepisu o wyłączeniu agenta w UUP.
- **Doradca podatkowy:**
  - termin wyłączenia z KSeF dla faktur do 450 zł i faktur z kas (30.09 czy 31.12.2026) – *rozstrzygnięte 26.09.2026: 31.12.2026*;
  - fakturowanie abonamentu w KSeF przy Stripe lub Paddle;
  - kasa w serwisach rowerowych;
  - e-paragony w aplikacji;
  - MPP przy częściach.
- **Dane rynkowe:**
  - rozbieżność cen Tekmetric (179 vs 199 USD) wynika z płatności rocznej lub miesięcznej (tekmetric.com/pricing); ceny AutoLeap i pozostałych systemów zagranicznych trzeba sprawdzić przed publikacją;
  - dane DVI to materiały marketingowe dostawców z USA;
  - liczba warsztatów w UE oraz serwisów rowerowych, rolniczych i wózków w Polsce nie została zweryfikowana;
  - terminy SKP, tachografów i UDT trzeba potwierdzić w aktach prawnych.
- **Integracje:** zakres API Auto Partner, Hart, Gordon i LKQ, koszty TecDoc oraz dostęp do CEPiK wymagają kontaktu handlowego i dokumentacji. W raporcie są hipotezami do potwierdzenia w proof of concept.

## Źródła

1. [ISBtech](https://www.isbtech.pl/2024/02/warsztaty-samochodowe-w-polsce-stan-branzy/)
2. [Swiatopon](https://www.swiatopon.info/artykuly/w-kraju-maleje-liczba-warsztatow-choc-rosnie-liczb,72333)
3. [MotoFocus](https://motofocus.pl/informacje/132749/ile-faktycznie-jest-warsztatow-samochodowych-w-polsce)
4. [Warsztat.pl](https://warsztat.pl/dzial/18-warto-wiedziec/artykuly/jaki-to-byl-rok-dla-warsztatow-samochodowych-a-jak,77295)
5. [Inter Cars](https://intercars.com.pl/pl/informacje/aktualnosci/niemal-30-warsztatow-w-polsce-dolaczylo-do-konceptow-sieciowych)
6. [MOTOFAKTOR](https://www.motofaktor.pl/warsztaty-samochodowe-w-dobie-zmian-podsumowanie-2025/)
7. [ProfiAuto](https://profiauto.pl/profiauto-serwis)
8. [Oferteo](https://biuroprasowe.oferteo.pl/469188-raport-z-rynku-mechanika-samochodowa)
9. [Programdowarsztatu](https://programdowarsztatu.pl/)
10. [AutoEXPERT](https://autoexpert.pl/artykuly/obowiazkowy-ksef-dla-warsztatow-od-2026-jaki-program-do-zarzadzania-serwisem-z-obsluga-e-faktur)
11. [Integra Software](https://integra.com.pl/programy-dla-serwisow-i-warsztatow/samochodowych-integra-car-7/)
12. [Warsztat.pl](https://warsztat.pl/dzial/9-wyposazenie-warsztatu/artykuly/inter-cars-25-rabatu-na-integra-car-7,78945)
13. [Integra](https://integra.auto.pl/)
14. [Mototrips](https://mototrips.pl/porady/najlepszy-program-do-warsztatu-ranking-top-4-aplikacje/)
15. [MOTOFAKTOR](https://www.motofaktor.pl/pas24-nowy-program-warsztatowy-od-profiauto/)
16. [ProfiAuto](https://profiauto.pl/pas24)
17. [sklep-ti.pl](https://www.sklep-ti.pl/warsztat-24-pl-2026-dla-1000-pc-w-sieci-lan-program-do-warsztatu-samochodowego-i-serwisu-aut-rowerow-licencja-dozywotnia-oficjalna-polska-dystrybucja)
18. [Warsztat24](https://warsztat24.com/)
19. [Warsztat24](https://warsztat24.com/konfiguracja-nowych-uslug-zewnetrznych-intercars-pobieranie-dokumentow-ic-api/)
20. [Warsztat24](https://warsztat24.com/konfiguracja-dla-pas24-wersja-profiauto/)
21. [Meteoryt](https://meteoryt.pl/Asystent_Chmura_Warsztat-d387-240.html)
22. [Meteoryt](https://meteoryt.pl/Asystent_Warsztat-d116-240.html)
23. [Acomnex](https://acomnex.pl/programy-oferta/serwis-gt2-pro-serwisy-motoryzacyjne)
24. [Binsoft](https://abcwarsztatu.binsoft.pl/)
25. [Mpwarsztat](https://www.mpwarsztat.pl/)
26. [AutoZeszyt](https://autozeszyt.pl/blog/program-do-warsztatu-samochodowego-porownanie)
27. [Tekmetric](https://www.tekmetric.com/pricing)
28. [SaaSworthy](https://www.saasworthy.com/product/tekmetric/pricing)
29. [Garage](https://garageauto.app/tekmetric-vs-shopmonkey-vs-autoleap-small-shop/)
30. [US Tech Automations](https://ustechautomations.com/resources/blog/automate-tekmetric-vs-shopmonkey-for-auto-repair-shops-2026)
31. [GetApp](https://www.getapp.com/retail-consumer-services-software/a/tekmetric/)
32. [G2](https://www.g2.com/compare/fullbay-vs-tekmetric)
33. [Torque360](https://blog.torque360.co/digital-vehicle-inspection-best-practices/)
34. [Auto Service World](https://www.autoserviceworld.com/detect-auto-report-links-digital-inspections-to-higher-repair-orders-shop-growth/)
35. [Autorox](https://www.autorox.ai/post/digital-vehicle-inspection-auto-repair-workshops)
36. [Chris Collins Inc.](https://chriscollinsinc.com/sdr/how-do-digital-vehicle-inspections-build-customer-trust/)
37. [Bolt On Technology](https://blog.boltontechnology.com/digital-vehicle-inspection-customer-confidence)
38. [LaunchControl](https://launchcontrol.app/news/digital-vehicle-inspections-build-trust-and-profit/)
39. [Prawodlabiznesu](https://prawodlabiznesu.eu/nowe-prawo-komunikacji-elektronicznej-sprawdz-swoje-zgody-marketingowe/)
40. [Robert Marczak](https://marczak.me/blog/prawo-komunikacji-elektronicznej-a-marketing-i-sprzedaz/)
41. [Actio](https://actio.pl/uslugi/sms-api/)
42. [Wojciech Matula](https://wojciechmatula.com/masowa-wysylka-sms/)
43. [Smsplanet](https://smsplanet.pl/cennik.html)
44. [Poradyodo](https://www.poradyodo.pl/orzeczenia/trybunal-sprawiedliwosci-ue-vin-jako-dana-osobowa-12516.html)
45. [Lexology](https://www.lexology.com/library/detail.aspx?g=5f881a67-1a3a-4a12-97ec-4b1202436b3e)
46. [Kzlegal](https://kzlegal.pl/pke-prawo-komunikacji-elektronicznej-zgody-marketingowe/)
47. [Nklegalpartners](https://nklegalpartners.pl/nowa-era-marketingu-bezposredniego-co-musisz-wiedziec-o-zmianach-w-pke/)
48. [Kancelaria MEDIA](https://kancelaria.media.pl/zgody-marketingowe-a-ustawa-pke/)
49. [Cyberpolicy NASK](https://cyberpolicy.nask.pl/ustawa-o-zwalczaniu-naduzyc-w-komunikacji-elektronicznej/)
50. [UKE](https://www.uke.gov.pl/akt/ustawa-o-zwalczaniu-naduzyc-w-komunikacji-elektronicznej,500.html)
51. [Sendly](https://sendly.link/pl/blog/sender-id-pole-nadawcy-sms/)
52. [e-file sp. z o.o.](https://jpk.info.pl/faktury/e-faktura-ustrukturyzowana-ksef/harmonogram/)
53. [e-file sp. z o.o.](https://jpk.info.pl/faktury/e-faktura-ustrukturyzowana-ksef/dla-kogo/)
54. [Solidna Księgowa](https://solidnaksiegowa.com/kasa-fiskalna-w-warsztacie-samochodowym-obowiazki-mechanika/)
55. [Kasafiskalna](http://www.kasafiskalna.pl/artykul,1225,15000,kasa-fiskalna-w-warsztacie-samochodowym.html)
56. [Sklepfiskalny](https://sklepfiskalny.pl/pl/n/Kto-moze-miec-kase-wirtualna/100)
57. [legalgeek](https://legalgeek.pl/blog/mip-czy-go-potrzebujesz-marketplace/)
58. [Sowislo](https://sowislo.com.pl/ustawa-o-zapewnianiu-spelniania-wymagan-dostepnosci-niektorych-produktow-i-uslug-przez-podmioty-gospodarcze-nowe-obowiazki-dla-przedsiebiorcow-od-czerwca-2025/)
59. [eKazus](https://ekazus.pl/dostepnosc-cyfrowa-sklepu/)
60. [Deloitte](https://www.deloitte.com/pl/pl/services/legal/perspectives/Cyber-Resilience-Act-CRA.html)
61. [Rodoradar](https://rodoradar.pl/cyber-resilience-act-cra/)
62. [LEX](https://sip.lex.pl/akty-prawne/dzienniki-UE/sprawa-c-319-22-gesamtverband-autoteile-handel-dostep-do-informacji-o-72252517)
63. [Curia (TSUE)](https://curia.europa.eu/jcms/jcms/p1_4183614/it)
64. [INFOR.PL](https://moto.infor.pl/prawo-na-drodze/ciekawostki/6492412,czy-numer-vin-pojazdu-oznacza-dane-osobowe-pytanie-absurdalne-odpowi.html)
65. [Kancelaria Nowaczyk](https://nowaczyk-kancelaria.pl/zgody-marketingowe-w-swietle-nowych-przepisow-ustawa-prawo-komunikacji-elektronicznej/)
66. [Prawo.pl](https://www.prawo.pl/biznes/prawo-komunikacji-elektronicznej-zgoda-na-dzialania-marketingowe,534839.html)
67. [Porady](https://porady.pl/jak-prawidlowo-zdobywac-zgody-marketingowe-w-2025-roku/)
68. [Altab S.A.](https://altab.pl/baza-wiedzy/ksef-od-kiedy-obowiazkowy/)
69. [INFORLEX](https://www.inforlex.pl/dok/tresc,FOB0000000000007551991,Obowiazkowy-KSeF-od-1-kwietnia-2026-r-dla-kolejnej-grupy-przedsiebiorcow.html)
70. [Armatis](https://www.armatis.com/pl/2026/06/19/ksef-2026-obowiazkowy-msp-przewodnik/)
71. [Promokas](https://www.promokas.pl/i47,kasy-dla-mechanikow.html)
72. [Polskie ePłatności](https://pep.pl/poradnik/kasa-fiskalna-wirtualna/)
73. [CRIDO](https://crido.pl/blog-taxes/kasy-wirtualne-w-nowych-branzach/)
74. [Ksiega-podatkowa](https://www.ksiega-podatkowa.pl/akademia-skp/jakie-obowiazki-naklada-kasa-fiskalna-na-firme-w-2026-roku)
75. [Stripe – BLIK](https://docs.stripe.com/payments/blik)
76. [Stripe – Connect pricing](https://stripe.com/en-pl/connect/pricing)
77. [Stripe – Connect pricing](https://stripe.com/zh-cn-au/connect/pricing)
78. [Stripe – P24](https://stripe.com/docs/payments/p24)
79. [Multi-Vendor](https://multi-vendor.pl/przelewy24---marketplace-opis-uslugi)
80. [Przelewy24](https://www.przelewy24.pl/rozwiazania-platnicze/marketplace)
81. [Przelewy24 – dokumentacja](https://developers.przelewy24.pl/marketplace/)
82. [PayU – marketplace](https://developers.payu.com/europe/docs/services/marketplace/)
83. [PayU – payment facilitator](https://developers.payu.com/en/payment_facilitator.html)
84. [Tpay](https://tpay.com/dla-biznesu/marketplace)
85. [Tpay – instrukcja](https://support.tpay.com/sprzedawca/platnosci-marketplace-instrukcja-konfiguracji)
86. [Tpay – cennik 2026](https://tpay.com/user/assets/files_for_download/pakiety-serwisowe-2026.pdf)
87. [Adyen – platforms](https://docs.adyen.com/platforms)
88. [Adyen – payment methods](https://docs.adyen.com/platforms/payment-methods)
89. [Adyen – pricing](https://www.adyen.com/pricing)
90. [TODA Pay](https://todapay.com/blog/adyen-fees-in-2026-the-true-cost-for-high-volume-merchants/)
91. [CEO Magazyn](https://ceo.com.pl/cra-od-11-wrzesnia-2026-producenci-maja-24-godziny-na-pierwsze-zgloszenie-57723)
92. [Prawo.pl](https://www.prawo.pl/biznes/cra-producenci-zglaszaja-podatnosci-od-11-wrzesnia,1552624.html)
93. [TechFormator](https://techformator.pl/nowe-obowiazki-dla-producentow-sprzetu-i-oprogramowania-na-zgloszenie-podatnosci-tylko-24-godziny)
94. [Legeartis](https://czasopismo.legeartis.org/2023/11/vin-samochodu-dane-osobowe-rodo-scania-naprawa-pojazdow-niezalezne-podmioty-wyrok-tsue/)
95. [ClearTax](https://www.cleartax.com/de/en/e-invoicing-germany)
96. [EDICOM Global](https://edicomgroup.com/blog/germany-b2b-electronic-invoice)
97. [ClearTax](https://www.cleartax.com/de/en/e-invoicing-timeline-in-germany)
98. [Sovos](https://sovos.com/vat/tax-rules/e-invoicing-germany/)
99. [Inter Cars](https://intercars.com.pl/pl/informacje/aktualnosci/wymiana-informacji-z-inter-cars-moze-byc-jeszcze-prostsza)
100. [Inter Cars – dokumentacja API](https://docs.webapi.intercars.eu/ic-api/docs/documentation/registration/intro)
