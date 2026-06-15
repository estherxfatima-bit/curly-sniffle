-- Phase 28: Yearly goals broken down into quarterly goals.

alter table goals add column if not exists parent_goal_id uuid references goals(id) on delete set null;

create index if not exists goals_parent_goal_id_idx on goals(parent_goal_id);
