-- Poprzednie seedy rzutowały MD5 na uuid bez bitów wersji/wariantu.
-- Naprawiamy tylko znane ID demo, zachowując treść, hasła i wszystkie klucze obce.
-- Starych migracji nie edytujemy: ich sumy kontrolne są już zapisane w bazie.
DO $$
DECLARE
  r record;
  previous_system text := current_setting('app.system', true);
BEGIN
  PERFORM set_config('app.system', 'on', true);
  CREATE TEMP TABLE demo_uuid_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL) ON COMMIT DROP;
  INSERT INTO demo_uuid_map
  SELECT old_id, overlay(overlay(old_id::text placing '8' from 15 for 1) placing '8' from 20 for 1)::uuid
  FROM (
    SELECT md5('oxy.demo-workshop:' || o.id || ':' || seed.kind || ':' || n)::uuid AS old_id
    FROM public.organization o CROSS JOIN generate_series(1, 9) n
    CROSS JOIN unnest(ARRAY['customer', 'vehicle', 'order']) AS seed(kind)
    UNION ALL
    SELECT md5('oxy.demo-workshop:' || o.id || ':task:' || n || ':' || t)::uuid
    FROM public.organization o CROSS JOIN generate_series(1, 9) n CROSS JOIN generate_series(1, 3) t
    UNION ALL
    SELECT md5('oxy.demo-mechanics:' || o.id || ':user:' || n)::uuid
    FROM public.organization o CROSS JOIN generate_series(1, 3) n
  ) ids
  WHERE old_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

  -- Kolumny podstawowe i odwołania FK (także dodane później do danych demo).
  CREATE TEMP TABLE demo_uuid_columns ON COMMIT DROP AS
  SELECT c.oid AS rel, a.attname AS col
  FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'id'
  WHERE ns.nspname = 'public' AND c.relname IN ('customer', 'vehicle', 'work_order', 'task', 'user')
  UNION
  SELECT fk.conrelid, a.attname
  FROM pg_constraint fk
  CROSS JOIN LATERAL unnest(fk.conkey, fk.confkey) AS keys(local_key, foreign_key)
  JOIN pg_attribute a ON a.attrelid = fk.conrelid AND a.attnum = keys.local_key
  JOIN pg_attribute b ON b.attrelid = fk.confrelid AND b.attnum = keys.foreign_key
  WHERE fk.contype = 'f' AND (
    (fk.confrelid IN ('public.customer'::regclass, 'public.vehicle'::regclass,
      'public.work_order'::regclass, 'public.task'::regclass, 'public.user'::regclass) AND b.attname = 'id')
    OR (fk.confrelid = 'public.member'::regclass AND b.attname = 'user_id')
  );

  -- Blokady i wszystkie zmiany obowiązują tylko w tej transakcji.
  FOR r IN SELECT DISTINCT rel FROM demo_uuid_columns ORDER BY rel LOOP
    EXECUTE format('LOCK TABLE %s IN ACCESS EXCLUSIVE MODE', r.rel::regclass);
  END LOOP;
  CREATE TEMP TABLE demo_uuid_fks ON COMMIT DROP AS
  SELECT conrelid, conname, condeferrable, condeferred FROM pg_constraint
  WHERE contype = 'f' AND conrelid IN (SELECT rel FROM demo_uuid_columns);
  FOR r IN SELECT * FROM demo_uuid_fks LOOP
    EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY DEFERRED', r.conrelid::regclass, r.conname);
  END LOOP;
  SET CONSTRAINTS ALL DEFERRED;

  -- Wyzwalacze biznesowe sprawdzają stan pośredni drzewa zadań; przy zmianie
  -- samych ID czasowo je wyłączamy, bez wyłączania wyzwalaczy integralności FK.
  CREATE TEMP TABLE demo_uuid_triggers ON COMMIT DROP AS
  SELECT tgrelid, tgname, tgenabled FROM pg_trigger
  WHERE NOT tgisinternal AND tgrelid IN (SELECT rel FROM demo_uuid_columns);
  FOR r IN SELECT * FROM demo_uuid_triggers LOOP
    EXECUTE format('ALTER TABLE %s DISABLE TRIGGER %I', r.tgrelid::regclass, r.tgname);
  END LOOP;

  FOR r IN SELECT * FROM demo_uuid_columns ORDER BY rel, col LOOP
    EXECUTE format('UPDATE %s AS dst SET %I = m.new_id FROM demo_uuid_map m WHERE dst.%I = m.old_id',
      r.rel::regclass, r.col, r.col);
  END LOOP;
  -- Better Auth przechowuje dodatkowo ID konta hasłowego jako tekst.
  UPDATE public.account a SET account_id = m.new_id::text
  FROM demo_uuid_map m WHERE a.provider_id = 'credential' AND a.account_id = m.old_id::text;
  -- Historyczny audit_event jest niezmienny (łańcuch hashy), więc go nie przepisujemy.

  SET CONSTRAINTS ALL IMMEDIATE;
  FOR r IN SELECT * FROM demo_uuid_fks LOOP
    EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I %s', r.conrelid::regclass, r.conname,
      CASE WHEN NOT r.condeferrable THEN 'NOT DEFERRABLE'
        WHEN r.condeferred THEN 'DEFERRABLE INITIALLY DEFERRED' ELSE 'DEFERRABLE INITIALLY IMMEDIATE' END);
  END LOOP;
  FOR r IN SELECT * FROM demo_uuid_triggers LOOP
    EXECUTE format('ALTER TABLE %s %s TRIGGER %I', r.tgrelid::regclass,
      CASE r.tgenabled WHEN 'D' THEN 'DISABLE' WHEN 'R' THEN 'ENABLE REPLICA'
        WHEN 'A' THEN 'ENABLE ALWAYS' ELSE 'ENABLE' END, r.tgname);
  END LOOP;
  DROP TABLE demo_uuid_triggers, demo_uuid_fks, demo_uuid_columns, demo_uuid_map;
  PERFORM set_config('app.system', coalesce(previous_system, ''), true);
END;
$$;
