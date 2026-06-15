-- Phase 2 of the accountability-partner compare feature.

-- goal_metrics: let an accepted partner read metric history for a goal,
-- as long as the goal itself isn't marked private. Needed to show
-- progress rings for "manual metric" goals on the compare page.
drop policy if exists "goal_metrics: partner read" on goal_metrics;
create policy "goal_metrics: partner read" on goal_metrics
  for select using (
    exists (
      select 1 from goals
      where goals.id = goal_metrics.goal_id
        and is_accepted_partner(goals.user_id)
        and not goals.is_private
    )
  );

-- comments: a nudge's recipient can read it even when it isn't attached to
-- a weekly task (e.g. a nudge left on a goal or habit from the compare page).
drop policy if exists "comments: nudge recipient read" on comments;
create policy "comments: nudge recipient read" on comments
  for select using (auth.uid() = partner_id);
