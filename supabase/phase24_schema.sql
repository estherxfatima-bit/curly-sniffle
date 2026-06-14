-- Phase 24: Goal task bucket.

alter table goals add column if not exists tasks jsonb not null default '[]';

comment on column goals.tasks is 'Task bucket: array of {id, text} items that can be pulled into the weekly plan or daily to-dos.';
