-- OXY · migracja 2: rdzeń platformy
--  * kontekst żądania i izolacja danych warsztatów (Row Level Security, FORCE),
--  * ustawienia organizacji, pliki, dziennik zdarzeń (tylko dopisywanie, łańcuch hashy), kolejka zadań.
--
-- Model bezpieczeństwa (szczegóły: docs/03-architektura-i-infrastruktura.md):
--  * aplikacja łączy się jako właściciel tabel, ale RLS jest WYMUSZONE (FORCE) również dla właściciela;
--  * serwer w każdej transakcji ustawia app.user_id i app.org_id (set_config(..., true) = tylko ta transakcja);
--  * bez ustawionego kontekstu zapytania nie widzą żadnych wierszy (domyślnie „zamknięte”);
--  * zadania systemowe (kolejka, procesy tła) jawnie ustawiają app.system = 'on'.

CREATE SCHEMA IF NOT EXISTS app;

-- ---------------------------------------------------------------------------
-- Kontekst żądania
-- ---------------------------------------------------------------------------

CREATE FUNCTION app.current_user_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE FUNCTION app.current_org_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;

CREATE FUNCTION app.is_system() RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT coalesce(current_setting('app.system', true), '') = 'on' $$;

-- Czy bieżący użytkownik należy do aktywnej organizacji (druga linia obrony poza serwerem).
CREATE FUNCTION app.is_current_org_member() RETURNS boolean
  LANGUAGE sql STABLE
  AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public.member m
      WHERE m.organization_id = app.current_org_id()
        AND m.user_id = app.current_user_id()
    )
  $$;

CREATE FUNCTION app.touch_updated_at() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    NEW.updated_at := now();
    RETURN NEW;
  END;
  $$;

-- ---------------------------------------------------------------------------
-- Ustawienia organizacji
-- ---------------------------------------------------------------------------

CREATE TABLE public.organization_settings (
  "org_id" uuid PRIMARY KEY NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "assignment_policy" text DEFAULT 'office' NOT NULL,
  "sms_sender_name" text,
  "timezone" text DEFAULT 'Europe/Warsaw' NOT NULL,
  "locale" text DEFAULT 'pl' NOT NULL,
  "logo_file_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organization_settings_assignment_policy_check" CHECK ("assignment_policy" IN ('office', 'self', 'mixed')),
  -- Nadpis SMS: do 11 znaków alfanumerycznych (bez polskich liter), spacja, kropka, myślnik
  CONSTRAINT "organization_settings_sms_sender_check" CHECK ("sms_sender_name" IS NULL OR "sms_sender_name" ~ '^[A-Za-z0-9 .-]{1,11}$')
);

CREATE TRIGGER organization_settings_touch
  BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Pliki (metadane; zawartość w magazynie S3)
-- ---------------------------------------------------------------------------

CREATE TABLE public.file_object (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "uploaded_by" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "storage_key" text NOT NULL,
  "file_name" text NOT NULL,
  "content_type" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "purpose" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "uploaded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "file_object_storage_key_unique" UNIQUE ("storage_key"),
  CONSTRAINT "file_object_purpose_check" CHECK ("purpose" IN ('logo', 'attachment')),
  CONSTRAINT "file_object_status_check" CHECK ("status" IN ('pending', 'uploaded', 'deleted')),
  CONSTRAINT "file_object_size_check" CHECK ("size_bytes" > 0)
);
CREATE INDEX "file_object_org_created_idx" ON public.file_object ("org_id", "created_at");

ALTER TABLE public.organization_settings
  ADD CONSTRAINT "organization_settings_logo_file_fk"
  FOREIGN KEY ("logo_file_id") REFERENCES public.file_object ("id") ON DELETE SET NULL;

CREATE TRIGGER file_object_touch
  BEFORE UPDATE ON public.file_object
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Dziennik zdarzeń (audyt): tylko dopisywanie + łańcuch hashy per organizacja
-- ---------------------------------------------------------------------------

CREATE TABLE public.audit_event (
  "id" bigserial PRIMARY KEY NOT NULL,
  "org_id" uuid NOT NULL,
  "seq" bigint DEFAULT 0 NOT NULL,
  "actor_user_id" uuid,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "ip" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "prev_hash" text,
  "hash" text DEFAULT '' NOT NULL
);
CREATE UNIQUE INDEX "audit_event_org_seq_uq" ON public.audit_event ("org_id", "seq");

-- Skrót wpisu: obejmuje poprzedni skrót, więc zmiana dowolnego wpisu psuje cały dalszy łańcuch.
CREATE FUNCTION app.audit_event_hash(prev text, e public.audit_event) RETURNS text
  LANGUAGE sql STABLE
  AS $$
    SELECT encode(sha256(convert_to(concat_ws('|',
      coalesce(prev, ''),
      e.org_id::text,
      e.seq::text,
      coalesce(e.actor_user_id::text, ''),
      e.action,
      e.entity_type,
      coalesce(e.entity_id, ''),
      e.data::text,
      to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    ), 'UTF8')), 'hex')
  $$;

