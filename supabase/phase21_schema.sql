-- Phase 21: per-day daily to-do navigation + weekly task day allocation
-- - Daily to-dos page can now view/add to-dos for any date (not just today).
-- - Weekly tasks can optionally be allocated to a specific day of the week,
--   which surfaces them when pulling from the weekly plan on that day.

alter table weekly_tasks
  add column if not exists day_of_week smallint check (day_of_week between 0 and 6); -- 0 = Monday ... 6 = Sunday

comment on column weekly_tasks.day_of_week is 'Optional day this task is allocated to within its week (0=Mon..6=Sun). Surfaces the task when pulling from the weekly plan on that day.';
