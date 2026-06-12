-- Phase 15: Habit tracker — Today/Week/Month views, per-habit colour

alter table habits add column if not exists color text;
