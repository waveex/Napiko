-- Dane demonstracyjne warsztatu (9 klientów, pojazdów i zleceń z zadaniami).
-- Uruchamia `pnpm db:seed:demo` – NIE jest migracją, więc nie trafia do baz produkcyjnych.
-- Właściciel: oxy.demo_owner_email (ustawiane przez skrypt). Ponowne uruchomienie nie powiela danych.
-- Daty są względem chwili pierwszego uruchomienia; kontakty są fikcyjne.
DO $$
DECLARE
  owner_id uuid;
  target_org uuid;
  owner_orgs uuid[];
  previous_user text := current_setting('app.user_id', true);
  previous_org text := current_setting('app.org_id', true);
  c_id uuid;
  v_id uuid;
  w_id uuid;
  t_id uuid;
  task_status text;
  order_status text;
  received timestamptz;
  started timestamptz;
  completed timestamptz;
  order_number integer;
  order_year integer := extract(year FROM now() AT TIME ZONE 'Europe/Warsaw')::integer;
  r record;
  task_index integer;
BEGIN
  SELECT u.id INTO owner_id FROM public."user" u
  WHERE lower(u.email) = lower(current_setting('oxy.demo_owner_email'));

  SELECT array_agg(m.organization_id) INTO owner_orgs
  FROM public.member m
  WHERE m.user_id = owner_id
    AND 'owner' = ANY(regexp_split_to_array(m.role, '\s*,\s*'));

  IF coalesce(cardinality(owner_orgs), 0) = 0 THEN
    RAISE NOTICE 'Demo pominięte: brak organizacji właściciela %.', current_setting('oxy.demo_owner_email');
    RETURN;
  END IF;
  IF cardinality(owner_orgs) <> 1 THEN
    RAISE EXCEPTION 'Demo: właściciel ma wiele organizacji. Wskaż jednoznacznie organizację przed uruchomieniem migracji.';
  END IF;
  target_org := owner_orgs[1];
  PERFORM set_config('app.user_id', owner_id::text, true);
  PERFORM set_config('app.org_id', target_org::text, true);
  PERFORM pg_advisory_xact_lock(hashtextextended('oxy.demo-workshop:' || target_org::text, 0));

  FOR r IN SELECT * FROM (VALUES
    (1, 'Anna Kowalska', 'person', 'Toyota', 'Corolla', 2020, 'DEMO001', 82400,
      'Serwis olejowy i przegląd okresowy', ARRAY['Wymiana oleju i filtra oleju', 'Wymiana filtra kabinowego', 'Kontrola płynów i jazda próbna']),
    (2, 'Piotr Nowak', 'person', 'Volkswagen', 'Golf VII', 2017, 'DEMO002', 156200,
      'Wymiana hamulców przedniej osi', ARRAY['Weryfikacja zużycia hamulców', 'Wymiana tarcz i klocków z przodu', 'Kontrola hamowania i jazda próbna']),
    (3, 'Zielony Ogród Demo', 'company', 'Skoda', 'Octavia', 2019, 'DEMO003', 124800,
      'Przegląd klimatyzacji', ARRAY['Próba szczelności klimatyzacji', 'Serwis czynnika chłodniczego', 'Odgrzybianie i pomiar temperatury']),
    (4, 'Katarzyna Wiśniewska', 'person', 'Ford', 'Focus', 2018, 'DEMO004', 112500,
      'Stuki w przednim zawieszeniu', ARRAY['Diagnostyka luzów zawieszenia', 'Wymiana łączników stabilizatora', 'Geometria kół i jazda próbna']),
    (5, 'Marek Wójcik', 'person', 'BMW', '320d', 2016, 'DEMO005', 198700,
      'Utrata mocy i kontrolka silnika', ARRAY['Odczyt błędów i parametrów silnika', 'Naprawa nieszczelności dolotu', 'Test drogowy i ponowny odczyt błędów']),
    (6, 'Studio Forma Demo', 'company', 'Renault', 'Megane', 2021, 'DEMO006', 67300,
      'Wymiana zestawu rozrządu', ARRAY['Kontrola układu rozrządu', 'Wymiana rozrządu i pompy wody', 'Uzupełnienie płynu i kontrola szczelności']),
    (7, 'Joanna Kamińska', 'person', 'Kia', 'Ceed', 2022, 'DEMO007', 41800,
      'Przegląd przed wyjazdem', ARRAY['Kontrola układu hamulcowego', 'Kontrola akumulatora i ładowania', 'Kontrola opon, świateł i płynów']),
    (8, 'Tomasz Lewandowski', 'person', 'Hyundai', 'Tucson', 2020, 'DEMO008', 95600,
      'Sezonowa wymiana opon', ARRAY['Demontaż i ocena opon', 'Montaż i wyważenie kół', 'Ustawienie ciśnienia i kontrola TPMS']),
    (9, 'Biuro Projektowe Demo', 'company', 'Opel', 'Astra', 2019, 'DEMO009', 108900,
      'Serwis olejowy skrzyni biegów', ARRAY['Kontrola pracy skrzyni biegów', 'Wymiana oleju przekładniowego', 'Kontrola szczelności i jazda próbna'])
  ) AS demo(n, customer_name, kind, make, model, year, registration, mileage, description, titles)
  LOOP
    c_id := pg_temp.demo_uuid('oxy.demo-workshop:' || target_org || ':customer:' || r.n);
    v_id := pg_temp.demo_uuid('oxy.demo-workshop:' || target_org || ':vehicle:' || r.n);
    w_id := pg_temp.demo_uuid('oxy.demo-workshop:' || target_org || ':order:' || r.n);

    -- Nie cofamy późniejszych zmian użytkownika ani nie zużywamy kolejnych numerów.
    IF EXISTS (SELECT 1 FROM public.work_order WHERE id = w_id AND org_id = target_org) THEN
      CONTINUE;
    END IF;

    order_status := CASE WHEN r.n <= 3 THEN 'closed' WHEN r.n <= 6 THEN 'in_progress' ELSE 'received' END;
    received := CASE WHEN r.n <= 3 THEN now() - (14 - r.n) * interval '1 day'
      WHEN r.n <= 6 THEN now() - interval '1 day' ELSE now() END;

    INSERT INTO public.customer (id, org_id, kind, name, email, notes, created_by, created_at, updated_at)
    VALUES (c_id, target_org, r.kind, r.customer_name, 'klient.demo.' || r.n || '@example.invalid',
      'Fikcyjny klient demonstracyjny Napiko.', owner_id, received, received)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.vehicle (id, org_id, customer_id, make, model, year, registration_number,
      meter_value, notes, created_by, created_at, updated_at)
    VALUES (v_id, target_org, c_id, r.make, r.model, r.year, r.registration, r.mileage,
      'Samochód demonstracyjny; fikcyjny numer rejestracyjny.', owner_id, received, received)
    ON CONFLICT (id) DO NOTHING;

    order_number := app.next_sequence('work_order', order_year);
    INSERT INTO public.work_order (id, org_id, number, customer_id, vehicle_id, status, description,
      meter_value, promised_at, received_at, closed_at, created_by, created_at, updated_at)
    VALUES (w_id, target_org, 'ZL/' || order_year || '/' || lpad(order_number::text, greatest(4, length(order_number::text)), '0'),
      c_id, v_id, order_status, '[DEMO] ' || r.description, r.mileage,
      CASE WHEN r.n <= 3 THEN received + interval '1 day' ELSE now() + (r.n - 3) * interval '1 day' END,
      received, CASE WHEN r.n <= 3 THEN received + interval '5 hours' END,
      owner_id, received, CASE WHEN r.n <= 3 THEN received + interval '5 hours' ELSE now() END);

    FOR task_index IN 1..3 LOOP
      t_id := pg_temp.demo_uuid('oxy.demo-workshop:' || target_org || ':task:' || r.n || ':' || task_index);
      task_status := CASE WHEN r.n <= 3 OR (r.n <= 6 AND task_index = 1) THEN 'done'
        WHEN r.n <= 6 AND task_index = 2 THEN 'in_progress' ELSE 'todo' END;
      started := CASE WHEN task_status <> 'todo' THEN received + task_index * interval '1 hour' END;
      completed := CASE WHEN task_status = 'done' THEN started + interval '45 minutes' END;

      INSERT INTO public.task (id, org_id, work_order_id, title, description, status, position,
        estimated_minutes, started_at, completed_at, created_by, created_at, updated_at)
      VALUES (t_id, target_org, w_id, r.titles[task_index], 'Przykładowa czynność serwisowa — dane demo.',
        task_status, task_index - 1, CASE WHEN task_index = 2 THEN 90 ELSE 45 END,
        started, completed, owner_id, received, coalesce(completed, started, received));

      INSERT INTO public.task_assignment (org_id, task_id, user_id, assigned_by, assigned_at)
      VALUES (target_org, t_id, owner_id, owner_id, received);
    END LOOP;
  END LOOP;

  PERFORM set_config('app.user_id', coalesce(previous_user, ''), true);
  PERFORM set_config('app.org_id', coalesce(previous_org, ''), true);
END;
$$;
