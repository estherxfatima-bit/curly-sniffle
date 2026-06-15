-- Phase 29: AI chat upgrade — personal context for the AI assistant.
-- RLS already covers profiles via existing "profiles: own row *" policies (schema.sql).

alter table profiles add column if not exists personal_context text;
