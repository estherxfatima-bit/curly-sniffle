-- Phase 61: one-off expense flag + budget defaults + ensure priority column
-- Run in the Supabase SQL editor.

-- 1. One-off expenses (moving costs, large irregular purchases) — excluded from
--    category budget comparisons so they don't skew the monthly averages.
alter table variable_expenses
  add column if not exists is_one_off boolean not null default false;

comment on column variable_expenses.is_one_off is
  'True for large one-off purchases (moving costs, etc.) that are tracked but excluded from monthly budget calculations.';

-- 2. Budget defaults — a special month_year = ''default'' row acts as the
--    template for new months. The app copies it when a month has no budgets yet.
--    No schema change needed; the budgets table already accepts any string for
--    month_year. This comment documents the convention.

-- 3. Ensure the weekly_tasks.priority column exists (in case phase25 was not run).
alter table weekly_tasks
  add column if not exists priority boolean not null default false;

comment on column weekly_tasks.priority is
  'User-chosen top priority for the week — surfaced as the One Priority card on the daily dashboard.';
