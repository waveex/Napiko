-- OXY · migracja 3: rdzeń warsztatu – klienci, pojazdy, zlecenia, zadania i przypisania mechaników.
--
-- Zasady (jak w platform-core):
--  * każda tabela ma org_id, RLS ENABLE + FORCE i polityki tenant_all / system_all;
--  * klucze obce są złożone (org_id, id), więc nie da się powiązać rekordu z danymi innego warsztatu
--    (sprawdzenia kluczy obcych omijają RLS, dlatego organizacja musi być częścią klucza).

-- ---------------------------------------------------------------------------
-- Numeracja dokumentów w obrębie organizacji (np. ZL/2026/0001)
-- ---------------------------------------------------------------------------

CREATE TABLE public.org_sequence (
  "org_id" uuid NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "period" integer NOT NULL,
  "value" integer NOT NULL,
  PRIMARY KEY ("org_id", "name", "period")
);

-- Kolejny numer dla aktywnej organizacji; atomowo (INSERT … ON CONFLICT DO UPDATE).
CREATE FUNCTION app.next_sequence(p_name text, p_period integer) RETURNS integer
  LANGUAGE sql VOLATILE
  AS $$
    INSERT INTO public.org_sequence AS s ("org_id", "name", "period", "value")
    VALUES (app.current_org_id(), p_name, p_period, 1)
    ON CONFLICT ("org_id", "name", "period") DO UPDATE SET "value" = s."value" + 1
    RETURNING s."value"
  $$;

-- ---------------------------------------------------------------------------
-- Klienci warsztatu
-- ---------------------------------------------------------------------------

CREATE TABLE public.customer (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "kind" text DEFAULT 'person' NOT NULL,
  "name" text NOT NULL,
  "tax_id" text,
  "email" text,
  "phone" text,
  "notes" text,
  -- konto klienta w OXY (hub klienta) – ustawiane po przyjęciu zaproszenia
  "client_user_id" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "created_by" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived_at" timestamp with time zone,
  CONSTRAINT "customer_org_id_uq" UNIQUE ("org_id", "id"),
  CONSTRAINT "customer_kind_check" CHECK ("kind" IN ('person', 'company')),
  CONSTRAINT "customer_name_check" CHECK (length(btrim("name")) > 0)
);
CREATE INDEX "customer_org_name_idx" ON public.customer ("org_id", lower("name"));
CREATE INDEX "customer_org_phone_idx" ON public.customer ("org_id", "phone");

CREATE TRIGGER customer_touch
  BEFORE UPDATE ON public.customer
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Pojazdy i sprzęt (obiekty serwisowe dowolnego typu)
-- ---------------------------------------------------------------------------

CREATE TABLE public.vehicle (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "customer_id" uuid NOT NULL,
  "type" text DEFAULT 'car' NOT NULL,
  "make" text,
  "model" text,
  "year" integer,
  "registration_number" text,
  "vin" text,
  "serial_number" text,
  "meter_unit" text DEFAULT 'km' NOT NULL,
  "meter_value" integer,
  -- pola zależne od typu (np. nr ewidencyjny UDT, nr baterii e-bike)
  "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "notes" text,
  "created_by" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived_at" timestamp with time zone,
  CONSTRAINT "vehicle_org_id_uq" UNIQUE ("org_id", "id"),
  CONSTRAINT "vehicle_customer_fk" FOREIGN KEY ("org_id", "customer_id") REFERENCES public.customer ("org_id", "id"),
  CONSTRAINT "vehicle_type_check" CHECK ("type" IN (
    'car', 'van', 'truck', 'bus', 'trailer', 'camper', 'motorcycle', 'moped', 'atv',
    'bicycle', 'ebike', 'scooter', 'tractor', 'agricultural', 'forklift', 'construction', 'boat', 'garden', 'other'
  )),
  CONSTRAINT "vehicle_meter_unit_check" CHECK ("meter_unit" IN ('km', 'mth', 'none')),
  CONSTRAINT "vehicle_meter_value_check" CHECK ("meter_value" IS NULL OR "meter_value" >= 0),
  CONSTRAINT "vehicle_year_check" CHECK ("year" IS NULL OR "year" BETWEEN 1900 AND 2100)
);
CREATE INDEX "vehicle_org_customer_idx" ON public.vehicle ("org_id", "customer_id");
CREATE INDEX "vehicle_org_registration_idx" ON public.vehicle ("org_id", "registration_number");
CREATE INDEX "vehicle_org_vin_idx" ON public.vehicle ("org_id", "vin");

CREATE TRIGGER vehicle_touch
  BEFORE UPDATE ON public.vehicle
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Zlecenia (jedno zlecenie = jeden pojazd w warsztacie)
-- ---------------------------------------------------------------------------

