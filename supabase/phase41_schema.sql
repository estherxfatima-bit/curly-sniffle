-- Phase 41: Custom colours for daily to-do categories
--
-- Daily-todo categories were previously just free-text strings on daily_todos.category
-- with no dedicated table (defaults 'Work'/'Personal'/'Errands'/'Creative'/'Health' lived
-- only in client state). This adds a todo_categories table so each user can assign and
-- persist a custom colour per category, with full RLS.

create table if not exists todo_categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  colour text not null default '#1a4fff',
  created_at timestamptz default now(),
  unique (user_id, name)
);

alter table todo_categories enable row level security;

-- Users can only see their own categories
create policy "todo_categories: select own" on todo_categories
  for select using (auth.uid() = user_id);

-- Users can only create categories for themselves
create policy "todo_categories: insert own" on todo_categories
  for insert with check (auth.uid() = user_id);

-- Users can only update their own categories (e.g. change colour)
create policy "todo_categories: update own" on todo_categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Users can only delete their own categories
create policy "todo_categories: delete own" on todo_categories
  for delete using (auth.uid() = user_id);

create index if not exists todo_categories_user on todo_categories(user_id);
