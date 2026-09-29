-- OXY · migracja: powiadomienia (etap E6), push (E8.5) i strona statusu naprawy dla klienta (E5.6).
--
--  * zespół: powiadomienia w aplikacji (dzwonek), ustawienia e-mail / push, urządzenia z włączonym push;
--  * klient: dziennik wiadomości (SMS / push / e-mail), „zarejestrowany telefon” (push zamiast SMS-a),
--    link do strony statusu naprawy, automatyczne powiadomienia w ustawieniach warsztatu, rezygnacje klienta.
--
-- Zasady jak w poprzednich migracjach: org_id, RLS ENABLE + FORCE, złożone klucze obce (org_id, id).
-- Powiadomienia zespołu mają węższe polityki: każdy czyta i oznacza tylko swoje.

-- ---------------------------------------------------------------------------
-- Ustawienia warsztatu i klienta
-- ---------------------------------------------------------------------------

-- Decyzja D5: przy przyjęciu pojazdu i gotowości do odbioru klient dostaje SMS (albo push) i e-mail.
-- phone = SMS, a gdy klient włączył powiadomienia w telefonie – push (taniej, bez limitu pakietu SMS).
ALTER TABLE public.organization_settings
  ADD COLUMN "customer_notifications" jsonb NOT NULL
    DEFAULT '{"order_received": {"auto": true, "phone": true, "email": true}, "order_ready": {"auto": true, "phone": true, "email": true}}'::jsonb,
  ADD CONSTRAINT "organization_settings_customer_notifications_check" CHECK (jsonb_typeof("customer_notifications") = 'object');

-- Wiadomości o naprawie są transakcyjne (nie marketing), ale klient może z nich zrezygnować.
-- Rejestr zgód marketingowych (art. 398 PKE) to osobny etap E6.1.
ALTER TABLE public.customer
  ADD COLUMN "notify_sms" boolean DEFAULT true NOT NULL,
  ADD COLUMN "notify_email" boolean DEFAULT true NOT NULL;

-- ---------------------------------------------------------------------------
-- Powiadomienia zespołu (dzwonek w aplikacji)
-- ---------------------------------------------------------------------------

