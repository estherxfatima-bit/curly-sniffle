-- Phase 22: "Push forward" for weekly tasks and daily to-dos.
-- Weekly tasks can now be archived (instead of deleted) when pushed to next week.

alter table weekly_tasks
  add column if not exists archived boolean not null default false;

comment on column weekly_tasks.archived is 'Set true when this task has been pushed to next week — superseded by a carried_forward copy.';
