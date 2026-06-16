-- Debt tracker
create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  category text not null default 'Other', -- 'Credit Card' | 'Loan' | 'Overdraft' | 'Borrowing' | 'Other'
  current_balance numeric(12,2) not null default 0,
  original_balance numeric(12,2),
  interest_rate numeric(6,3),
  minimum_payment numeric(10,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table debts enable row level security;
drop policy if exists "debts: owner" on debts;
create policy "debts: owner" on debts using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists debt_repayments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  debt_id uuid references debts on delete cascade not null,
  amount numeric(10,2) not null,
  date date not null default current_date,
  note text,
  created_at timestamptz default now()
);
alter table debt_repayments enable row level security;
drop policy if exists "debt_repayments: owner" on debt_repayments;
create policy "debt_repayments: owner" on debt_repayments using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Savings accounts / pots
create table if not exists savings_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  current_balance numeric(12,2) not null default 0,
  target_amount numeric(12,2),
  target_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table savings_accounts enable row level security;
drop policy if exists "savings_accounts: owner" on savings_accounts;
create policy "savings_accounts: owner" on savings_accounts using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists savings_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  account_id uuid references savings_accounts on delete cascade not null,
  balance numeric(12,2) not null,
  date date not null default current_date,
  created_at timestamptz default now()
);
alter table savings_updates enable row level security;
drop policy if exists "savings_updates: owner" on savings_updates;
create policy "savings_updates: owner" on savings_updates using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Investments
create table if not exists investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  type text not null default 'Other', -- 'ISA' | 'Pension' | 'Stocks' | 'Other'
  current_value numeric(12,2) not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table investments enable row level security;
drop policy if exists "investments: owner" on investments;
create policy "investments: owner" on investments using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists investment_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  investment_id uuid references investments on delete cascade not null,
  value numeric(12,2) not null,
  date date not null default current_date,
  created_at timestamptz default now()
);
alter table investment_updates enable row level security;
drop policy if exists "investment_updates: owner" on investment_updates;
create policy "investment_updates: owner" on investment_updates using (auth.uid() = user_id) with check (auth.uid() = user_id);
