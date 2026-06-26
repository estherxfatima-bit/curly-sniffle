-- Phase 48: track the most recent "Flesh this out" AI result per content idea.
--
-- Lets the Idea Dump show a "View last flesh out" link that opens the saved
-- ai_log entry without re-calling the Claude API.
--
-- Idempotent — safe to run multiple times. There is no automated migration
-- runner in this repo; run this manually against the Supabase project.

alter table content_ideas add column if not exists last_flesh_out_id uuid references ai_log(id) on delete set null;
