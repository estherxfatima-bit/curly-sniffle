-- Phase 46: Habit time-of-day categories (AM / PM / Anytime).
--
-- Adds a purely organisational/display field to habits so they can be
-- grouped into "Morning" / "Anytime" / "Evening" sections on the Habits
-- page and the dashboard Today widget. This does NOT restrict when a
-- habit can be logged — it's metadata only.
--
-- Idempotent — safe to run multiple times. There is no automated
-- migration runner in this repo; run this manually against the Supabase
-- project.

alter table habits
  add column if not exists time_of_day text not null default 'anytime';

alter table habits
  drop constraint if exists habits_time_of_day_check;

alter table habits
  add constraint habits_time_of_day_check check (time_of_day in ('am', 'pm', 'anytime'));

comment on column habits.time_of_day is 'Organisational time-of-day category for display grouping only: am (morning), pm (evening/night), or anytime (default). Does not restrict logging.';
