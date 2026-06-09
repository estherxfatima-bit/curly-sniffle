-- Phase 2: Daily to-do list
-- Run in Supabase SQL editor after schema.sql

create table if not exists daily_todos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  complete boolean default false,
  category text default 'Personal',
  time_allocation text, -- e.g. '30 mins', '1 hour'
  subtasks jsonb default '[]', -- [{ id, text, complete }]
  date date not null default current_date,
  carried_from date, -- set when carried over from a previous day
  archived boolean default false,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table daily_todos enable row level security;
-- Users can only access their own daily todos
create policy "daily_todos: own rows" on daily_todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists daily_todos_user_date on daily_todos(user_id, date);
