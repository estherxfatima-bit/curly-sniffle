-- Phase 7: Goals year/quarter/task hierarchy + tracking types
-- Run in Supabase SQL editor after previous schema files

-- Extend goals with tracking type + manual metric definition
alter table goals add column if not exists tracking_type text not null default 'tasks'; -- 'tasks' | 'metric'
alter table goals add column if not exists metric_name text;     -- e.g. "TikTok followers"
alter table goals add column if not exists metric_start numeric; -- starting value
alter table goals add column if not exists metric_target numeric; -- target value
alter table goals add column if not exists updated_at timestamptz default now();

-- Historical values for manual-metric goals, plotted as a line chart
create table if not exists goal_metrics (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references goals(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  value       numeric not null,
  recorded_at timestamptz default now()
);
comment on table goal_metrics is 'Timestamped manual readings for "manual metric" goals, used to chart progress over time.';

alter table goal_metrics enable row level security;

-- Users can only access metric history for their own goals
create policy "goal_metrics: owner select" on goal_metrics
  for select using (auth.uid() = user_id);
create policy "goal_metrics: owner insert" on goal_metrics
  for insert with check (auth.uid() = user_id);
create policy "goal_metrics: owner update" on goal_metrics
  for update using (auth.uid() = user_id);
create policy "goal_metrics: owner delete" on goal_metrics
  for delete using (auth.uid() = user_id);

create index if not exists goal_metrics_goal_recorded on goal_metrics(goal_id, recorded_at);

-- Allow daily to-dos to be linked to a goal, same as weekly_tasks.goal_id
alter table daily_todos add column if not exists goal_id uuid references goals(id) on delete set null;

-- quarterly_wins and idea_parking_lot already exist (see dashboard_phase2_schema.sql)
-- with the columns/RLS described in this phase's spec — no changes needed.
