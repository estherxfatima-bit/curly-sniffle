-- Store the previous week's notes when a task is carried forward,
-- so users can see what they wrote last time without losing it.
alter table weekly_tasks add column if not exists prev_notes text;
