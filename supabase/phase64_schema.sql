-- Add status + decline_reason to partner_assignments so the assignee
-- can accept or decline (with an optional reason) before committing.

alter table partner_assignments
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  add column if not exists decline_reason text;
