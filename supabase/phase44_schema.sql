-- Phase 44: Fix daily reflection nudge not persisting.
--
-- Root cause: the reflection nudge columns were defined in phase23_schema.sql
-- (added alongside the Settings UI and the /api/cron/daily-reflection cron job),
-- but this repo has no automated migration runner — phase23_schema.sql was
-- never actually applied to the live database. As a result, the
-- `reflection_enabled` / `reflection_time` / `reflection_method` /
-- `reflection_last_sent` columns on user_preferences don't exist, so every
-- save from SettingsPage.jsx's saveReflection() silently fails to persist and
-- the load in loadWorkingHours() always reads back the defaults.
--
-- This migration re-asserts those columns (idempotent — safe to run even if
-- phase23_schema.sql was partially applied). Run this manually against the
-- Supabase project; there is no automated migration runner in this repo.

alter table user_preferences
  add column if not exists reflection_enabled boolean not null default false,
  add column if not exists reflection_time     text not null default '20:00', -- 'HH:MM', 24-hour
  add column if not exists reflection_method   text not null default 'push',  -- 'push' | 'sms' | 'both'
  add column if not exists reflection_last_sent date;

comment on column user_preferences.reflection_enabled is 'Whether the daily reflection nudge cron should notify this user.';
comment on column user_preferences.reflection_time is 'Local time (HH:MM, 24-hour) to send the daily reflection nudge.';
comment on column user_preferences.reflection_method is 'Delivery method for the daily reflection nudge: push, sms, or both.';
comment on column user_preferences.reflection_last_sent is 'Date the reflection nudge was last sent — prevents duplicate sends within the same day.';
