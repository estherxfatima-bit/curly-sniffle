-- Phase 4: Finance tracker tables

create table if not exists income_sources (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  name            text not null,
  amount          numeric(12,2) not null default 0,
  frequency       text not null default 'monthly', -- monthly, weekly, annual, one-off
  is_self_employed boolean not null default false,
  created_at      timestamptz default now()
);

create table if not exists fixed_expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  amount      numeric(12,2) not null default 0,
  category    text not null default 'Other',
  created_at  timestamptz default now()
);

create table if not exists variable_expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  amount      numeric(12,2) not null default 0,
  category    text not null default 'Other',
  date        date not null default current_date,
  created_at  timestamptz default now()
);

-- RLS
alter table income_sources    enable row level security;
alter table fixed_expenses     enable row level security;
alter table variable_expenses  enable row level security;

create policy "income_sources: owner"   on income_sources   for all using (auth.uid() = user_id);
create policy "fixed_expenses: owner"   on fixed_expenses   for all using (auth.uid() = user_id);
create policy "variable_expenses: owner" on variable_expenses for all using (auth.uid() = user_id);
