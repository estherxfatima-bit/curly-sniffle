-- Phase 55: backfill columns on debts/savings_accounts/investments that were
-- defined via `create table if not exists` in phase37_schema.sql. That
-- pattern is a no-op against an already-existing table, so any of these
-- tables created before a given column was added to the file never got it.
--
-- Idempotent — safe to run multiple times. There is no automated migration
-- runner in this repo; run this manually against the Supabase project.

alter table savings_accounts add column if not exists starting_balance numeric(12,2) not null default 0;

alter table investments add column if not exists starting_value numeric(12,2) not null default 0;

alter table debts add column if not exists original_balance numeric(12,2);
alter table debts add column if not exists interest_rate numeric(6,3);
alter table debts add column if not exists minimum_payment numeric(10,2);
alter table debts add column if not exists target_payoff_date date;
alter table debts add column if not exists target_monthly_payment numeric(10,2);
alter table debts add column if not exists warning_threshold numeric(12,2);

-- All three tables already have owner-only RLS from phase37_schema.sql, so
-- these new columns are automatically covered.
