# Feature roadmap / backlog

Notes from the 2026-06-15 feature request, prioritized by how much they
enhance day-to-day use of the app vs. nice-to-haves that can wait.

## Done

- **Recurring weekly tasks** — "Recurring" toggle when adding/editing a
  weekly task. On the first load of the current week, any recurring task
  from last week that doesn't have a matching instance yet is
  auto-created. Shown with a ↺ icon. Requires `supabase/phase26_schema.sql`
  (adds `weekly_tasks.recurring`).

## High impact — do next

- **Recurring fixed expenses** (item 9) — same pattern as recurring
  weekly tasks, applied to fixed monthly expenses. Auto-create next
  month's instance on page load if missing.
- **Global search** (item 3) — Cmd+K / search icon, searches weekly
  tasks, daily todos, goals, content ideas, brain dump notes, habits,
  meals, books. Big usability win once data volume grows.
- **Notifications inbox** (item 5) — bell icon + unread badge, surfaces
  partner nudges, review reminders, streak warnings. Foundational for
  the partner features below.

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
