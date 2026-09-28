-- Konta demonstracyjne mechaników; hashe wygenerowane przez better-auth/crypto.
-- Nie zmieniamy hasła ani roli istniejących kont. Brak właściciela pomija demo.
DO $$
DECLARE
  owner_id uuid;
  orgs uuid[];
  target_org uuid;
  mechanic_id uuid;
  existing_id uuid;
  r record;
BEGIN
  SELECT id INTO owner_id FROM public."user" WHERE lower(email) = 'jablonsky97@gmail.com';
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
    (1, 'Adam Nowicki', 'mechanik1@demo.oxy.invalid', '535bd9c849fc5cc7cdb945e02249a973:5659e50c533c0bf2e2433e53faaf924a29f5920c797ac540e7c8b0d3db0d69cc1f9cb054c2a9c0bddb643926346a5e847a7c186bfdd63beea69489353e508e34'),
    (2, 'Paweł Zieliński', 'mechanik2@demo.oxy.invalid', '4af72829640cb1f0d4d400eacd4ee06e:3e095432e82805b423251adcc187839d43ef428085b99d6b919d46ee3eb3505c3ec0e7752df9224234bcc5902e6098d56998eb1286501ac470e41ba689f3df78'),
    (3, 'Michał Dąbrowski', 'mechanik3@demo.oxy.invalid', 'e672aa96ae49b6c9cbd2c65faa9ad16e:b7aa3239c4f57b991681913fbdffc05a245a769e08928feae04b928d0678c5623eb36f8551841718047245813981766a14bdd91a5ea59bde6cd3cead6948a6c2')
  ) AS demo(n, name, email, password_hash)
  LOOP
    mechanic_id := md5('oxy.demo-mechanics:' || target_org || ':user:' || r.n)::uuid;
    SELECT id INTO existing_id FROM public."user" WHERE lower(email) = r.email;
    IF existing_id IS NOT NULL AND existing_id <> mechanic_id THEN
      RAISE EXCEPTION 'Adres % jest już zajęty przez inne konto.', r.email;
    END IF;
    -- Ponowne wykonanie zachowuje także późniejsze zmiany adresu, hasła i członkostwa.
    IF EXISTS (SELECT 1 FROM public."user" WHERE id = mechanic_id) THEN
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
