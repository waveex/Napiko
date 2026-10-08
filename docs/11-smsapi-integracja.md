# Integracja SMSAPI

Napiko wysyła SMS z kolejki przez `https://api.smsapi.pl/sms.do`, używając tokenu Bearer.
Token ustawiaj wyłącznie w ignorowanym `.env` lokalnie lub w sekretach środowiska na serwerze.
Na Netlify ustaw `SMS_PROVIDER=smsapi` oraz `SMSAPI_TOKEN` w środowisku funkcji właściwego wdrożenia.
Po zmianie konfiguracji uruchom ponownie lokalny serwer lub wdrożenie.

`pnpm sms:check` sprawdza nowy certyfikat TLS i odczytuje nazwy nadawców. Nie wysyła SMS.
Odczyt wymaga odpowiednich uprawnień tokenu; jego sukces nie sprawdza salda ani uprawnień wysyłki.
`pnpm test:sms` uruchamia testy z atrapą bramki, bez bazy danych i rzeczywistych wysyłek.

Nazwa nadawcy w ustawieniach warsztatu musi być zatwierdzona w SMSAPI. Jeśli jest pusta,
bramka korzysta z domyślnej nazwy konta. Podczas weryfikacji 08.10.2026 dostępny był
domyślny nadawca `Test`; nazwa `Napiko` nie była zarejestrowana.

Połączenie używa standardowej weryfikacji certyfikatów Node.js. Nie wyłączaj TLS ani
weryfikacji certyfikatów. Gdy test certyfikatu zawiedzie, zaktualizuj środowisko i zaufane CA
zgodnie z dokumentacją dostawcy. Token nie jest przesyłany w URL; przekierowania są blokowane.

Sukces wysyłki oznacza przyjęcie przez bramkę, nie doręczenie na telefon. Niepoprawna odpowiedź
lub błąd bramki powoduje błąd zadania. Powtórzenia korzystają z `idx` i `check_idx`;
ochrona SMSAPI przed duplikatami obowiązuje przez 24 godziny. Raporty doręczeń i pule SMS
w abonamencie pozostają osobnymi funkcjami do wdrożenia.

Dokumentacja: https://www.smsapi.pl/docs/