CREATE TABLE public.notification (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL,
  "type" text NOT NULL,
  "actor_user_id" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "work_order_id" uuid,
  "entity_type" text,
  "entity_id" uuid,
  "link" text,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_org_id_uq" UNIQUE ("org_id", "id"),
  -- odbiorca musi należeć do warsztatu; odejście z zespołu usuwa jego powiadomienia
  CONSTRAINT "notification_member_fk" FOREIGN KEY ("org_id", "user_id") REFERENCES public.member ("organization_id", "user_id") ON DELETE CASCADE,
  CONSTRAINT "notification_work_order_fk" FOREIGN KEY ("org_id", "work_order_id") REFERENCES public.work_order ("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "notification_type_check" CHECK ("type" ~ '^[a-z_]+\.[a-z_]+$'),
  -- tylko ścieżki wewnątrz aplikacji (bez adresów zewnętrznych)
  CONSTRAINT "notification_link_check" CHECK ("link" IS NULL OR "link" ~ '^/app(/[A-Za-z0-9/_-]*)?(\?[A-Za-z0-9=&_-]*)?$'),
  CONSTRAINT "notification_data_check" CHECK (jsonb_typeof("data") = 'object')
);
CREATE INDEX "notification_recipient_idx" ON public.notification ("org_id", "user_id", "created_at" DESC);
CREATE INDEX "notification_unread_idx" ON public.notification ("org_id", "user_id") WHERE "read_at" IS NULL;
-- np. „czy wysłaliśmy już powiadomienie o wygaśnięciu tej prośby”
CREATE INDEX "notification_entity_idx" ON public.notification ("entity_id", "type") WHERE "entity_id" IS NOT NULL;
-- sprzątanie starych powiadomień (zadanie codzienne)
CREATE INDEX "notification_created_idx" ON public.notification ("created_at");

-- Treści powiadomienia nie da się zmienić – odbiorca może tylko oznaczyć je jako przeczytane.
CREATE FUNCTION app.notification_guard_update() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    IF NOT app.is_system() AND (
      NEW.org_id, NEW.user_id, NEW.type, NEW.work_order_id, NEW.entity_type, NEW.entity_id, NEW.link, NEW.data, NEW.created_at
    ) IS DISTINCT FROM (
      OLD.org_id, OLD.user_id, OLD.type, OLD.work_order_id, OLD.entity_type, OLD.entity_id, OLD.link, OLD.data, OLD.created_at
    ) THEN
      RAISE EXCEPTION 'notification: można zmienić tylko datę przeczytania'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END;
  $$;

CREATE TRIGGER notification_guard_update
  BEFORE UPDATE ON public.notification
  FOR EACH ROW EXECUTE FUNCTION app.notification_guard_update();

-- Ustawienia kanałów (e-mail, push) dla typu powiadomienia. Brak wiersza = wartości domyślne z aplikacji.
CREATE TABLE public.notification_preference (
  "org_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "type" text NOT NULL,
  "email" boolean NOT NULL,
  "push" boolean NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("org_id", "user_id", "type"),
  CONSTRAINT "notification_preference_member_fk" FOREIGN KEY ("org_id", "user_id") REFERENCES public.member ("organization_id", "user_id") ON DELETE CASCADE,
  CONSTRAINT "notification_preference_type_check" CHECK ("type" ~ '^[a-z_]+\.[a-z_]+$')
);

CREATE TRIGGER notification_preference_touch
  BEFORE UPDATE ON public.notification_preference
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- Urządzenia członków zespołu z włączonym Web Push. Bez org_id: urządzenie należy do osoby,
-- a powiadomienia z każdego warsztatu, w którym pracuje, trafiają na nie według jego ustawień.
-- Jeden adres push = jedno urządzenie = jedna osoba (po zalogowaniu kogoś innego przechodzi na niego).
CREATE TABLE public.push_subscription (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES public."user" ("id") ON DELETE CASCADE,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone,
  CONSTRAINT "push_subscription_endpoint_uq" UNIQUE ("endpoint"),
  CONSTRAINT "push_subscription_endpoint_check" CHECK ("endpoint" ~ '^https://')
);
CREATE INDEX "push_subscription_user_idx" ON public.push_subscription ("user_id");

-- ---------------------------------------------------------------------------
-- Powiadomienia klienta
-- ---------------------------------------------------------------------------

-- „Zarejestrowany telefon”: klient włączył powiadomienia na stronie statusu naprawy.
-- Push zastępuje SMS, dopóki numer w karcie klienta jest taki sam jak przy włączeniu (kolumna phone).
CREATE TABLE public.customer_push_subscription (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "customer_id" uuid NOT NULL,
  "phone" text,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_success_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "customer_push_subscription_org_id_uq" UNIQUE ("org_id", "id"),
  CONSTRAINT "customer_push_subscription_endpoint_uq" UNIQUE ("customer_id", "endpoint"),
  CONSTRAINT "customer_push_subscription_customer_fk" FOREIGN KEY ("org_id", "customer_id") REFERENCES public.customer ("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "customer_push_subscription_endpoint_check" CHECK ("endpoint" ~ '^https://')
);
CREATE INDEX "customer_push_subscription_customer_idx" ON public.customer_push_subscription ("org_id", "customer_id");

CREATE TRIGGER customer_push_subscription_touch
  BEFORE UPDATE ON public.customer_push_subscription
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- Dziennik wiadomości do klienta. Treść (z linkiem) jest tylko w zadaniu kolejki i znika po wysłaniu.
CREATE TABLE public.customer_notification (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES public.organization ("id") ON DELETE CASCADE,
  "work_order_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "approval_id" uuid,
  "event" text NOT NULL,
  "channel" text NOT NULL,
  "delivered_via" text,
  "recipient" text,
  "status" text DEFAULT 'queued' NOT NULL,
  "skip_reason" text,
  "trigger" text NOT NULL,
  "sent_by" uuid REFERENCES public."user" ("id") ON DELETE SET NULL,
  "error" text,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_notification_org_id_uq" UNIQUE ("org_id", "id"),
  CONSTRAINT "customer_notification_work_order_fk" FOREIGN KEY ("org_id", "work_order_id") REFERENCES public.work_order ("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "customer_notification_customer_fk" FOREIGN KEY ("org_id", "customer_id") REFERENCES public.customer ("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "customer_notification_approval_fk" FOREIGN KEY ("org_id", "approval_id") REFERENCES public.approval_request ("org_id", "id") ON DELETE SET NULL ("approval_id"),
  CONSTRAINT "customer_notification_event_check" CHECK ("event" IN ('order_received', 'order_ready', 'approval_request', 'estimate_request')),
  CONSTRAINT "customer_notification_channel_check" CHECK ("channel" IN ('phone', 'email')),
  CONSTRAINT "customer_notification_delivered_check" CHECK ("delivered_via" IS NULL OR "delivered_via" IN ('push', 'sms', 'email')),
  CONSTRAINT "customer_notification_status_check" CHECK ("status" IN ('queued', 'sent', 'failed', 'skipped')),
  CONSTRAINT "customer_notification_skip_check" CHECK (("status" = 'skipped') = ("skip_reason" IS NOT NULL) AND ("skip_reason" IS NULL OR "skip_reason" IN ('no_contact', 'opted_out'))),
  CONSTRAINT "customer_notification_sent_check" CHECK (("status" = 'sent') = ("sent_at" IS NOT NULL) AND ("status" <> 'sent' OR "delivered_via" IS NOT NULL)),
  CONSTRAINT "customer_notification_trigger_check" CHECK ("trigger" IN ('auto', 'manual'))
);
CREATE INDEX "customer_notification_order_idx" ON public.customer_notification ("org_id", "work_order_id", "created_at");

CREATE TRIGGER customer_notification_touch
  BEFORE UPDATE ON public.customer_notification
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- Link do strony statusu naprawy (jeden na zlecenie). Token wyliczamy z sekretu serwera (HMAC),
-- w bazie jest tylko jego skrót. Zmiana wersji unieważnia link wysłany wcześniej.
CREATE TABLE public.work_order_status_link (
  "work_order_id" uuid PRIMARY KEY NOT NULL,
  "org_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "first_viewed_at" timestamp with time zone,
  "last_viewed_at" timestamp with time zone,
  "view_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "work_order_status_link_token_hash_uq" UNIQUE ("token_hash"),
  CONSTRAINT "work_order_status_link_work_order_fk" FOREIGN KEY ("org_id", "work_order_id") REFERENCES public.work_order ("org_id", "id") ON DELETE CASCADE,
  CONSTRAINT "work_order_status_link_version_check" CHECK ("version" >= 1)
);

CREATE TRIGGER work_order_status_link_touch
  BEFORE UPDATE ON public.work_order_status_link
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notification', 'notification_preference', 'push_subscription', 'customer_push_subscription', 'customer_notification', 'work_order_status_link'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY system_all ON public.%I FOR ALL
         USING ((SELECT app.is_system()))
         WITH CHECK ((SELECT app.is_system()))', t);
  END LOOP;
  -- Dane klienta warsztatu: jak pozostałe tabele warsztatu.
  FOREACH t IN ARRAY ARRAY['customer_push_subscription', 'customer_notification', 'work_order_status_link'] LOOP
    EXECUTE format(
      'CREATE POLICY tenant_all ON public.%I FOR ALL
         USING (org_id = (SELECT app.current_org_id()) AND (SELECT app.is_current_org_member()))
         WITH CHECK (org_id = (SELECT app.current_org_id()) AND (SELECT app.is_current_org_member()))', t);
  END LOOP;
END;
$$;

-- Powiadomienie wywołuje zwykle ktoś inny niż odbiorca – każdy członek warsztatu może powiadomić innego członka.
CREATE POLICY tenant_insert ON public.notification
  FOR INSERT
  WITH CHECK (org_id = (SELECT app.current_org_id()) AND (SELECT app.is_current_org_member()));
-- Czytać, oznaczać jako przeczytane i usuwać można wyłącznie własne powiadomienia.
CREATE POLICY owner_select ON public.notification
  FOR SELECT
  USING (org_id = (SELECT app.current_org_id()) AND user_id = (SELECT app.current_user_id()) AND (SELECT app.is_current_org_member()));
CREATE POLICY owner_update ON public.notification
  FOR UPDATE
  USING (org_id = (SELECT app.current_org_id()) AND user_id = (SELECT app.current_user_id()) AND (SELECT app.is_current_org_member()))
  WITH CHECK (org_id = (SELECT app.current_org_id()) AND user_id = (SELECT app.current_user_id()) AND (SELECT app.is_current_org_member()));
CREATE POLICY owner_delete ON public.notification
  FOR DELETE
  USING (org_id = (SELECT app.current_org_id()) AND user_id = (SELECT app.current_user_id()) AND (SELECT app.is_current_org_member()));

-- Ustawienia kanałów: widoczne w obrębie warsztatu (rozsyłając powiadomienie, serwer sprawdza ustawienia odbiorców),
-- zmienia je wyłącznie sama osoba.
CREATE POLICY tenant_select ON public.notification_preference
  FOR SELECT
  USING (org_id = (SELECT app.current_org_id()) AND (SELECT app.is_current_org_member()));
CREATE POLICY owner_insert ON public.notification_preference
  FOR INSERT
  WITH CHECK (org_id = (SELECT app.current_org_id()) AND user_id = (SELECT app.current_user_id()) AND (SELECT app.is_current_org_member()));
CREATE POLICY owner_update ON public.notification_preference
  FOR UPDATE
  USING (org_id = (SELECT app.current_org_id()) AND user_id = (SELECT app.current_user_id()) AND (SELECT app.is_current_org_member()))
  WITH CHECK (org_id = (SELECT app.current_org_id()) AND user_id = (SELECT app.current_user_id()) AND (SELECT app.is_current_org_member()));
CREATE POLICY owner_delete ON public.notification_preference
  FOR DELETE
  USING (org_id = (SELECT app.current_org_id()) AND user_id = (SELECT app.current_user_id()) AND (SELECT app.is_current_org_member()));

-- Urządzenia push: każdy zarządza tylko swoimi (przejęcie urządzenia po zmianie konta robi serwer w kontekście systemowym).
CREATE POLICY owner_all ON public.push_subscription
  FOR ALL
  USING (user_id = (SELECT app.current_user_id()))
  WITH CHECK (user_id = (SELECT app.current_user_id()));
