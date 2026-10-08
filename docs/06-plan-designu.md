# Napiko — plan poprawy designu

Data: 28.09.2026 · Branch: `codex/design-blue-violet` · Status: plan do wdrożenia

## 1. Kierunek

Przyjazne narzędzie do pracy w warsztacie i spokojnej komunikacji z klientem. Zachowujemy istniejący układ aplikacji, ale nadajemy mu własny charakter, porządkujemy ważność informacji i ułatwiamy wykonanie następnego kroku.

Dwa kolory tożsamości: **jaskrawy niebieski inspirowany Borusan Turkish Blue dla mechaników i warsztatu** oraz **metaliczny fiolet dla klientów**. Jasne, neutralne powierzchnie pozostają podstawą. Kolor prowadzi do działania; subtelny połysk buduje charakter produktu.

Założenie: słowo „metaficzny” interpretujemy jako „metaliczny”. Widoki biura i właściciela należą do niebieskiej części warsztatowej. Ekran klientów w panelu warsztatu nadal jest niebieski — motyw wynika z kontekstu korzystania, a nie nazwy sekcji.

## 2. Rozpoznanie obecnego stanu

Plan powstał na podstawie kodu i dokumentacji produktu. Nie wykonano jeszcze oględzin uruchomionej aplikacji ani testów z użytkownikami; oceny wizualne wymagają potwierdzenia na ekranach.

| Obszar | Obecny stan w kodzie | Planowana poprawa |
| --- | --- | --- |
| Tożsamość | Globalny `primary: 'amber'`, neutralny `zinc`; CSS deklaruje głównie font Inter | Dwie spójne palety kontekstowe, własne powierzchnie, typografia i stany interakcji |
| Nawigacja | Lista linków w panelu bocznym, organizacja na górze | Czytelne grupy „Praca” i „Organizacja”, wyraźna aktywna pozycja, wygodne menu mobilne |
| Pulpit | Powitanie, dane organizacji, skróty do sekcji | Priorytet dla aktualnej pracy i spraw wymagających uwagi |
| Moje zadania | Jest aktywne zadanie, licznik i grupowanie zadań | Mocniejsza hierarchia i większe, jednoznaczne działania na telefonie |
| Tablica zleceń | Kolumny o stałej szerokości, przewijanie poziome, przeciąganie kart | Spokojniejsze kolumny, czytelniejsze karty i mobilna lista z filtrem statusu |
| Szczegóły zlecenia | Wiele sekcji w układzie dwóch obszarów | Stałe podsumowanie pojazdu i jasne grupowanie treści oraz działań |
| Akceptacja klienta | Działający kosztorys i decyzje o pracach dodatkowych, wspólny motyw | Fioletowy kontekst, wyraźna kwota, prosty język i czytelne potwierdzenie |

Zachowujemy Nuxt UI, Inter, ikony Lucide, obsługę PL/EN, uprawnienia i istniejące procesy. Nie ma potrzeby wymiany biblioteki komponentów.

## 3. Paleta i efekt metaliczny

