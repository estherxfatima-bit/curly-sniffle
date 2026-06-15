-- Display name shown across the app, editable from Settings -> Account.

alter table profiles
  add column if not exists display_name text;

comment on column profiles.display_name is 'User-chosen display name, set from Settings -> Account. Falls back to auth user_metadata.full_name or email when not set.';
