-- Phase 50: fix infinite recursion in the phase49 admin RLS policies.
--
-- The "profiles: admin read all" policy queried `profiles` from inside a
-- policy defined ON `profiles`, which Postgres flags as infinite recursion
-- (the inner query re-triggers RLS evaluation on the same table). Move the
-- is_admin check into a SECURITY DEFINER function, which runs with the
-- privileges of its owner and so bypasses RLS entirely — safe here because
-- it only ever returns a boolean, never row data.
--
-- Idempotent — safe to run multiple times. There is no automated migration
-- runner in this repo; run this manually against the Supabase project.

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

drop policy if exists "ai_log: admin read all" on ai_log;
create policy "ai_log: admin read all" on ai_log for select
  using (is_admin());

drop policy if exists "profiles: admin read all" on profiles;
create policy "profiles: admin read all" on profiles for select
  using (is_admin());
