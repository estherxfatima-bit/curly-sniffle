-- Store extra context on notifications (e.g. sender_id for nudge replies).
alter table notifications add column if not exists metadata jsonb;
