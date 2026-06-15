-- Note for tomorrow: a free-text note written today, surfaced when viewing tomorrow.

alter table daily_reflections
  add column if not exists note_for_tomorrow text;

comment on column daily_reflections.note_for_tomorrow is 'Free-text note written on this date, intended to be read the following day.';
