-- Phase 26: Recurring weekly tasks.

-- A task marked recurring is automatically re-created for the following
-- week (once) when the weekly plan is opened for the current week.
alter table weekly_tasks add column if not exists recurring boolean not null default false;
comment on column weekly_tasks.recurring is 'If true, this task is automatically re-created in the following week.';
