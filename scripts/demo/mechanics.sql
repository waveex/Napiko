-- Konta demonstracyjne mechaników (mechanik1..3@demo.oxy.invalid) w organizacji właściciela demo.
-- Uruchamia `pnpm db:seed:demo` – NIE jest migracją. Hasło: DEMO_PASSWORD (hash liczy skrypt).
-- Istniejącym kontom demo przywraca logowanie hasłem, nie zmienia ich ról ani danych.
DO $$
DECLARE
  owner_id uuid;
  orgs uuid[];
  target_org uuid;
  mechanic_id uuid;
  existing_id uuid;
  r record;
BEGIN
  SELECT id INTO owner_id FROM public."user" WHERE lower(email) = lower(current_setting('oxy.demo_owner_email'));
  SELECT array_agg(organization_id) INTO orgs FROM public.member
  WHERE user_id = owner_id AND 'owner' = ANY(regexp_split_to_array(role, '\s*,\s*'));
  IF coalesce(cardinality(orgs), 0) = 0 THEN
    RAISE NOTICE 'Demo mechaników pominięte: brak organizacji właściciela.';
    RETURN;
  END IF;
  IF cardinality(orgs) <> 1 THEN
    RAISE EXCEPTION 'Demo mechaników: właściciel ma wiele organizacji.';
  END IF;
  target_org := orgs[1];
  PERFORM pg_advisory_xact_lock(hashtextextended('oxy.demo-mechanics:' || target_org::text, 0));
  FOR r IN SELECT * FROM (VALUES
    (1, 'Adam Nowicki', 'mechanik1@demo.oxy.invalid', current_setting('oxy.demo_password_hash')),
    (2, 'Paweł Zieliński', 'mechanik2@demo.oxy.invalid', current_setting('oxy.demo_password_hash')),
    (3, 'Michał Dąbrowski', 'mechanik3@demo.oxy.invalid', current_setting('oxy.demo_password_hash'))
  ) AS demo(n, name, email, password_hash)
  LOOP
    mechanic_id := pg_temp.demo_uuid('oxy.demo-mechanics:' || target_org || ':user:' || r.n);
    SELECT id INTO existing_id FROM public."user" WHERE lower(email) = r.email;
    IF existing_id IS NOT NULL AND existing_id <> mechanic_id THEN
      RAISE EXCEPTION 'Adres % jest już zajęty przez inne konto.', r.email;
    END IF;
    -- Ponowne wykonanie zachowuje także późniejsze zmiany adresu, hasła i członkostwa.
    IF EXISTS (SELECT 1 FROM public."user" WHERE id = mechanic_id) THEN
      -- Migracja 20260929200000_disable-demo-logins usuwa hasła kont demo – seed je przywraca.
      INSERT INTO public.account (user_id, account_id, provider_id, password, updated_at)
      SELECT mechanic_id, mechanic_id::text, 'credential', current_setting('oxy.demo_password_hash'), now()
      WHERE NOT EXISTS (SELECT 1 FROM public.account a WHERE a.user_id = mechanic_id AND a.provider_id = 'credential');
      CONTINUE;
    END IF;
    INSERT INTO public."user" (id, name, email, email_verified)
    VALUES (mechanic_id, r.name, r.email, true);
    INSERT INTO public.account (user_id, account_id, provider_id, password, updated_at)
    VALUES (mechanic_id, mechanic_id::text, 'credential', r.password_hash, now());
    INSERT INTO public.member (organization_id, user_id, role, created_at)
    VALUES (target_org, mechanic_id, 'mechanic', now());
  END LOOP;
END;
$$;
