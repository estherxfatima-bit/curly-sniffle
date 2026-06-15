-- Phase 25: Daily quote/affirmation + weekly task priorities.

-- A daily equivalent of weekly_quotes — a quote/affirmation for a single day,
-- either the day's rotation entry or a custom one the user sets.
create table if not exists daily_quotes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  log_date   date not null,
  quote      text not null,
  updated_at timestamptz default now(),
  unique (user_id, log_date)
);
alter table daily_quotes enable row level security;
create policy "daily_quotes: owner" on daily_quotes
  for all using (auth.uid() = user_id);

-- Let users star a weekly task as one of this week's chosen priorities.
alter table weekly_tasks add column if not exists priority boolean not null default false;
comment on column weekly_tasks.priority is 'User-chosen top priority for the week — surfaced on the weekly dashboard.';
