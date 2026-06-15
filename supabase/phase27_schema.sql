-- Phase 27: Notifications inbox.

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  source_id  text,
  read       boolean not null default false,
  created_at timestamptz default now()
);

alter table notifications enable row level security;
create policy "notifications: owner" on notifications for all using (auth.uid() = user_id);

-- Prevents the same nudge / reminder / streak-warning from being notified twice.
create unique index if not exists notifications_dedup on notifications(user_id, type, source_id);
