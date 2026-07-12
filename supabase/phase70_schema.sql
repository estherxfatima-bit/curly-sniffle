-- Allow accepted accountability partners to read each other's milestones and milestone tasks.
-- Without these policies, GoalCard renders empty milestone lists for partner goals on the Compare page.

drop policy if exists "milestones: partner read" on milestones;
create policy "milestones: partner read" on milestones
  for select using (is_accepted_partner(milestones.user_id));

drop policy if exists "milestone_tasks: partner read" on milestone_tasks;
create policy "milestone_tasks: partner read" on milestone_tasks
  for select using (is_accepted_partner(milestone_tasks.user_id));
