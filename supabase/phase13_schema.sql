-- Phase 13: Habit tracker — automatic streak freezes

alter table habits add column if not exists banked_freezes integer not null default 0;
alter table habits add column if not exists consecutive_days_count integer not null default 0;
alter table habits drop column if exists streak_freeze_used;
alter table habits drop column if exists streak_freeze_reset_date;
