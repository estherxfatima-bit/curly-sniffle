-- Phase 42: "Time-block my day" on the Weekly page now creates real Google
-- Calendar events (it previously only wrote scheduled_time to weekly_tasks,
-- so the blocks never appeared in Google Calendar). Track the created event
-- id per task so it can be updated/deleted alongside the task, mirroring
-- daily_todos.google_event_id from phase19.

alter table weekly_tasks
  add column if not exists google_event_id text;

comment on column weekly_tasks.google_event_id is 'Google Calendar event ID created by "Time-block my day", if any — used to update/delete the event if the task changes.';
