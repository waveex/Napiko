-- OXY · migracja 6: rozliczenie zlecenia bez integracji zewnętrznych (etap E4).
--
--  - dane firmy warsztatu (nagłówek kosztorysu, stawka roboczogodziny, stopka dokumentów),
--  - cennik usług (cena stała albo norma czasu × stawka roboczogodziny),
--  - kosztorys zlecenia (pozycje: robocizna, części, inne; rabat i VAT przy każdej pozycji),
--  - akceptacja kosztorysu przez klienta tym samym linkiem co prace dodatkowe (art. 630 KC),
--  - numer i data paragonu z kasy fiskalnej przy zamknięciu zlecenia (decyzja D4, wariant a).
-- Faktury (Fakturownia / KSeF) dojdą z integracjami – zadanie E4.6.

-- ─────────────────────────────────────────────────────────────────────────────
-- Dane firmy (1:1 z organizacją). Wiersz powstaje przy pierwszym zapisie.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.company_profile (
  "org_id" uuid PRIMARY KEY REFERENCES public.organization ("id") ON DELETE CASCADE,
  "legal_name" text,
  -- NIP (bez kresek) albo numer VAT UE z prefiksem kraju
  "tax_id" text,
  "street" text,
  "postal_code" text,
  "city" text,
  "country" text DEFAULT 'PL' NOT NULL,
  "phone" text,
  "email" text,
  "website" text,
  -- numer rachunku w formacie IBAN (bez spacji)
  "bank_account" text,
  "labor_rate_net" numeric(12, 2),
  "default_vat_rate" numeric(5, 2) DEFAULT 23 NOT NULL,
  "document_footer" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "company_profile_country_check" CHECK ("country" ~ '^[A-Z]{2}$'),
  CONSTRAINT "company_profile_labor_rate_check" CHECK ("labor_rate_net" IS NULL OR "labor_rate_net" >= 0),
  CONSTRAINT "company_profile_vat_check" CHECK ("default_vat_rate" >= 0 AND "default_vat_rate" <= 100)
);

CREATE TRIGGER company_profile_touch
  BEFORE UPDATE ON public.company_profile
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Cennik usług warsztatu
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.service_price (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "category" text,
  -- fixed: cena stała netto; hourly: norma czasu (h) × stawka roboczogodziny z danych firmy
  "pricing" text DEFAULT 'fixed' NOT NULL,
  "price_net" numeric(12, 2),
  "labor_hours" numeric(6, 2),
  "vat_rate" numeric(5, 2) DEFAULT 23 NOT NULL,
  "created_by" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- usługi usunięte z cennika zostają (kosztorysy się do nich odwołują)
  "archived_at" timestamp with time zone,
  CONSTRAINT "service_price_org_id_uq" UNIQUE ("org_id", "id"),
  CONSTRAINT "service_price_pricing_check" CHECK (
    ("pricing" = 'fixed' AND "price_net" IS NOT NULL AND "price_net" >= 0)
    OR ("pricing" = 'hourly' AND "labor_hours" IS NOT NULL AND "labor_hours" > 0)
  ),
  CONSTRAINT "service_price_vat_check" CHECK ("vat_rate" >= 0 AND "vat_rate" <= 100)
);
-- W aktywnym cenniku nazwy się nie powtarzają (bez względu na wielkość liter)
CREATE UNIQUE INDEX "service_price_org_name_uq" ON public.service_price ("org_id", lower("name")) WHERE "archived_at" IS NULL;

