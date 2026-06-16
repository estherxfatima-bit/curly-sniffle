-- ============================================================
-- Phase 38: work/personal hours separation, wellness routines,
-- body measurements, rest day, hydration reminder, mood tracking
-- ============================================================

-- Work days / personal-overlap settings on user_preferences
alter table user_preferences add column if not exists work_days jsonb not null default '["Mon","Tue","Wed","Thu","Fri"]'::jsonb;
alter table user_preferences add column if not exists allow_personal_overlap boolean not null default false;
alter table user_preferences add column if not exists overlap_days jsonb not null default '[]'::jsonb;
alter table user_preferences add column if not exists overlap_hours jsonb not null default '[]'::jsonb; -- [{"start":"12:00","end":"13:00"}]
alter table user_preferences add column if not exists weight_unit text not null default 'kg';
alter table user_preferences add column if not exists hydration_reminder_time text not null default '13:00';

-- weekly_tasks: scheduled_time used by "Time-block my day" on the Weekly page
alter table weekly_tasks add column if not exists scheduled_time text; -- 'HH:MM'

-- ============================================================
-- Wellness routines
-- ============================================================
create table if not exists wellness_routines (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users not null,
  name                text not null,
  last_done_date      date,
  frequency_value     int not null,
  frequency_unit      text not null, -- 'days' | 'weeks' | 'months'
  remind_days_before  int not null default 2,
  created_at          timestamptz default now()
);
alter table wellness_routines enable row level security;
drop policy if exists "wellness_routines: owner" on wellness_routines;
create policy "wellness_routines: owner" on wellness_routines using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Body measurements
-- ============================================================
create table if not exists body_measurements (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users not null,
  date                 date not null,
  weight               numeric,
  custom_measurements  jsonb default '{}'::jsonb,
  created_at           timestamptz default now()
);
alter table body_measurements enable row level security;
drop policy if exists "body_measurements: owner" on body_measurements;
create policy "body_measurements: owner" on body_measurements using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Mood tracking on wellness_logs (already unique on user_id, log_date)
-- ============================================================
alter table wellness_logs add column if not exists mood text;
alter table wellness_logs add column if not exists mood_emoji text;