CREATE FUNCTION app.audit_event_before_insert() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  DECLARE
    last_seq bigint;
    last_hash text;
  BEGIN
    -- Wpisy jednej organizacji są dopisywane po kolei, żeby łańcuch się nie rozgałęził.
    PERFORM pg_advisory_xact_lock(hashtextextended('oxy.audit_event:' || NEW.org_id::text, 0));
    SELECT a.seq, a.hash INTO last_seq, last_hash
    FROM public.audit_event a
    WHERE a.org_id = NEW.org_id
    ORDER BY a.seq DESC
    LIMIT 1;

    NEW.seq := coalesce(last_seq, 0) + 1;
    NEW.created_at := now();
    NEW.prev_hash := last_hash;
    NEW.hash := app.audit_event_hash(last_hash, NEW);
    RETURN NEW;
  END;
  $$;

CREATE TRIGGER audit_event_chain
  BEFORE INSERT ON public.audit_event
  FOR EACH ROW EXECUTE FUNCTION app.audit_event_before_insert();

-- Zmiana i usuwanie wpisów są zablokowane. Wyjątek: jawna procedura retencji (app.audit_purge = 'on').
CREATE FUNCTION app.audit_event_immutable() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    IF TG_OP IN ('DELETE', 'TRUNCATE') AND coalesce(current_setting('app.audit_purge', true), '') = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'audit_event: operacja % jest zabroniona (dziennik tylko do dopisywania)', TG_OP
      USING ERRCODE = 'insufficient_privilege';
  END;
  $$;

CREATE TRIGGER audit_event_no_update_delete
  BEFORE UPDATE OR DELETE ON public.audit_event
  FOR EACH ROW EXECUTE FUNCTION app.audit_event_immutable();

CREATE TRIGGER audit_event_no_truncate
  BEFORE TRUNCATE ON public.audit_event
  FOR EACH STATEMENT EXECUTE FUNCTION app.audit_event_immutable();

-- Weryfikacja łańcucha: zwraca numer pierwszego uszkodzonego wpisu albo NULL, gdy łańcuch jest cały.
CREATE FUNCTION app.audit_chain_first_broken(p_org uuid) RETURNS bigint
  LANGUAGE plpgsql STABLE
  AS $$
  DECLARE
    r public.audit_event;
    prev text := NULL;
    expected_seq bigint := 1;
  BEGIN
    FOR r IN SELECT * FROM public.audit_event WHERE org_id = p_org ORDER BY seq LOOP
      IF r.seq <> expected_seq
         OR r.prev_hash IS DISTINCT FROM prev
         OR r.hash <> app.audit_event_hash(prev, r) THEN
        RETURN r.seq;
      END IF;
      prev := r.hash;
      expected_seq := expected_seq + 1;
    END LOOP;
    RETURN NULL;
  END;
  $$;

-- ---------------------------------------------------------------------------
-- Kolejka zadań (outbox)
-- ---------------------------------------------------------------------------

CREATE TABLE public.job (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid,
  "type" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 8 NOT NULL,
  "run_at" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "job_status_check" CHECK ("status" IN ('pending', 'running', 'done', 'failed'))
);
CREATE INDEX "job_pending_run_at_idx" ON public.job ("run_at") WHERE "status" = 'pending';

CREATE TRIGGER job_touch
  BEFORE UPDATE ON public.job
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.file_object ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_object FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_event FORCE ROW LEVEL SECURITY;
ALTER TABLE public.job ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job FORCE ROW LEVEL SECURITY;

-- Wzorzec (SELECT app.fn()) sprawia, że funkcje liczą się raz na zapytanie, a nie dla każdego wiersza.

-- Ustawienia: członkowie aktywnej organizacji czytają i zmieniają swoje; system – wszystko.
CREATE POLICY tenant_all ON public.organization_settings
  FOR ALL
  USING (org_id = (SELECT app.current_org_id()) AND (SELECT app.is_current_org_member()))
  WITH CHECK (org_id = (SELECT app.current_org_id()) AND (SELECT app.is_current_org_member()));
CREATE POLICY system_all ON public.organization_settings
  FOR ALL
  USING ((SELECT app.is_system()))
  WITH CHECK ((SELECT app.is_system()));

-- Pliki: jak wyżej.
CREATE POLICY tenant_all ON public.file_object
  FOR ALL
  USING (org_id = (SELECT app.current_org_id()) AND (SELECT app.is_current_org_member()))
  WITH CHECK (org_id = (SELECT app.current_org_id()) AND (SELECT app.is_current_org_member()));
CREATE POLICY system_all ON public.file_object
  FOR ALL
  USING ((SELECT app.is_system()))
  WITH CHECK ((SELECT app.is_system()));

-- Dziennik: członkowie czytają i dopisują wpisy swojej organizacji; zmian i usuwania nie ma (wyzwalacz).
CREATE POLICY tenant_select ON public.audit_event
  FOR SELECT
  USING (org_id = (SELECT app.current_org_id()) AND (SELECT app.is_current_org_member()));
CREATE POLICY tenant_insert ON public.audit_event
  FOR INSERT
  WITH CHECK (org_id = (SELECT app.current_org_id()) AND (SELECT app.is_current_org_member()));
CREATE POLICY system_all ON public.audit_event
  FOR ALL
  USING ((SELECT app.is_system()))
  WITH CHECK ((SELECT app.is_system()));

-- Kolejka: członkowie mogą tylko dodać zadanie swojej organizacji; przetwarza wyłącznie system.
CREATE POLICY tenant_insert ON public.job
  FOR INSERT
  WITH CHECK (org_id = (SELECT app.current_org_id()) AND (SELECT app.is_current_org_member()));
CREATE POLICY system_all ON public.job
  FOR ALL
  USING ((SELECT app.is_system()))
  WITH CHECK ((SELECT app.is_system()));
