-- Phase 5: Wellness tables

create table if not exists workout_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  log_date    date not null default current_date,
  type        text not null default 'Gym',
  notes       text,
  duration_min int,
  created_at  timestamptz default now()
);

create table if not exists meal_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  week_start  date not null,
  day_index   int not null,  -- 0=Mon ... 6=Sun
  slot        text not null, -- breakfast, lunch, dinner
  meal        text not null default '',
  created_at  timestamptz default now(),
  unique (user_id, week_start, day_index, slot)
);

create table if not exists grocery_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  text        text not null,
  checked     boolean not null default false,
  archived    boolean not null default false,
  created_at  timestamptz default now()
);

create table if not exists wellness_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  log_date     date not null default current_date,
  hydration_ml int not null default 0,
  sleep_hours  numeric(4,1),
  sleep_quality int, -- 1-5
  notes        text,
  created_at   timestamptz default now(),
  unique (user_id, log_date)
);

-- RLS
alter table workout_logs  enable row level security;
alter table meal_plans    enable row level security;
alter table grocery_items enable row level security;
alter table wellness_logs enable row level security;

create policy "workout_logs: owner"  on workout_logs  for all using (auth.uid() = user_id);
create policy "meal_plans: owner"    on meal_plans    for all using (auth.uid() = user_id);
create policy "grocery_items: owner" on grocery_items for all using (auth.uid() = user_id);
create policy "wellness_logs: owner" on wellness_logs for all using (auth.uid() = user_id);
