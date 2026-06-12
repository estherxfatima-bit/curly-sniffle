-- Phase 14: Wellness rebuild — drop sleep log, add wellness goals section,
-- rebuild meal plan + grocery list with freeform/archive support

-- Sleep log removed entirely
alter table wellness_logs drop column if exists sleep_hours;
alter table wellness_logs drop column if exists sleep_quality;

-- Old structured meal plan / grocery tables replaced
drop table if exists meal_plans;
drop table if exists grocery_items;

create table if not exists meal_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  week_start  date not null,
  days        jsonb not null default '{}'::jsonb, -- keyed by day name: Monday..Sunday
  prep_notes  text not null default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id, week_start)
);

create table if not exists grocery_lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  week_start  date not null,
  items       jsonb not null default '[]'::jsonb, -- array of {text, checked}
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id, week_start)
);

create table if not exists meal_plan_archive (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null,
  week_start   date not null,
  days         jsonb not null default '{}'::jsonb,
  prep_notes   text not null default '',
  archived_at  timestamptz default now()
);

create table if not exists grocery_list_archive (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null,
  week_start   date not null,
  items        jsonb not null default '[]'::jsonb,
  archived_at  timestamptz default now()
);

alter table meal_plans          enable row level security;
alter table grocery_lists       enable row level security;
alter table meal_plan_archive   enable row level security;
alter table grocery_list_archive enable row level security;

create policy "meal_plans: owner"           on meal_plans           for all using (auth.uid() = user_id);
create policy "grocery_lists: owner"        on grocery_lists        for all using (auth.uid() = user_id);
create policy "meal_plan_archive: owner"    on meal_plan_archive    for all using (auth.uid() = user_id);
create policy "grocery_list_archive: owner" on grocery_list_archive for all using (auth.uid() = user_id);
