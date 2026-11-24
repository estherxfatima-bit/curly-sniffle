-- Add notes field to daily_todos
alter table daily_todos add column if not exists notes text;
