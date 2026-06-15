-- Note for tomorrow: a free-text note written today, surfaced when viewing tomorrow.

create table if not exists daily_reflections (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  date                date not null,
  reflection_text     text,
  tomorrow_priorities jsonb default '[]',
  day_rating          int check (day_rating between 1 and 5),
  created_at          timestamptz default now(),
  unique(user_id, date)
);

alter table daily_reflections enable row level security;

drop policy if exists "daily_reflections: own rows" on daily_reflections;
create policy "daily_reflections: own rows" on daily_reflections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table daily_reflections
  add column if not exists note_for_tomorrow text;

comment on column daily_reflections.note_for_tomorrow is 'Free-text note written on this date, intended to be read the following day.';
