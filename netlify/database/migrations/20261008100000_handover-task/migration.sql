-- OXY · zadanie „Wydanie auta”
--
-- Gdy wszystkie zadania zlecenia są zrobione, aplikacja dokłada do zlecenia zadanie wydania pojazdu klientowi
-- (kind = 'handover'). Zadanie systemowe odróżniamy od zadań roboczych (kind = 'work'), bo nie liczy się do postępu
-- prac, nie uruchamia powiadomienia „wszystkie zadania zakończone” i nie trafia do listy zadań do wzięcia.

ALTER TABLE public.task
  ADD COLUMN "kind" text NOT NULL DEFAULT 'work',
  ADD CONSTRAINT "task_kind_check" CHECK ("kind" IN ('work', 'handover')),
  -- wydanie jest zadaniem głównym: podzadania mają sens tylko przy pracach
  ADD CONSTRAINT "task_handover_top_level_check" CHECK ("kind" <> 'handover' OR "parent_id" IS NULL);

-- Jedno wydanie na zlecenie; chroni też przed dwoma równoległymi zakończeniami ostatniego zadania.
CREATE UNIQUE INDEX "task_handover_per_order_uq" ON public.task ("work_order_id") WHERE "kind" = 'handover';

-- Otwarte zlecenia, w których wszystkie zadania są już zrobione, też dostają zadanie wydania.
-- Tabela ma FORCE RLS, więc na czas migracji włączamy kontekst systemowy (tylko w tej transakcji).
DO $$
DECLARE
  previous_system text := current_setting('app.system', true);
BEGIN
  PERFORM set_config('app.system', 'on', true);

  INSERT INTO public.task ("org_id", "work_order_id", "kind", "title", "position")
  SELECT wo.org_id, wo.id, 'handover', 'Wydanie auta',
         coalesce((SELECT max(t.position) + 1 FROM public.task t WHERE t.work_order_id = wo.id AND t.parent_id IS NULL), 0)
  FROM public.work_order wo
  WHERE wo.status NOT IN ('closed', 'cancelled')
    AND EXISTS (SELECT 1 FROM public.task t WHERE t.work_order_id = wo.id AND t.kind = 'work' AND t.status <> 'cancelled')
    AND NOT EXISTS (SELECT 1 FROM public.task t WHERE t.work_order_id = wo.id AND t.kind = 'work' AND t.status NOT IN ('cancelled', 'done'))
    AND NOT EXISTS (SELECT 1 FROM public.task t WHERE t.work_order_id = wo.id AND t.kind = 'handover');

  PERFORM set_config('app.system', coalesce(previous_system, ''), true);
END;
$$;
