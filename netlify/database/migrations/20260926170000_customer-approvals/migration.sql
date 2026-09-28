-- OXY · migracja 5: akceptacja prac dodatkowych przez klienta (link wysłany e-mailem, SMS-em albo przekazany osobiście).
--
-- Dowód zgody konsumenta: co dokładnie zobaczył (snapshot + jego skrót SHA-256), kiedy i skąd odpowiedział.
-- Link zawiera losowy token; w bazie trzymamy wyłącznie jego skrót.

CREATE TABLE public.approval_request (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "work_order_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  -- link: biuro przekazuje link samo (np. klient przy ladzie); email / sms: wysyłka z aplikacji
  "channel" text NOT NULL,
  "recipient" text,
  -- treść pokazana klientowi (pozycje, ceny brutto, zdjęcia) i jej skrót – dowód, na co klient się zgodził
  "snapshot" jsonb NOT NULL,
  "snapshot_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "sent_by" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "viewed_at" timestamp with time zone,
  "answered_at" timestamp with time zone,
  "answer_ip" text,
  "answer_user_agent" text,
  "customer_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "approval_request_org_id_uq" UNIQUE ("org_id", "id"),
  CONSTRAINT "approval_request_token_hash_uq" UNIQUE ("token_hash"),
  CONSTRAINT "approval_request_work_order_fk" FOREIGN KEY ("org_id", "work_order_id") REFERENCES public.work_order ("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "approval_request_status_check" CHECK ("status" IN ('pending', 'answered', 'cancelled')),
  CONSTRAINT "approval_request_channel_check" CHECK ("channel" IN ('link', 'email', 'sms')),
  CONSTRAINT "approval_request_answer_check" CHECK (("status" = 'answered') = ("answered_at" IS NOT NULL))
);
CREATE INDEX "approval_request_org_work_order_idx" ON public.approval_request ("org_id", "work_order_id");

CREATE TRIGGER approval_request_touch
  BEFORE UPDATE ON public.approval_request
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- Pozycje prośby o akceptację: zgłoszenia (wycenione prace / części) i decyzja klienta dla każdej z nich
CREATE TABLE public.approval_item (
  "org_id" uuid NOT NULL,
  "approval_id" uuid NOT NULL,
  "work_request_id" uuid NOT NULL,
  "decision" text,
  PRIMARY KEY ("approval_id", "work_request_id"),
  CONSTRAINT "approval_item_approval_fk" FOREIGN KEY ("org_id", "approval_id") REFERENCES public.approval_request ("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "approval_item_request_fk" FOREIGN KEY ("org_id", "work_request_id") REFERENCES public.work_request ("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "approval_item_decision_check" CHECK ("decision" IS NULL OR "decision" IN ('approved', 'rejected'))
);
CREATE INDEX "approval_item_org_request_idx" ON public.approval_item ("org_id", "work_request_id");

-- Pozycje muszą pochodzić z tego samego zlecenia co prośba.
CREATE FUNCTION app.approval_item_check() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  DECLARE
    request_order uuid;
    approval_order uuid;
  BEGIN
    SELECT r.work_order_id INTO request_order FROM public.work_request r WHERE r.id = NEW.work_request_id AND r.org_id = NEW.org_id;
    SELECT a.work_order_id INTO approval_order FROM public.approval_request a WHERE a.id = NEW.approval_id AND a.org_id = NEW.org_id;
    IF request_order IS DISTINCT FROM approval_order THEN
      RAISE EXCEPTION 'Zgłoszenie musi należeć do tego samego zlecenia co prośba o akceptację'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END;
  $$;

CREATE TRIGGER approval_item_check
  BEFORE INSERT OR UPDATE OF work_request_id, approval_id ON public.approval_item
  FOR EACH ROW EXECUTE FUNCTION app.approval_item_check();

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['approval_request', 'approval_item'] LOOP
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
