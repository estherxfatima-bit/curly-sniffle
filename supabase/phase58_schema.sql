-- Phase 58: goals restructure.
--
-- - Tracking types are now explicit per level: quarterly goals are
--   'metric' or 'milestone'; yearly goals are 'metric' or 'theme'.
--   The old 'tasks' (linked-task) tracking mode is retired — progress no
--   longer comes from weekly_tasks/daily_todos linked to a goal.
-- - `metric_current` / `metric_unit` replace `metric_start` for the manual
--   metric flow (current value vs target, with overshoot allowed).
-- - `level` records 'yearly' | 'quarterly', backfilled from `quarter`.
-- - `milestone_tasks`: lightweight supporting checklist items that belong
--   to a milestone (not the old goal-level "task bucket", and not
--   weekly_tasks/daily_todos). Completing them does not auto-complete the
--   milestone — the user still checks that off manually.
--
-- Idempotent — safe to run multiple times. There is no automated migration
-- runner in this repo; run this manually against the Supabase project.

alter table goals add column if not exists level text;
update goals set level = case when quarter = 'Year' then 'yearly' else 'quarterly' end where level is null;

alter table goals add column if not exists metric_current numeric;
update goals set metric_current = metric_start where metric_current is null and metric_start is not null;

alter table goals add column if not exists metric_unit text;

-- Old 'tasks' goals become 'milestone' (quarterly) or 'theme' (yearly) —
-- the closest equivalent now that linked-task progress is gone.
update goals set tracking_type = case when level = 'yearly' then 'theme' else 'milestone' end
  where tracking_type = 'tasks';

create table if not exists milestone_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone_id uuid not null references milestones(id) on delete cascade,
  text text not null,
  complete boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table milestone_tasks enable row level security;

drop policy if exists "milestone_tasks: own rows" on milestone_tasks;
create policy "milestone_tasks: own rows" on milestone_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
