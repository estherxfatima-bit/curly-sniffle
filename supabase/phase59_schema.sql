-- Task backlog: a persistent store of tasks the user wants to do "some day"
-- rather than on a specific date. Populated from the carryover modal or manually.
create table if not exists task_backlog (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  text        text not null,
  category    text,
  goal_id     uuid references goals(id) on delete set null,
  source_date date,
  created_at  timestamptz default now()
);
alter table task_backlog enable row level security;
create policy "users manage own task backlog"
  on task_backlog for all using (auth.uid() = user_id);
