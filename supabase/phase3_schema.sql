-- Phase 3: AI Log
-- Run in Supabase SQL editor after phase2_schema.sql

create table if not exists ai_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- weekly_plan | daily_focus | finance_summary | content_analysis | smart_batch | brain_dump | custom
  title text not null,
  response text not null,
  pinned boolean default false,
  dismissed boolean default false,
  created_at timestamptz default now()
);

alter table ai_log enable row level security;
-- Users can only access their own AI log entries
create policy "ai_log: own rows" on ai_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists ai_log_user_created on ai_log(user_id, created_at desc);
create index if not exists ai_log_user_pinned  on ai_log(user_id, pinned);
