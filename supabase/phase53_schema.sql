-- Phase 53: recurring monthly due-day for debts (minimum payment reminders
-- over SMS), separate from the existing one-off target_payoff_date.
--
-- Idempotent — safe to run multiple times. There is no automated migration
-- runner in this repo; run this manually against the Supabase project.

alter table debts add column if not exists due_day integer; -- 1-31, day of month minimum payment is due
alter table debts add column if not exists last_due_reminder_sent date; -- dedupes the SMS reminder per due cycle

-- debts already has owner-only RLS from phase37_schema.sql, so these new
-- columns are automatically covered.
