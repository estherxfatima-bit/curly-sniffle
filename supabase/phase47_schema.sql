-- Phase 47: content_ideas performance metrics.
--
-- Adds optional engagement metrics that can be filled in once an idea's
-- status is set to "Posted" (and updated later via "Update metrics").
--
-- Idempotent — safe to run multiple times. There is no automated
-- migration runner in this repo; run this manually against the Supabase
-- project.

alter table content_ideas add column if not exists views integer;
alter table content_ideas add column if not exists likes integer;
alter table content_ideas add column if not exists comments integer;
alter table content_ideas add column if not exists saves integer;
alter table content_ideas add column if not exists shares integer;
alter table content_ideas add column if not exists metrics_updated_at timestamptz;
