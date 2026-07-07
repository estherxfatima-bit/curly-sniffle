-- Ensure partner_assignments has status + decline_reason columns
-- (idempotent — safe to run even if phase64 was already applied)
alter table partner_assignments
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  add column if not exists decline_reason text;

-- Backfill existing rows: mark as accepted if to_user has completed them,
-- otherwise leave as pending so they appear in the dashboard alert.
update partner_assignments
  set status = 'accepted'
  where status = 'pending'
    and (complete_to = true or complete_from = true);
