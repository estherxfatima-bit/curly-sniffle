-- Allow weekly tasks to be dismissed (dealt with outside the app, no carry-forward needed).
alter table weekly_tasks add column if not exists dismissed boolean default false;
