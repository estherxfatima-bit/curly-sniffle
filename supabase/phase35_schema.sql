-- Phase 1 of "accountability partner sharing" feature: privacy + sharing
-- settings foundation (used by Settings -> Sharing with partners, and by
-- the upcoming partner compare view).

-- Per-user toggles for optional partner-visible sections. Goals, Insights,
-- Weekly todos and Daily todos are always shared with accepted partners
-- (subject to the per-item `is_private` flag below) and have no toggle.
create table if not exists user_sharing_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  share_finance  boolean not null default false,
  share_wellness boolean not null default false,
  share_books    boolean not null default false,
  updated_at     timestamptz default now()
);

alter table user_sharing_settings enable row level security;

drop policy if exists "user_sharing_settings: own row" on user_sharing_settings;
create policy "user_sharing_settings: own row" on user_sharing_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Per-item privacy flag — when true, the item is never shared with
-- partners regardless of the toggles above.
alter table goals        add column if not exists is_private boolean not null default false;
alter table weekly_tasks add column if not exists is_private boolean not null default false;
alter table daily_todos  add column if not exists is_private boolean not null default false;
alter table habits       add column if not exists is_private boolean not null default false;

-- Accepted partners can read non-private goals, habits and daily todos
-- (weekly_tasks already has a partner-read policy from the base schema —
-- update it to also respect is_private).

drop policy if exists "weekly_tasks: partner read" on weekly_tasks;
create policy "weekly_tasks: partner read" on weekly_tasks
  for select using (is_accepted_partner(weekly_tasks.user_id) and not is_private);

drop policy if exists "goals: partner read" on goals;
create policy "goals: partner read" on goals
  for select using (is_accepted_partner(goals.user_id) and not is_private);

drop policy if exists "daily_todos: partner read" on daily_todos;
create policy "daily_todos: partner read" on daily_todos
  for select using (is_accepted_partner(daily_todos.user_id) and not is_private);

drop policy if exists "habits: partner read" on habits;
create policy "habits: partner read" on habits
  for select using (is_accepted_partner(habits.user_id) and not is_private);

-- habit_logs: readable by an accepted partner if the underlying habit is
-- not private. Needed to compute streaks for the partner compare view.
drop policy if exists "habit_logs: partner read" on habit_logs;
create policy "habit_logs: partner read" on habit_logs
  for select using (
    is_accepted_partner(habit_logs.user_id)
    and exists (
      select 1 from habits
      where habits.id = habit_logs.habit_id
        and not habits.is_private
    )
  );

-- mood_logs: Insights (which include the momentum score) are always
-- shared with accepted partners — no per-item privacy for mood logs.
drop policy if exists "mood_logs: partner read" on mood_logs;
create policy "mood_logs: partner read" on mood_logs
  for select using (is_accepted_partner(mood_logs.user_id));


-- =====================
-- Summary-only RPCs for optional sections (Finance, Wellness, Books).
-- These never expose raw rows to a partner — only the aggregate figures
-- below — and only when the owner has the relevant share_* toggle on.
-- =====================

-- Overall budget adherence for the current month, as a percentage of the
-- overall monthly budget spent so far (null if not shared, or no overall
-- budget set for this month).
create or replace function get_partner_budget_adherence(p_user_id uuid)
returns numeric
language plpgsql
security definer
stable
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_budget numeric;
  v_spent numeric;
begin
  if not is_accepted_partner(p_user_id) then return null; end if;
  if not exists (select 1 from user_sharing_settings where user_id = p_user_id and share_finance) then
    return null;
  end if;

  select amount into v_budget from budgets
    where user_id = p_user_id and category is null and month_year = v_month
    limit 1;
  if v_budget is null or v_budget = 0 then return null; end if;

  select coalesce(sum(amount), 0) into v_spent from variable_expenses
    where user_id = p_user_id and to_char(date, 'YYYY-MM') = v_month;

  return round((v_spent / v_budget) * 100, 1);
end;
$$;

-- 7-day average sleep hours and hydration (ml) — null if not shared.
create or replace function get_partner_wellness_summary(p_user_id uuid)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_avg_sleep numeric;
  v_avg_hydration numeric;
begin
  if not is_accepted_partner(p_user_id) then return null; end if;
  if not exists (select 1 from user_sharing_settings where user_id = p_user_id and share_wellness) then
    return null;
  end if;

  select avg(sleep_hours), avg(hydration_ml) into v_avg_sleep, v_avg_hydration
    from wellness_logs
    where user_id = p_user_id and log_date >= current_date - interval '6 days';

  return jsonb_build_object(
    'avg_sleep_hours', round(coalesce(v_avg_sleep, 0), 1),
    'avg_hydration_ml', round(coalesce(v_avg_hydration, 0))
  );
end;
$$;

-- Count of books currently being read and completed this quarter — null if
-- not shared.
create or replace function get_partner_books_summary(p_user_id uuid)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_reading int;
  v_completed int;
begin
  if not is_accepted_partner(p_user_id) then return null; end if;
  if not exists (select 1 from user_sharing_settings where user_id = p_user_id and share_books) then
    return null;
  end if;

  select count(*) into v_reading from books where user_id = p_user_id and status = 'reading';
  select count(*) into v_completed from books
    where user_id = p_user_id and status = 'completed'
      and quarter = (
        'Q' || ceil(extract(month from now()) / 3.0)::int || ' ' || extract(year from now())::int
      );

  return jsonb_build_object('reading', v_reading, 'completed_this_quarter', v_completed);
end;
$$;

