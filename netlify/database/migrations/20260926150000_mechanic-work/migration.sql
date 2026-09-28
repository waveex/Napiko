-- OXY · migracja 4: praca mechanika – czas pracy, zgłoszone potrzeby (części, prace dodatkowe) i załączniki zleceń.
--
-- Zasady jak w poprzednich migracjach: org_id w każdej tabeli, RLS ENABLE + FORCE, złożone klucze obce (org_id, id).

-- ---------------------------------------------------------------------------
-- Czas pracy nad zadaniami (rejestrator „start / pauza / zakończ”)
-- ---------------------------------------------------------------------------

CREATE TABLE public.time_entry (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "task_id" uuid NOT NULL,
  -- uzupełnia wyzwalacz na podstawie zadania (szybkie sumy czasu dla zlecenia)
  "work_order_id" uuid NOT NULL,
  -- po usunięciu konta zostaje anonimowy wpis – czas pracy jest częścią dokumentacji zlecenia
  "user_id" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "time_entry_org_id_uq" UNIQUE ("org_id", "id"),
  CONSTRAINT "time_entry_task_fk" FOREIGN KEY ("org_id", "task_id") REFERENCES public.task ("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "time_entry_work_order_fk" FOREIGN KEY ("org_id", "work_order_id") REFERENCES public.work_order ("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "time_entry_range_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);
-- Jedna osoba ma w danym warsztacie najwyżej jeden uruchomiony licznik.
CREATE UNIQUE INDEX "time_entry_one_running_uq" ON public.time_entry ("org_id", "user_id") WHERE "ended_at" IS NULL;
CREATE INDEX "time_entry_org_task_idx" ON public.time_entry ("org_id", "task_id");
CREATE INDEX "time_entry_org_work_order_idx" ON public.time_entry ("org_id", "work_order_id");
CREATE INDEX "time_entry_org_user_started_idx" ON public.time_entry ("org_id", "user_id", "started_at");

CREATE FUNCTION app.time_entry_fill_work_order() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    SELECT t.work_order_id INTO NEW.work_order_id
    FROM public.task t
    WHERE t.id = NEW.task_id AND t.org_id = NEW.org_id;
    IF NEW.work_order_id IS NULL THEN
      RAISE EXCEPTION 'Nie znaleziono zadania dla wpisu czasu pracy'
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    RETURN NEW;
  END;
  $$;

CREATE TRIGGER time_entry_fill_work_order
  BEFORE INSERT OR UPDATE OF task_id ON public.time_entry
  FOR EACH ROW EXECUTE FUNCTION app.time_entry_fill_work_order();

-- ---------------------------------------------------------------------------
-- Potrzeby zgłaszane przez mechaników: części do zamówienia i prace dodatkowe
-- (np. „przy wymianie klocków z przodu – tylne klocki do wymiany”)
-- ---------------------------------------------------------------------------

CREATE TABLE public.work_request (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "work_order_id" uuid NOT NULL,
  -- zadanie, przy którym mechanik zauważył potrzebę
  "task_id" uuid,
  -- part: część do zamówienia w zakresie zlecenia; extra_work: praca poza zakresem – wymaga zgody klienta
  "kind" text DEFAULT 'extra_work' NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "urgency" text DEFAULT 'recommended' NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  -- wycena biura (kwoty netto; brutto liczy aplikacja ze stawki VAT)
  "parts_net" numeric(12, 2),
  "labor_net" numeric(12, 2),
  "vat_rate" numeric(5, 2) DEFAULT 23 NOT NULL,
  "office_note" text,
  -- jak zapadła decyzja, np. „klient zgodził się telefonicznie”
  "decision_note" text,
  "reported_by" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "quoted_by" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "quoted_at" timestamp with time zone,
  "decided_by" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "decided_at" timestamp with time zone,
  -- zadanie utworzone po akceptacji pracy dodatkowej
  "created_task_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "work_request_org_id_uq" UNIQUE ("org_id", "id"),
  CONSTRAINT "work_request_work_order_fk" FOREIGN KEY ("org_id", "work_order_id") REFERENCES public.work_order ("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "work_request_task_fk" FOREIGN KEY ("org_id", "task_id") REFERENCES public.task ("org_id", "id") ON DELETE SET NULL ("task_id"),
  CONSTRAINT "work_request_created_task_fk" FOREIGN KEY ("org_id", "created_task_id") REFERENCES public.task ("org_id", "id") ON DELETE SET NULL ("created_task_id"),
  CONSTRAINT "work_request_kind_check" CHECK ("kind" IN ('part', 'extra_work')),
  CONSTRAINT "work_request_urgency_check" CHECK ("urgency" IN ('urgent', 'recommended', 'later')),
  CONSTRAINT "work_request_status_check" CHECK ("status" IN (
    'open', 'quoted', 'approved', 'rejected', 'ordered', 'done', 'cancelled'
  )),
  CONSTRAINT "work_request_title_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "work_request_amounts_check" CHECK (
    ("parts_net" IS NULL OR "parts_net" >= 0) AND ("labor_net" IS NULL OR "labor_net" >= 0)
  ),
  CONSTRAINT "work_request_vat_check" CHECK ("vat_rate" >= 0 AND "vat_rate" <= 100)
);
CREATE INDEX "work_request_org_work_order_idx" ON public.work_request ("org_id", "work_order_id");
CREATE INDEX "work_request_org_status_idx" ON public.work_request ("org_id", "status");

-- Zadania wskazane w potrzebie muszą należeć do tego samego zlecenia.
CREATE FUNCTION app.work_request_check_tasks() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  DECLARE
    wo uuid;
  BEGIN
    IF NEW.task_id IS NOT NULL THEN
      SELECT t.work_order_id INTO wo FROM public.task t WHERE t.id = NEW.task_id AND t.org_id = NEW.org_id;
      IF wo IS DISTINCT FROM NEW.work_order_id THEN
        RAISE EXCEPTION 'Zadanie musi należeć do tego samego zlecenia co zgłoszenie'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    IF NEW.created_task_id IS NOT NULL THEN
      SELECT t.work_order_id INTO wo FROM public.task t WHERE t.id = NEW.created_task_id AND t.org_id = NEW.org_id;
      IF wo IS DISTINCT FROM NEW.work_order_id THEN
        RAISE EXCEPTION 'Zadanie musi należeć do tego samego zlecenia co zgłoszenie'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$;

CREATE TRIGGER work_request_check_tasks
  BEFORE INSERT OR UPDATE OF task_id, created_task_id, work_order_id ON public.work_request
  FOR EACH ROW EXECUTE FUNCTION app.work_request_check_tasks();

CREATE TRIGGER work_request_touch
  BEFORE UPDATE ON public.work_request
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Zdjęcia i filmy w zleceniu (plik z file_object przypięty do zlecenia, zadania albo zgłoszenia)
-- ---------------------------------------------------------------------------

ALTER TABLE public.file_object ADD CONSTRAINT "file_object_org_id_uq" UNIQUE ("org_id", "id");

CREATE TABLE public.work_order_attachment (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "work_order_id" uuid NOT NULL,
  "task_id" uuid,
  "work_request_id" uuid,
  "file_id" uuid NOT NULL,
  "caption" text,
  -- czy klient zobaczy plik (raport, akceptacja prac dodatkowych)
  "customer_visible" boolean DEFAULT false NOT NULL,
  "created_by" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "work_order_attachment_org_id_uq" UNIQUE ("org_id", "id"),
  CONSTRAINT "work_order_attachment_file_uq" UNIQUE ("file_id"),
  CONSTRAINT "work_order_attachment_work_order_fk" FOREIGN KEY ("org_id", "work_order_id") REFERENCES public.work_order ("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "work_order_attachment_task_fk" FOREIGN KEY ("org_id", "task_id") REFERENCES public.task ("org_id", "id") ON DELETE SET NULL ("task_id"),
  CONSTRAINT "work_order_attachment_request_fk" FOREIGN KEY ("org_id", "work_request_id") REFERENCES public.work_request ("org_id", "id") ON DELETE SET NULL ("work_request_id"),
  CONSTRAINT "work_order_attachment_file_fk" FOREIGN KEY ("org_id", "file_id") REFERENCES public.file_object ("org_id", "id") ON DELETE CASCADE
);
CREATE INDEX "work_order_attachment_org_work_order_idx" ON public.work_order_attachment ("org_id", "work_order_id");

CREATE FUNCTION app.work_order_attachment_check() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  DECLARE
    wo uuid;
  BEGIN
    IF NEW.task_id IS NOT NULL THEN
      SELECT t.work_order_id INTO wo FROM public.task t WHERE t.id = NEW.task_id AND t.org_id = NEW.org_id;
      IF wo IS DISTINCT FROM NEW.work_order_id THEN
        RAISE EXCEPTION 'Zadanie musi należeć do tego samego zlecenia co załącznik'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    IF NEW.work_request_id IS NOT NULL THEN
      SELECT r.work_order_id INTO wo FROM public.work_request r WHERE r.id = NEW.work_request_id AND r.org_id = NEW.org_id;
      IF wo IS DISTINCT FROM NEW.work_order_id THEN
        RAISE EXCEPTION 'Zgłoszenie musi należeć do tego samego zlecenia co załącznik'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$;

CREATE TRIGGER work_order_attachment_check
  BEFORE INSERT OR UPDATE OF task_id, work_request_id, work_order_id ON public.work_order_attachment
  FOR EACH ROW EXECUTE FUNCTION app.work_order_attachment_check();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['time_entry', 'work_request', 'work_order_attachment'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_all ON public.%I FOR ALL
         USING (org_id = (SELECT app.current_org_id()) AND (SELECT app.is_current_org_member()))
         WITH CHECK (org_id = (SELECT app.current_org_id()) AND (SELECT app.is_current_org_member()))', t);
    EXECUTE format(
      'CREATE POLICY system_all ON public.%I FOR ALL
         USING ((SELECT app.is_system()))
         WITH CHECK ((SELECT app.is_system()))', t);
  END LOOP;
END;
$$;
