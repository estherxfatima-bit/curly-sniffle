-- Phase 10: Google Calendar integration
create table if not exists google_tokens (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade unique,
  access_token  text not null,
  refresh_token text,
  expires_at    timestamptz not null,
  google_email  text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table google_tokens enable row level security;

create policy "google_tokens: own rows" on google_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
