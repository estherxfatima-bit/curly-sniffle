-- Phase 57: goal milestones, task-to-milestone linking, and a completion
-- date on tasks separate from their assigned day.
--
-- - `milestones`: checkpoints under a goal, used to track progress more
--   accurately than "% of linked tasks done" alone.
-- - `weekly_tasks.milestone_id` / `daily_todos.milestone_id`: optionally
--   link a goal-linked task to one of that goal's milestones.
-- - `weekly_tasks.completed_on` / `daily_todos.completed_on`: the date a
--   task was actually completed, which may be later than the day it was
--   assigned to — lets completing a task late attribute it to the right day.
--
-- Idempotent — safe to run multiple times. There is no automated migration
-- runner in this repo; run this manually against the Supabase project.

create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  title text not null,
  target_date date,
  complete boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table milestones enable row level security;

drop policy if exists "milestones: own rows" on milestones;
create policy "milestones: own rows" on milestones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table weekly_tasks add column if not exists milestone_id uuid references milestones(id) on delete set null;
alter table daily_todos  add column if not exists milestone_id uuid references milestones(id) on delete set null;

alter table weekly_tasks add column if not exists completed_on date;
alter table daily_todos  add column if not exists completed_on date;
