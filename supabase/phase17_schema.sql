-- Phase 17: Wellness dashboard — scheduled (planned) workouts

alter table workout_logs add column if not exists planned boolean not null default false;
