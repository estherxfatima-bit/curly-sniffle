-- Kanban status for weekly tasks (separate from complete boolean so intermediate states work).
-- Values: 'open' | 'in_progress' | 'done'
alter table weekly_tasks add column if not exists wk_status text not null default 'open'
  check (wk_status in ('open', 'in_progress', 'done'));

-- Back-fill: anything already marked complete gets wk_status = 'done'
update weekly_tasks set wk_status = 'done' where complete = true and wk_status = 'open';
