-- Lokalna baza deweloperska. Aplikacja łączy się jako zwykły użytkownik "oxy" (właściciel bazy, bez uprawnień superużytkownika),
-- tak jak w chmurze (Neon / Netlify Database). Superużytkownik omija RLS, więc nie używamy go w aplikacji.
CREATE ROLE oxy WITH LOGIN PASSWORD 'oxy' CREATEDB;
CREATE DATABASE oxy OWNER oxy;
CREATE DATABASE oxy_test OWNER oxy;
