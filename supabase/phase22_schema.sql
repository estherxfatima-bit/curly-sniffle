-- Phase 22: "Push forward" for weekly tasks and daily to-dos.
-- Weekly tasks can now be archived (instead of deleted) when pushed to next week.

alter table weekly_tasks
  add column if not exists archived boolean not null default false;

comment on column weekly_tasks.archived is 'Set true when this task has been pushed to next week — superseded by a carried_forward copy.';

-- When a daily to-do linked to a weekly task is completed, auto-complete the weekly task too (on by default).
alter table user_preferences
  add column if not exists auto_complete_linked_tasks boolean not null default true;

comment on column user_preferences.auto_complete_linked_tasks is 'When true, completing a daily to-do with a weekly_task_ref_id also marks the linked weekly task complete.';
