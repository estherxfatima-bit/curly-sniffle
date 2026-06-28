-- Phase 56: configurable SMS reminder lead time per debt (was hardcoded to
-- 3 days for every debt). Defaults to 3 so existing reminder behaviour is
-- unchanged until a user picks a different lead time.
--
-- Idempotent — safe to run multiple times. There is no automated migration
-- runner in this repo; run this manually against the Supabase project.

alter table debts add column if not exists due_reminder_lead_days integer not null default 3;
