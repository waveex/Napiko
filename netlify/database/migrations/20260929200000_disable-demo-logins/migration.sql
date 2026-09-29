-- OXY · wyłączenie logowania kont demonstracyjnych
--
-- Migracja 20260928130000_demo-mechanics zakładała konta mechanik1..3@demo.oxy.invalid z hasłami,
-- których hashe są w repozytorium – także w bazach produkcyjnych. Usuwamy im logowanie hasłem i sesje.
-- Konta, członkostwa i ich historia (zadania, czas pracy, dziennik) zostają – nic się nie rozsypie.
--
-- Dane demo powstają teraz wyłącznie przez `pnpm db:seed:demo` (lokalnie i na podglądach),
-- który przywraca logowanie z hasłem z DEMO_PASSWORD.

DELETE FROM public.session
WHERE user_id IN (SELECT id FROM public."user" WHERE lower(email) LIKE '%@demo.oxy.invalid');

DELETE FROM public.account
WHERE provider_id = 'credential'
  AND user_id IN (SELECT id FROM public."user" WHERE lower(email) LIKE '%@demo.oxy.invalid');
