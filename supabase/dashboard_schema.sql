-- Dashboard card ordering per view
create table if not exists dashboard_layout (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  view       text not null, -- daily | weekly | monthly | quarterly
  card_order jsonb not null default '[]',
  updated_at timestamptz default now(),
  unique (user_id, view)
);
alter table dashboard_layout enable row level security;
create policy "dashboard_layout: owner" on dashboard_layout
  for all using (auth.uid() = user_id);

-- Weekly quotes / affirmations
create table if not exists weekly_quotes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  week_start date not null,
  quote      text not null,
  updated_at timestamptz default now(),
  unique (user_id, week_start)
);
alter table weekly_quotes enable row level security;
create policy "weekly_quotes: owner" on weekly_quotes
  for all using (auth.uid() = user_id);

-- Quarterly notes: wins, books, parking-lot ideas
create table if not exists quarterly_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  quarter     text not null,
  wins        jsonb not null default '[]',
  books       jsonb not null default '[]',
  parking_lot jsonb not null default '[]',
  updated_at  timestamptz default now(),
  unique (user_id, quarter)
);
alter table quarterly_notes enable row level security;
create policy "quarterly_notes: owner" on quarterly_notes
  for all using (auth.uid() = user_id);

-- Image URL on profiles (dashboard moodboard)
alter table profiles add column if not exists image_url text;

-- Supabase storage: dashboard-images bucket
insert into storage.buckets (id, name, public)
  values ('dashboard-images', 'dashboard-images', true)
  on conflict (id) do nothing;

create policy "dashboard-images: auth upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'dashboard-images');

create policy "dashboard-images: owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'dashboard-images' and owner = auth.uid());

create policy "dashboard-images: public read"
  on storage.objects for select
  using (bucket_id = 'dashboard-images');
