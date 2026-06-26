-- Phase 49: AI usage tracking and admin visibility.
--
-- Idempotent — safe to run multiple times. There is no automated migration
-- runner in this repo; run this manually against the Supabase project.

alter table ai_log add column if not exists input_tokens integer;
alter table ai_log add column if not exists output_tokens integer;
alter table ai_log add column if not exists estimated_cost numeric;

alter table profiles add column if not exists ai_enabled boolean default true;
alter table profiles add column if not exists is_admin boolean default false;

-- Let admins read every user's ai_log / profile row, for the admin usage page.
-- Non-admin users are unaffected — they keep their existing "own row" policies.
drop policy if exists "ai_log: admin read all" on ai_log;
create policy "ai_log: admin read all" on ai_log for select
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

drop policy if exists "profiles: admin read all" on profiles;
create policy "profiles: admin read all" on profiles for select
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin = true));

-- After deploying, manually set your own account as admin, e.g.:
-- update profiles set is_admin = true where email = 'estheras97@gmail.com';