Punktem odniesienia jest [oficjalna prezentacja Borusan Turkish Blue przez BMW](https://www.bmw-m.com/en/topics/magazine-article-pool/borusan-turkish-blue.html). Poniższe wartości są **propozycją ekranową**, a nie oficjalnymi kodami lakieru ani jego wiernym odwzorowaniem. Ostateczny odcień należy ocenić w kontekście całych ekranów.

| Zastosowanie | Warsztat / mechanik | Klient |
| --- | --- | --- |
| Rozpoznawalny akcent marki | `#00A6D6` — intensywny błękit z nutą turkusu | `#8854E8` — nasycony fiolet |
| Główne przyciski i linki w jasnym motywie | `#006C96` | `#6936B5` |
| Delikatne tło wyróżnienia | `#EAF8FD` | `#F3EDFD` |
| Światło w metalicznym detalu | `#8EDFF4` | `#C7ADF7` |
| Głęboki ton detalu | `#07516D` | `#43216C` |

Wspólna baza: tło `#F5F7FA`, powierzchnie `#FFFFFF`, tekst `#172331`, tekst pomocniczy `#536171`, obramowania `#DCE3EA`. Wszystkie pary wymagają pomiaru kontrastu podczas wdrożenia.

Zasady zastosowania:

- Jaskrawy błękit wyróżnia aktywną nawigację, wskaźniki i detale. Przyciski z białym tekstem otrzymują ciemniejszy wariant zapewniający czytelność.
- Metaliczność tworzy wąski, statyczny refleks: ciemniejszy ton → kolor bazowy → delikatne światło. Stosować w znaku marki lub małym detalu nagłówka. Główne przyciski mają jednolite tło.
- Większość powierzchni pozostaje neutralna. Unikamy wielkich gradientów niebiesko-fioletowych, połysku każdej karty i animowanych refleksów.
- Sukces, ostrzeżenie i błąd zachowują własną semantykę oraz tekst lub ikonę. Dwa kolory marki nie oznaczają ograniczenia wszystkich statusów do dwóch barw.
- Tryb ciemny otrzymuje osobne wartości powierzchni, tekstu, obramowań i akcentów. Nie odwracamy automatycznie jasnej palety.

## 4. Wspólne zasady UI

- Inter pozostaje podstawową czcionką. Nagłówki stron 24–28 px, sekcji 18–20 px, tekst i pola formularzy 16 px; drobne metadane 13–14 px. Kwoty i liczniki z cyframi o stałej szerokości.
- Odstępy w skali 4/8/12/16/24/32 px. Karty z promieniem 12–16 px, kontrolki 8–10 px. Cienie delikatne, przede wszystkim pod elementami nakładanymi.
- Jeden dominujący przycisk w obrębie danego zadania. Pozostałe działania mają niższą wagę; usuwanie i zamykanie nie konkurują ze zwykłą pracą.
- Na telefonie ważne przyciski mają obszar dotyku przynajmniej 44 × 44 px. Pola mają trwałe etykiety, błędy przy odpowiednim polu i zachowują wpisane dane.
- Puste stany tłumaczą sytuację i oferują kolejny krok, np. „Nie masz jeszcze przypisanych zadań”. Wyszukiwanie bez wyników proponuje wyczyszczenie filtrów.
- Ładowanie zachowuje przybliżony układ treści; błąd pobrania ma możliwość ponowienia. Nie przedstawiamy błędu jako pustej listy.
- Animacje wyłącznie pomagają zrozumieć zmianę stanu, zwykle 120–180 ms. Respektujemy ograniczenie ruchu i widoczny fokus klawiatury.

## 5. Ekrany i priorytety

### P0 — fundament i trzy ekrany wzorcowe

**Moje zadania — niebieski.** Pierwsza widoczna sekcja to aktualnie wykonywana praca: pojazd, zadanie, czas i akcja „Wstrzymaj”. Dalej zadania do wykonania oraz oczekujące. „Zgłoś potrzebę” i „Dodaj zdjęcie” pozostają łatwo dostępne. Zakończone zadania mają niższy priorytet. Zachowujemy istniejące grupowanie, licznik i przydzielanie pracy.

**Tablica zleceń — niebieski.** Na karcie najpierw pojazd i numer rejestracyjny, dalej termin, postęp i osoba odpowiedzialna. Numer zlecenia oraz nazwisko klienta to informacje drugorzędne. Nagłówki kolumn mają czytelne liczniki. Na telefonie lista kart z filtrem statusu zastępuje konieczność przesuwania całej tablicy. Zmiana statusu pozostaje dostępna bez przeciągania, także klawiaturą.

**Akceptacja przez link — fioletowy.** Kolejność: warsztat i pojazd → co proponujemy zrobić → szczegóły i zdjęcia → cena brutto → decyzja → potwierdzenie. Podsumowanie kosztu i przycisk wysłania decyzji mogą być przyklejone do dołu na telefonie, z miejscem w treści zapobiegającym zasłanianiu formularza. Odrzucenie pozostaje łatwe do znalezienia. Jasno rozróżniamy wybór decyzji od jej wysłania. Zachowujemy decyzję o całym kosztorysie oraz osobne decyzje dla prac dodatkowych, wymagane zgody i obsługę linków wygasłych, anulowanych oraz już wykorzystanych.

### P1 — spójność codziennej pracy

**Szczegóły zlecenia.** Nagłówek identyfikuje pojazd, status i termin. Główna treść grupuje zadania, zgłoszone potrzeby, kosztorys i materiały; dane klienta i pojazdu tworzą spokojny panel pomocniczy. Na telefonie podsumowanie poprzedza sekcje. Ważne ostrzeżenia pozostają widoczne także przy zwiniętych sekcjach.

**Pulpit.** Dla mechanika kieruje do bieżącego zadania; dla biura do zleceń i zgłoszeń wymagających reakcji. W pierwszej iteracji bazuje na dostępnych skrótach i danych. Zbiorcze liczniki „Dziś” oraz „Wymaga uwagi” dodajemy dopiero po sprawdzeniu dostępności pełnych danych i uprawnień — nie wyliczamy ich z przypadkowo przefiltrowanej listy.

**Formularze.** Przyjęcie zlecenia grupuje pola jako „Klient”, „Pojazd” i „Zakres prac”. Ujednolicamy szerokości, pomoc, walidację i położenie przycisków. Najpierw poprawa istniejącego formularza; wieloetapowy kreator tylko wtedy, gdy oględziny wykażą potrzebę.

**Nawigacja.** Grupy „Praca” i „Organizacja”, wyraźny kontekst warsztatu, spójny nagłówek. Dostępność linków nadal wynika z uprawnień. Na telefonie weryfikujemy otwieranie i zamykanie menu oraz powrót do treści.

### P2 — pozostałe powierzchnie

Listy klientów, pojazdy, cennik, zespół, ustawienia i audyt korzystają z tego samego zestawu zasad. Logowanie i rejestracja otrzymują spójne nagłówki i pomoc. Strona główna może pokazać oba konteksty marki, ale nie sugeruje gotowego portalu klienta — hub klienta jest osobnym etapem istniejącej roadmapy.

## 6. Plan wykonania

| Etap | Zakres i główne miejsca zmian | Wynik / warunek zakończenia |
| --- | --- | --- |
| 1. Oględziny | Uruchomiona aplikacja: Moje zadania, zlecenia, szczegóły, akceptacja; reprezentatywne dane demonstracyjne | Zrzuty stanu wyjściowego na telefonie i desktopie, potwierdzone problemy |
| 2. Fundament | `app/assets/css/main.css`, `app/app.config.ts`, layouty `dashboard.vue`, `public.vue`, `default.vue` | Tokeny obu motywów, powierzchnie, typografia, przyciski, fokus i kontrast |
| 3. Mechanik | `app/pages/app/my-tasks.vue`, `app/components/MyTaskCard.vue` | Pełny przebieg rozpoczęcia, pauzy i zakończenia pracy w nowym UI |
| 4. Klient | `app/pages/approve/[token].vue`, layout publiczny | Czytelna akceptacja kosztorysu i prac dodatkowych wraz ze stanami końcowymi |
| 5. Zlecenia | `app/pages/app/orders/index.vue`, `app/components/WorkOrderCard.vue`, `app/pages/app/orders/[id].vue` | Tablica desktopowa, mobilna lista i uporządkowane szczegóły |
| 6. Rozszerzenie | Pulpit, nawigacja, formularze, pozostałe strony, `i18n/locales/` | Spójne komponenty, teksty PL/EN i wszystkie podstawowe stany |
| 7. Odbiór | Zrzuty porównawcze, ścieżki użytkowników, lint, typecheck i build | Spełnione kryteria poniżej; udokumentowane ewentualne zależności |

Etap 2 poprzedza wdrażanie ekranów. Trzy ekrany P0 są punktem odniesienia dla reszty aplikacji; po ich ocenie korygujemy fundament przed szerokim przeniesieniem stylów.

Technicznie: palety definiujemy centralnie i mapujemy na role Nuxt UI. Motyw obszaru nie może zmieniać się przez globalną mutację konfiguracji podczas nawigacji. Trzeba sprawdzić zakres zmiennych CSS także dla modali, menu i toastów renderowanych poza layoutem. Przejście z warsztatu do akceptacji klienta i z powrotem nie może zostawiać poprzedniego akcentu ani powodować błysku niewłaściwego motywu.

## 7. Kryteria odbioru

- Mechanik i klient mają rozpoznawalne konteksty także dzięki podpisom i strukturze, nie tylko kolorowi.
- Przy 360, 390, 768 i 1440 px nie ma niezamierzonego przewijania całej strony w poziomie. Długie nazwy, kwoty i tłumaczenia EN nie rozbijają układu.
- Tekst zwykły osiąga kontrast co najmniej 4,5:1, duży tekst 3:1; istotne elementy interaktywne i fokus co najmniej 3:1. Sprawdzamy realne pary w obu trybach, nie same próbki palety.
- Klawiaturą można wykonać główne działania, otworzyć i zamknąć modal oraz wrócić do wywołującego przycisku. Ikony bez tekstu mają właściwe nazwy dostępnościowe, np. odświeżanie nie jest opisane jako wyszukiwanie.
- Start, pauza, zakończenie zadania, zgłoszenie potrzeby i dodanie zdjęcia zachowują dotychczasowe działanie i uprawnienia.
- Klient widzi kwotę brutto oraz zakres decyzji przed wysłaniem; interfejs nie wybiera zgody za niego. Po błędzie wysłania decyzje pozostają zachowane.
- Sprawdzamy pustą listę, brak wyników, ładowanie, błąd sieci, długie dane, brak uprawnień, zamknięte zlecenie i wszystkie stany linku akceptacji.
- Zrzuty przed/po pokazują poprawę hierarchii i spójności. W krótkiej próbie użytkownik potrafi bez instrukcji wskazać aktualne zadanie lub kwotę do zaakceptowania i następny krok.
- Po zmianach kodu przechodzą `pnpm lint`, `pnpm typecheck` i `pnpm build`; testy istniejących procesów uruchamiamy adekwatnie do zmian. Sam plan dokumentacyjny nie wymaga uruchamiania testów aplikacji.

## 8. Granice i stan prac

Zakres obecnego zadania: utworzenie brancha i przygotowanie planu. Nie wdrożono jeszcze zmian UI.

**29.09.2026 – pulpit (P1) wdrożony.** Pulpit dopasowany do roli (opis w `docs/04-moduly-warsztatu.md`, „Pulpit według roli”). Liczniki „Dziś” i „Wymaga uwagi” liczy osobny endpoint `GET /api/dashboard` na pełnych danych i z uprawnieniami ról – zgodnie z warunkiem z sekcji 5. Przy okazji: `.napiko-surface` jest regułą spoza warstw Tailwinda, więc klasy `border-primary`, `ring-*` i `hover:border-primary` na kartach nie działały. Wyróżnienie trwającej pracy i obramowanie po najechaniu dają teraz modyfikatory `.napiko-surface-active` i `.napiko-surface-link` (użyte w `MyTaskCard`, `WorkOrderCard` i na pulpicie). Nowy portal klienta, offline, powiadomienia i nowe agregaty danych pozostają osobnymi funkcjami roadmapy, chyba że okażą się uzgodnioną zależnością konkretnego ekranu.

Repozytorium w chwili rozpoczęcia planowania nie miało pierwszego commita. Na późniejsze polecenie użytkownika zapisano istniejącą aplikację jako commit `438fa50` na `master` i wysłano do `origin/master` w `https://github.com/waveex/mechanical-board.git`. Następnie utworzono z tej bazy branch `codex/design-blue-violet`. Niniejszy plan jest osobną zmianą na branchu designu; plik `.env` pozostał poza repozytorium.

Wskazany skill `frontend-skill` został odczytany. Lokalny plik jest wpisem katalogowym opisującym kierunek restrained UI i odsyłającym do upstreamu; nie zawiera pełnego workflow. Plan opiera się na jego kierunku, wymaganiach użytkownika i przeglądzie tego repozytorium.
