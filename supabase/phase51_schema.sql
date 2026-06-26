-- Money owed to me — track amounts other people owe the user, optionally
-- factored into take-home/savings-rate as pending income until settled.
create table if not exists money_owed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  person text not null,
  amount numeric(12,2) not null default 0,
  note text,
  date date not null default current_date,
  settled boolean not null default false,
  settled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table money_owed enable row level security;
drop policy if exists "money_owed: owner" on money_owed;
create policy "money_owed: owner" on money_owed using (auth.uid() = user_id) with check (auth.uid() = user_id);
