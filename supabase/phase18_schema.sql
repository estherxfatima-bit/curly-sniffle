-- Phase 18: Finance budgets — overall + per-category monthly limits

create table if not exists budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  category    text, -- null = overall monthly spending limit; otherwise a variable expense category
  amount      numeric(12,2) not null default 0,
  month_year  text not null, -- 'YYYY-MM'
  created_at  timestamptz default now()
);
comment on table budgets is 'Per-month spending limits — one row with category=null for the overall limit, one row per variable expense category.';
comment on column budgets.category is 'Variable expense category this budget applies to, or null for the overall monthly limit.';
comment on column budgets.month_year is 'Month the budget applies to, formatted YYYY-MM.';

-- Only one overall budget and one per-category budget per user per month
create unique index if not exists budgets_unique_overall  on budgets(user_id, month_year) where category is null;
create unique index if not exists budgets_unique_category on budgets(user_id, category, month_year) where category is not null;

alter table budgets enable row level security;

create policy "budgets: owner" on budgets for all using (auth.uid() = user_id);
