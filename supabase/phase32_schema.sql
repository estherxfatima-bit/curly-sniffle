-- Priority levels (urgent/high/medium/low) on daily todos, weekly tasks and goals.
-- Named `priority_level` to avoid clashing with the existing `weekly_tasks.priority`
-- boolean ("starred as a priority for this week").

alter table daily_todos
  add column if not exists priority_level text check (priority_level in ('urgent', 'high', 'medium', 'low'));

alter table weekly_tasks
  add column if not exists priority_level text check (priority_level in ('urgent', 'high', 'medium', 'low'));

alter table goals
  add column if not exists priority_level text check (priority_level in ('urgent', 'high', 'medium', 'low'));

comment on column daily_todos.priority_level is 'Optional priority: urgent, high, medium or low. Null means no priority set.';
comment on column weekly_tasks.priority_level is 'Optional priority: urgent, high, medium or low. Null means no priority set. Distinct from the boolean `priority` ("this week''s star priority") column.';
comment on column goals.priority_level is 'Optional priority: urgent, high, medium or low. Null means no priority set.';
