-- Phase 11: Content Hub rebuild
-- - content_pillars table (editable pillar name/description for the Pillars tab)
-- - content_batches.filming_dates / locations (jsonb arrays for filming logistics)

create table if not exists content_pillars (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, key)
);

alter table content_pillars enable row level security;

create policy "own content_pillars" on content_pillars
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table content_batches add column if not exists filming_dates jsonb default '[]';
alter table content_batches add column if not exists locations jsonb default '[]';