CREATE TRIGGER service_price_touch
  BEFORE UPDATE ON public.service_price
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Kosztorys zlecenia
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.estimate_item (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "work_order_id" uuid NOT NULL,
  -- labor: robocizna / usługa, part: część, other: inne (np. utylizacja, materiały)
  "kind" text DEFAULT 'labor' NOT NULL,
  "name" text NOT NULL,
  "quantity" numeric(10, 3) DEFAULT 1 NOT NULL,
  "unit" text DEFAULT 'szt.' NOT NULL,
  "unit_price_net" numeric(12, 2) NOT NULL,
  "discount_percent" numeric(5, 2) DEFAULT 0 NOT NULL,
  "vat_rate" numeric(5, 2) DEFAULT 23 NOT NULL,
  -- skąd pozycja: wpisana ręcznie, z cennika albo z zatwierdzonej wyceny zgłoszenia mechanika
  "source" text DEFAULT 'manual' NOT NULL,
  "service_price_id" uuid,
  "work_request_id" uuid,
  "position" integer DEFAULT 0 NOT NULL,
  "created_by" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "estimate_item_org_id_uq" UNIQUE ("org_id", "id"),
  CONSTRAINT "estimate_item_work_order_fk" FOREIGN KEY ("org_id", "work_order_id") REFERENCES public.work_order ("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "estimate_item_service_price_fk" FOREIGN KEY ("org_id", "service_price_id") REFERENCES public.service_price ("org_id", "id") ON DELETE SET NULL ("service_price_id"),
  CONSTRAINT "estimate_item_work_request_fk" FOREIGN KEY ("org_id", "work_request_id") REFERENCES public.work_request ("org_id", "id") ON DELETE SET NULL ("work_request_id"),
  CONSTRAINT "estimate_item_kind_check" CHECK ("kind" IN ('labor', 'part', 'other')),
  CONSTRAINT "estimate_item_source_check" CHECK ("source" IN ('manual', 'price_list', 'work_request')),
  CONSTRAINT "estimate_item_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "estimate_item_price_check" CHECK ("unit_price_net" >= 0),
  CONSTRAINT "estimate_item_discount_check" CHECK ("discount_percent" >= 0 AND "discount_percent" <= 100),
  CONSTRAINT "estimate_item_vat_check" CHECK ("vat_rate" >= 0 AND "vat_rate" <= 100)
);
CREATE INDEX "estimate_item_org_work_order_idx" ON public.estimate_item ("org_id", "work_order_id", "position");
-- Zatwierdzona wycena trafia do kosztorysu raz (robocizna i części osobno)
CREATE UNIQUE INDEX "estimate_item_request_kind_uq" ON public.estimate_item ("work_request_id", "kind") WHERE "work_request_id" IS NOT NULL;

CREATE TRIGGER estimate_item_touch
  BEFORE UPDATE ON public.estimate_item
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- Pozycja z wyceny zgłoszenia musi należeć do tego samego zlecenia co zgłoszenie.
CREATE FUNCTION app.estimate_item_check() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  DECLARE
    request_order uuid;
  BEGIN
    IF NEW.work_request_id IS NOT NULL THEN
      SELECT r.work_order_id INTO request_order FROM public.work_request r WHERE r.id = NEW.work_request_id AND r.org_id = NEW.org_id;
      IF request_order IS DISTINCT FROM NEW.work_order_id THEN
        RAISE EXCEPTION 'Zgłoszenie musi należeć do tego samego zlecenia co kosztorys'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$;

CREATE TRIGGER estimate_item_check
  BEFORE INSERT OR UPDATE OF work_request_id, work_order_id ON public.estimate_item
  FOR EACH ROW EXECUTE FUNCTION app.estimate_item_check();

-- ─────────────────────────────────────────────────────────────────────────────
-- Akceptacja kosztorysu: ta sama tabela co prośby o zgodę na prace dodatkowe.
-- Przy kosztorysie klient decyduje raz o całości (kolumna decision), pozycji approval_item brak.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.approval_request
  ADD COLUMN "kind" text DEFAULT 'work_requests' NOT NULL,
  ADD COLUMN "decision" text;

ALTER TABLE public.approval_request
  ADD CONSTRAINT "approval_request_kind_check" CHECK ("kind" IN ('work_requests', 'estimate')),
  ADD CONSTRAINT "approval_request_decision_check" CHECK (
    ("kind" = 'work_requests' AND "decision" IS NULL)
    OR ("kind" = 'estimate' AND ("decision" IS NULL OR "decision" IN ('approved', 'rejected')) AND (("status" = 'answered') = ("decision" IS NOT NULL)))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Paragon z kasy fiskalnej przy zamknięciu zlecenia
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.work_order
  ADD COLUMN "receipt_number" text,
  ADD COLUMN "receipt_issued_on" date;

ALTER TABLE public.work_order
  ADD CONSTRAINT "work_order_receipt_check" CHECK ("receipt_issued_on" IS NULL OR "receipt_number" IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- Izolacja warsztatów (RLS) dla nowych tabel
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['company_profile', 'service_price', 'estimate_item'] LOOP
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
