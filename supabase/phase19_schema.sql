-- Phase 19: Enhanced daily to-dos — duration/time, weekly plan linking,
-- task timer (time_spent_minutes), and Google Calendar auto time-blocking.

alter table daily_todos
  add column if not exists duration_minutes  integer,
  add column if not exists scheduled_time    text, -- 'HH:MM', 24-hour
  add column if not exists time_spent_minutes integer not null default 0,
  add column if not exists weekly_task_ref_id uuid references weekly_tasks(id) on delete set null,
  add column if not exists google_event_id   text;

comment on column daily_todos.duration_minutes is 'Optional estimated duration in minutes, used for timers and auto time-blocking.';
comment on column daily_todos.scheduled_time is 'Optional specific time of day (HH:MM, 24-hour) — timed todos sort above untimed ones.';
comment on column daily_todos.time_spent_minutes is 'Cumulative minutes logged against this todo via the task timer.';
comment on column daily_todos.weekly_task_ref_id is 'Optional reference to the weekly_tasks row this todo was pulled from. The weekly task is independent and unaffected by this todo''s completion.';
comment on column daily_todos.google_event_id is 'Google Calendar event ID created by "Time-block my day", if any — used to update/delete the event if the todo changes.';

-- User preferences (working hours for auto time-blocking, etc.)
create table if not exists user_preferences (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid unique references auth.users(id) on delete cascade not null,
  working_hours_start text not null default '09:00', -- 'HH:MM', 24-hour
  working_hours_end   text not null default '19:00', -- 'HH:MM', 24-hour
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
comment on table user_preferences is 'Per-user app preferences, e.g. working hours used by "Time-block my day".';

alter table user_preferences enable row level security;
create policy "user_preferences: owner" on user_preferences for all using (auth.uid() = user_id);

-- Phase 19 note: google_tokens now requires the broader
-- https://www.googleapis.com/auth/calendar (read/write) scope instead of
-- calendar.readonly, so "Time-block my day" can create events. Existing
-- connected users must reconnect via Settings to grant the new scope —
-- their stored refresh_token will be replaced on reconsent.
