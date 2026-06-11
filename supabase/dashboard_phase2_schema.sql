-- Dashboard Phase 2: Currently Reading / Books, Bucket List, Quarterly Wins, Idea Parking Lot

-- Books (Currently Reading + read archive)
create table if not exists books (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  ol_key      text,
  title       text not null,
  author      text,
  cover_url   text,
  status      text not null default 'reading', -- reading | paused | completed
  quarter     text,
  started_at  date default current_date,
  finished_at date,
  created_at  timestamptz default now()
);
alter table books enable row level security;
create policy "books: owner" on books
  for all using (auth.uid() = user_id);

-- Bucket list
create table if not exists bucket_list (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  category     text not null, -- Travel | Experience | Career | Personal | Health | Creative | Financial | Other
  title        text not null,
  complete     boolean not null default false,
  completed_at date,
  created_at   timestamptz default now()
);
alter table bucket_list enable row level security;
create policy "bucket_list: owner" on bucket_list
  for all using (auth.uid() = user_id);

-- Quarterly wins
create table if not exists quarterly_wins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  quarter    text not null, -- e.g. "Q2 2026"
  text       text not null,
  created_at timestamptz default now()
);
alter table quarterly_wins enable row level security;
create policy "quarterly_wins: owner" on quarterly_wins
  for all using (auth.uid() = user_id);

-- Idea parking lot
create table if not exists idea_parking_lot (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  text       text not null,
  category   text,
  link       text,
  acted_on   boolean not null default false,
  created_at timestamptz default now()
);
alter table idea_parking_lot enable row level security;
create policy "idea_parking_lot: owner" on idea_parking_lot
  for all using (auth.uid() = user_id);
