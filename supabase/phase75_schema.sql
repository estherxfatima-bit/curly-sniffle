-- Store optional "what happened?" note when a weekly task is dismissed.
alter table weekly_tasks add column if not exists dismissed_reason text;
