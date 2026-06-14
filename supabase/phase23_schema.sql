-- Phase 23: Daily reflection nudge.

create table if not exists daily_reflections (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  date                date not null,
  reflection_text     text,
  tomorrow_priorities jsonb default '[]',
  day_rating          int check (day_rating between 1 and 5),
  created_at          timestamptz default now(),
  unique(user_id, date)
);

alter table daily_reflections enable row level security;
create policy "daily_reflections: own rows" on daily_reflections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Settings for the daily reflection nudge.
alter table user_preferences
  add column if not exists reflection_enabled boolean not null default false,
  add column if not exists reflection_time     text not null default '20:00', -- 'HH:MM', 24-hour
  add column if not exists reflection_method   text not null default 'push',  -- 'push' | 'sms' | 'both'
  add column if not exists reflection_last_sent date;

comment on column user_preferences.reflection_enabled is 'Whether the daily reflection nudge cron should notify this user.';
comment on column user_preferences.reflection_time is 'Local time (HH:MM, 24-hour) to send the daily reflection nudge.';
comment on column user_preferences.reflection_method is 'Delivery method for the daily reflection nudge: push, sms, or both.';
comment on column user_preferences.reflection_last_sent is 'Date the reflection nudge was last sent — prevents duplicate sends within the same day.';

-- Pinned priorities surfaced at the top of the daily to-do list (e.g. from the reflection's "tomorrow's priorities").
alter table daily_todos
  add column if not exists pinned boolean not null default false;

comment on column daily_todos.pinned is 'Pinned to-dos (e.g. tomorrow''s priorities from a daily reflection) are shown first.';
