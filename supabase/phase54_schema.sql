-- Phase 54: pending-confirmation state for SMS calendar add/remove — Claude
-- never writes a calendar event straight from a text; it parses the
-- request, replies with what it understood, and only acts once the user
-- texts back YES (or a number, for disambiguating between several matches).
--
-- Idempotent — safe to run multiple times. There is no automated migration
-- runner in this repo; run this manually against the Supabase project.

create table if not exists sms_pending_actions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  action_type text not null, -- 'calendar_add' | 'calendar_remove' | 'calendar_remove_select'
  payload     jsonb not null,
  created_at  timestamptz default now(),
  expires_at  timestamptz not null
);
alter table sms_pending_actions enable row level security;
drop policy if exists "sms_pending_actions: owner" on sms_pending_actions;
create policy "sms_pending_actions: owner" on sms_pending_actions
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
