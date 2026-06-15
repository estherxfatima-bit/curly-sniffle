-- Savings & investments allocations, and hideable budget categories.

create table if not exists savings_allocations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  amount      numeric(12,2) not null default 0,
  frequency   text not null default 'monthly', -- monthly, weekly, annual, one-off
  kind        text not null default 'Savings', -- Savings, Investment
  created_at  timestamptz default now()
);

alter table savings_allocations enable row level security;
create policy "savings_allocations: owner" on savings_allocations for all using (auth.uid() = user_id);

alter table user_preferences
  add column if not exists hidden_budget_categories jsonb not null default '[]'::jsonb;

comment on column user_preferences.hidden_budget_categories is 'Variable-expense categories hidden from the Category budgets card.';
