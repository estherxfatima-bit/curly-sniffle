-- Add settled_at to debts so paid-off debts can be archived rather than deleted.
-- Settled debts are hidden from the active debt list but visible in Financial History.
alter table debts
  add column if not exists settled_at timestamptz;
