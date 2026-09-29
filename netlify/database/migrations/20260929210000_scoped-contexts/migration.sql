-- OXY · węższe konteksty bazy zamiast kontekstu systemowego (przegląd architektury, pkt 3)
--
-- Dotąd endpointy publiczne (strona akceptacji, strona statusu) i część endpointów zalogowanej osoby
-- działały w kontekście systemowym (app.system = 'on'), który omija izolację warsztatów. Błąd w takim
-- miejscu (np. brakujący warunek WHERE) dotyczyłby wszystkich warsztatów. Teraz:
--
--  * withCustomerLink – klient z linku (bez konta): po odczytaniu tokenu serwer ustawia app.org_id i
--    app.customer_link na warsztat, do którego należy link. Polityki tenant_* przepuszczają wtedy tylko
--    ten jeden warsztat – tak jak dla jego członka, ale bez tożsamości użytkownika (app.user_id puste).
--  * withUser – rzeczy należące do osoby niezależnie od aktywnego warsztatu (urządzenia push, powiadomienia
--    ze wszystkich jej warsztatów): ustawia tylko app.user_id.
--  * withSystem – zostaje dla kolejki zadań, sprzątania, zakładania organizacji i samego odczytu tokenu.

CREATE FUNCTION app.customer_link_org() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.customer_link', true), '')::uuid $$;

-- Członek aktywnej organizacji ALBO klient z linku do tej właśnie organizacji (bez zalogowanego użytkownika).
-- Wszystkie polityki tenant_* korzystają z tej funkcji, więc link nigdy nie otworzy innego warsztatu.
CREATE OR REPLACE FUNCTION app.is_current_org_member() RETURNS boolean
  LANGUAGE sql STABLE
  AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public.member m
      WHERE m.organization_id = app.current_org_id()
        AND m.user_id = app.current_user_id()
    )
    OR (
      app.current_user_id() IS NULL
      AND app.customer_link_org() IS NOT NULL
      AND app.customer_link_org() = app.current_org_id()
    )
  $$;

-- Czy zalogowana osoba należy do wskazanej organizacji (konteksty bez aktywnego warsztatu).
CREATE FUNCTION app.is_member_of(p_org uuid) RETURNS boolean
  LANGUAGE sql STABLE
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.member m
      WHERE m.organization_id = p_org AND m.user_id = app.current_user_id()
    )
  $$;

-- Powiadomienia osoby ze wszystkich jej warsztatów (dzwonek „w innych warsztatach”, dotknięcie push
-- prowadzące do innego warsztatu). Tylko bez aktywnego warsztatu, żeby listy w panelu nadal widziały
-- wyłącznie bieżący warsztat; tylko warsztaty, do których osoba wciąż należy.
CREATE POLICY user_select ON public.notification
  FOR SELECT
  USING (
    (SELECT app.current_org_id()) IS NULL
    AND user_id = (SELECT app.current_user_id())
    AND app.is_member_of(org_id)
  );
CREATE POLICY user_update ON public.notification
  FOR UPDATE
  USING (
    (SELECT app.current_org_id()) IS NULL
    AND user_id = (SELECT app.current_user_id())
    AND app.is_member_of(org_id)
  )
  WITH CHECK (
    (SELECT app.current_org_id()) IS NULL
    AND user_id = (SELECT app.current_user_id())
    AND app.is_member_of(org_id)
  );

-- Włączenie push na urządzeniu: jedno urządzenie (adres push) należy do jednej osoby, więc po zalogowaniu
-- kogoś innego na tym samym telefonie subskrypcja przechodzi na niego. Cudzy wiersz jest niewidoczny w RLS,
-- dlatego przejęcie robi ta funkcja – z tożsamością wyłącznie z app.user_id i stałą, przejrzaną logiką.
CREATE FUNCTION app.claim_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text, p_max_devices integer
) RETURNS void
  LANGUAGE plpgsql
  AS $$
  DECLARE
    uid uuid := app.current_user_id();
    previous_system text := current_setting('app.system', true);
  BEGIN
    IF uid IS NULL THEN
      RAISE EXCEPTION 'claim_push_subscription: brak app.user_id' USING ERRCODE = 'insufficient_privilege';
    END IF;
    PERFORM set_config('app.system', 'on', true);
    INSERT INTO public.push_subscription (user_id, endpoint, p256dh, auth, user_agent)
    VALUES (uid, p_endpoint, p_p256dh, p_auth, p_user_agent)
    ON CONFLICT (endpoint) DO UPDATE
      SET user_id = uid, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
    DELETE FROM public.push_subscription
    WHERE user_id = uid AND id NOT IN (
      SELECT id FROM public.push_subscription WHERE user_id = uid
      ORDER BY coalesce(last_used_at, created_at) DESC
      LIMIT p_max_devices
    );
    PERFORM set_config('app.system', coalesce(previous_system, ''), true);
  END;
  $$;
