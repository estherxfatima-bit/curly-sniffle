-- Add completion_note to daily_todos so users can jot a note when they tick something off.
alter table daily_todos add column if not exists completion_note text;
