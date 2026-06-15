# Feature roadmap / backlog

Notes from the 2026-06-15 feature request, prioritized by how much they
enhance day-to-day use of the app vs. nice-to-haves that can wait.

## Done

- **Recurring weekly tasks** — "Recurring" toggle when adding/editing a
  weekly task. On the first load of the current week, any recurring task
  from last week that doesn't have a matching instance yet is
  auto-created. Shown with a ↺ icon. Requires `supabase/phase26_schema.sql`
  (adds `weekly_tasks.recurring`).
- **Global search** (item 3) — Cmd/Ctrl+K, or the Search button in the
  sidebar (desktop) / bottom nav (mobile). Searches weekly tasks, daily
  todos, goals, content ideas, brain-dump ideas, habits, saved meals and
  books, grouped by type. Clicking a result navigates to that section.
  (Note: "recurring fixed expenses" from item 9 was skipped — fixed
  expenses are already treated as ongoing monthly costs with no
  per-month instance concept, so there's nothing to auto-create.)

- **Notifications inbox** (item 5) — bell icon + unread badge, surfaces
  partner nudges, review reminders, streak warnings. Requires
  `supabase/phase27_schema.sql` (adds `notifications` table).
- **Yearly goals broken down into quarterly goals** — goals can now be
  created with a "Year" timeframe and quarterly goals can link to a
  parent yearly goal via "Break down from yearly goal". The Goals page
  shows yearly goals per year with their linked quarterly breakdown.
  Requires `supabase/phase28_schema.sql` (adds `goals.parent_goal_id`).
- **Finance amount display sizing** — income/fixed-expense monthly
  amounts are now larger and no longer get clipped by long item names.
- **Finance: edit entries, savings/investments, removable budget
  categories** — income, fixed expenses and variable expenses can now be
  edited in place (not just deleted). A new "Savings & investments" card
  (`savings_allocations` table, see `supabase/phase30_schema.sql`) lets
  you allocate recurring savings/investment amounts, which now factor into
  take-home and disposable income. Amount inputs are bigger on mobile.
  The "Total spent" hero numbers scale down on small screens. Category
  budgets can be hidden/restored via a toggle in edit mode
  (`user_preferences.hidden_budget_categories`), and the budget editor
  shows how much of the overall limit is still unallocated as you type.
- **Dashboard priority card** — the "One priority" card on the daily
  dashboard now surfaces the starred (priority) weekly task first.
- **AI chat full upgrade** — Settings has a "My context" field
  (`profiles.personal_context`, see `supabase/phase29_schema.sql`) that's
  fed to the AI along with live goal/task/habit/wins data. The AI can
  suggest weekly tasks and daily to-dos via a JSON block, which renders
  as "Add to plan" cards in the AI Planning panel.
- **Brain dump rework** — "Idea parking lot" renamed to "Brain dump" and
  moved out of the Goals page into a shared `BrainDump` component
  (`src/components/shared/BrainDump.jsx`), available as a dashboard widget
  on the daily view and as a section on the Weekly plan page. Each parked
  item can be sent straight to today's to-dos, this week's plan, or a new
  quarterly goal via a "send to…" menu, in addition to the existing
  pull-from-brain-dump flow on the daily to-do list.

## Medium impact

- **Wellness: intentional rest day** (item 10, part 1) — "Log rest day"
  button, distinct dot style on the habit/workout grid.
- **Wellness: body measurements** (item 10, part 2) — weight + custom
  measurements, charted over time.
- **Content hub improvements** (item 8) — drag-and-drop idea reordering,
  duplicate idea, bulk actions, outfit/setup field, batch edit/clear.
- **Account management & delete account** (item 12) — change name/email/
  password, delete account flow.

## Lower priority / backseat for now

- **Offline support** (item 6) — service worker caching + offline queue.
  High effort, app is mostly used online.
- **Data export** (item 7) — JSON/CSV export of all user data. Useful but
  not a daily-use enhancer.
- **Net worth tracker** (item 9, part 2) — manual assets/liabilities entry
  + chart. Valuable but separate from daily workflow.
- **Hydration reminder push notification** (item 10, part 3) — needs
  push notification infrastructure.
- **Accountability partner side-by-side compare view + privacy controls**
  (item 11) — large feature (new page, sharing prefs, RLS changes).
  Worth doing once notifications inbox exists.

Revisit this list once the "high impact" items are done.
