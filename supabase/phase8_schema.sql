-- Phase 8: Habit frequency settings, streak logic, and streak freezes
-- Run in Supabase SQL editor after previous schema files

-- Frequency settings
alter table habits add column if not exists frequency_type text not null default 'daily'; -- 'daily' | 'specific_days' | 'times_per_week'
alter table habits add column if not exists frequency_days jsonb default '[]'; -- e.g. ["Mon","Wed","Fri"], used when frequency_type = 'specific_days'
alter table habits add column if not exists frequency_count int; -- target count, used when frequency_type = 'times_per_week'

-- Streak freeze ("don't break the chain" forgiveness, one per habit per month)
alter table habits add column if not exists streak_freeze_used boolean not null default false;
alter table habits add column if not exists streak_freeze_reset_date date not null default date_trunc('month', now())::date;

-- Records which specific missed days were forgiven via a streak freeze
create table if not exists habit_freezes (
  id          uuid primary key default gen_random_uuid(),
  habit_id    uuid not null references habits(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  freeze_date date not null,
  created_at  timestamptz default now(),
  unique(habit_id, freeze_date)
);
comment on table habit_freezes is 'Days forgiven via a habit''s monthly streak freeze — the streak continues across these dates.';

alter table habit_freezes enable row level security;

-- Users can only access freezes for their own habits
create policy "habit_freezes: owner select" on habit_freezes
  for select using (auth.uid() = user_id);
create policy "habit_freezes: owner insert" on habit_freezes
  for insert with check (auth.uid() = user_id);
create policy "habit_freezes: owner delete" on habit_freezes
  for delete using (auth.uid() = user_id);

create index if not exists habit_freezes_habit on habit_freezes(habit_id);
