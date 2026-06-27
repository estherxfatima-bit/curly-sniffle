-- Phase 52: multi-user Twilio SMS — phone number + SMS briefing opt-in live on
-- the profiles row instead of a single hardcoded MY_PHONE_NUMBER env var.
--
-- Idempotent — safe to run multiple times. There is no automated migration
-- runner in this repo; run this manually against the Supabase project.

alter table profiles add column if not exists phone_number text;
alter table profiles add column if not exists sms_enabled boolean default false;

-- Each user's number must be unique so the SMS webhook can map an incoming
-- "From" number back to exactly one account.
create unique index if not exists profiles_phone_number_key on profiles (phone_number) where phone_number is not null;

-- profiles already has "own row read/insert/update" policies (auth.uid() = id)
-- from schema.sql, so phone_number/sms_enabled are automatically covered —
-- users can only read and update their own number.
