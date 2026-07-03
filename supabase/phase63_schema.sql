-- Partner task assignments: assign a task to an accountability partner,
-- or create a joint task that both partners track independently.

create table if not exists partner_assignments (
  id              uuid primary key default gen_random_uuid(),
  from_user_id    uuid not null references auth.users(id) on delete cascade,
  to_user_id      uuid not null references auth.users(id) on delete cascade,
  text            text not null,
  note            text,
  due_date        date,
  is_joint        boolean not null default false,  -- if true, from_user also tracks their own completion
  complete_from   boolean not null default false,  -- from_user's completion (joint tasks only)
  complete_to     boolean not null default false,  -- to_user's completion
  created_at      timestamptz default now()
);

alter table partner_assignments enable row level security;

-- Assigner: full control over assignments they created
drop policy if exists "partner_assignments: assigner" on partner_assignments;
create policy "partner_assignments: assigner" on partner_assignments
  for all
  using (auth.uid() = from_user_id)
  with check (auth.uid() = from_user_id);

-- Assignee: can read and mark their own completion status
drop policy if exists "partner_assignments: assignee read" on partner_assignments;
create policy "partner_assignments: assignee read" on partner_assignments
  for select using (auth.uid() = to_user_id);

drop policy if exists "partner_assignments: assignee complete" on partner_assignments;
create policy "partner_assignments: assignee complete" on partner_assignments
  for update
  using (auth.uid() = to_user_id)
  with check (auth.uid() = to_user_id);