CREATE TABLE public.work_order (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "number" text NOT NULL,
  "customer_id" uuid NOT NULL,
  "vehicle_id" uuid NOT NULL,
  "status" text DEFAULT 'received' NOT NULL,
  -- zakres prac zgłoszony przez klienta
  "description" text,
  -- stan licznika przy przyjęciu
  "meter_value" integer,
  "promised_at" timestamp with time zone,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "closed_at" timestamp with time zone,
  "created_by" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "work_order_org_id_uq" UNIQUE ("org_id", "id"),
  CONSTRAINT "work_order_org_number_uq" UNIQUE ("org_id", "number"),
  CONSTRAINT "work_order_customer_fk" FOREIGN KEY ("org_id", "customer_id") REFERENCES public.customer ("org_id", "id"),
  CONSTRAINT "work_order_vehicle_fk" FOREIGN KEY ("org_id", "vehicle_id") REFERENCES public.vehicle ("org_id", "id"),
  CONSTRAINT "work_order_status_check" CHECK ("status" IN (
    'received', 'in_progress', 'waiting_approval', 'waiting_parts', 'ready', 'closed', 'cancelled'
  )),
  CONSTRAINT "work_order_meter_value_check" CHECK ("meter_value" IS NULL OR "meter_value" >= 0)
);
CREATE INDEX "work_order_org_status_idx" ON public.work_order ("org_id", "status");
CREATE INDEX "work_order_org_vehicle_idx" ON public.work_order ("org_id", "vehicle_id");
CREATE INDEX "work_order_org_customer_idx" ON public.work_order ("org_id", "customer_id");

CREATE TRIGGER work_order_touch
  BEFORE UPDATE ON public.work_order
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Zadania i podzadania w zleceniu
-- ---------------------------------------------------------------------------

CREATE TABLE public.task (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "work_order_id" uuid NOT NULL,
  "parent_id" uuid,
  "title" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'todo' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  -- czas normatywny (z katalogu norm lub wpisany przez biuro)
  "estimated_minutes" integer,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_by" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "task_org_id_uq" UNIQUE ("org_id", "id"),
  CONSTRAINT "task_work_order_fk" FOREIGN KEY ("org_id", "work_order_id") REFERENCES public.work_order ("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "task_parent_fk" FOREIGN KEY ("org_id", "parent_id") REFERENCES public.task ("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "task_status_check" CHECK ("status" IN (
    'todo', 'in_progress', 'paused', 'waiting_parts', 'waiting_approval', 'done', 'cancelled'
  )),
  CONSTRAINT "task_title_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "task_estimated_minutes_check" CHECK ("estimated_minutes" IS NULL OR "estimated_minutes" >= 0),
  CONSTRAINT "task_not_own_parent_check" CHECK ("parent_id" IS NULL OR "parent_id" <> "id")
);
CREATE INDEX "task_org_work_order_idx" ON public.task ("org_id", "work_order_id");
CREATE INDEX "task_parent_idx" ON public.task ("parent_id");

-- Podzadanie musi należeć do tego samego zlecenia, a drzewo ma najwyżej dwa poziomy (zadanie → podzadanie).
CREATE FUNCTION app.task_check_parent() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  DECLARE
    parent_work_order uuid;
    parent_parent uuid;
  BEGIN
    IF NEW.parent_id IS NULL THEN
      RETURN NEW;
    END IF;
    SELECT t.work_order_id, t.parent_id INTO parent_work_order, parent_parent
    FROM public.task t
    WHERE t.id = NEW.parent_id AND t.org_id = NEW.org_id;
    IF parent_work_order IS DISTINCT FROM NEW.work_order_id THEN
      RAISE EXCEPTION 'Podzadanie musi należeć do tego samego zlecenia co zadanie nadrzędne'
        USING ERRCODE = 'check_violation';
    END IF;
    IF parent_parent IS NOT NULL THEN
      RAISE EXCEPTION 'Dozwolone są tylko dwa poziomy: zadanie i podzadanie'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END;
  $$;

CREATE TRIGGER task_check_parent
  BEFORE INSERT OR UPDATE OF parent_id, work_order_id ON public.task
  FOR EACH ROW EXECUTE FUNCTION app.task_check_parent();

CREATE TRIGGER task_touch
  BEFORE UPDATE ON public.task
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Przypisania zadań do członków zespołu (jeden lub wielu mechaników)
-- ---------------------------------------------------------------------------

CREATE TABLE public.task_assignment (
  "org_id" uuid NOT NULL,
  "task_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "assigned_by" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("task_id", "user_id"),
  CONSTRAINT "task_assignment_task_fk" FOREIGN KEY ("org_id", "task_id") REFERENCES public.task ("org_id", "id") ON DELETE CASCADE,
  -- przypisać można tylko członka tej organizacji; odejście z zespołu usuwa przypisania
  CONSTRAINT "task_assignment_member_fk" FOREIGN KEY ("org_id", "user_id") REFERENCES public.member ("organization_id", "user_id") ON DELETE CASCADE
);
CREATE INDEX "task_assignment_org_user_idx" ON public.task_assignment ("org_id", "user_id");

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['org_sequence', 'customer', 'vehicle', 'work_order', 'task', 'task_assignment'] LOOP
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
