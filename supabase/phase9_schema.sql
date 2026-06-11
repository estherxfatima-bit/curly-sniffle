-- Phase 9: Weekly plan improvements — subtasks and time allocation on weekly tasks
alter table weekly_tasks add column if not exists subtasks jsonb default '[]';
alter table weekly_tasks add column if not exists time_allocation text;
