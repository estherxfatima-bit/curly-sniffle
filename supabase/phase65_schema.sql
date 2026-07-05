-- Add description field to goals for richer goal context
alter table goals
  add column if not exists description text;
