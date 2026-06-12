-- Phase 12: Content Pillars become fully user-managed (add/remove, with examples)

alter table content_pillars alter column key drop not null;
alter table content_pillars drop constraint if exists content_pillars_user_id_key_key;
alter table content_pillars add column if not exists examples text;
alter table content_pillars add column if not exists color text;
alter table content_pillars add column if not exists position integer not null default 0;
