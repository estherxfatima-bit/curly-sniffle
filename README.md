# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Claude AI integration

All Claude API calls (AI planning, content idea generation, weekly review summaries, SMS Q&A, calendar event extraction from images, etc.) go through server-side endpoints under `/api/claude/*`. The frontend never calls `api.anthropic.com` directly and never bundles an API key.

Set `CLAUDE_API_KEY` (no `VITE_` prefix) in your `.env` (local) and in your Vercel project's environment variables — get a key from the [Anthropic console](https://console.anthropic.com/). Because it has no `VITE_` prefix, Vite will not inline it into the browser bundle; it's only readable from `/api` serverless functions.

The Settings page shows whether the key is configured by calling `/api/claude/status`, which only returns a boolean — it never exposes the key.

> If you're upgrading from an older version of this app that used `VITE_CLAUDE_API_KEY`, remove it from your environment and replace it with `CLAUDE_API_KEY`.

## Google Calendar integration

Connecting Google Calendar lets the app show your events on the daily/weekly dashboards and the weekly plan page.

### 1. Supabase setup

1. In the Supabase dashboard, go to **Authentication → Providers → Google** and enable the Google provider.
2. Under "Additional scopes" (or "Scopes"), add the calendar scope alongside the default scopes:
   ```
   https://www.googleapis.com/auth/calendar
   ```
3. Run `supabase/phase10_schema.sql` in the Supabase SQL editor. This creates the `google_tokens` table (with row-level security so each user can only read/write their own row).

> ⚠️ **Existing users**: Phase 19 upgrades the Google Calendar scope from read-only (`calendar.readonly`) to full read/write (`calendar`) so "Time-block my day" can create events. If you connected Google Calendar before this change, go to **Settings → Google Calendar** and click **Reconnect** to grant the new permission — your stored tokens will be refreshed automatically.

### 2. Google Cloud Console setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create (or select) a project.
2. Go to **APIs & Services → Library** and enable the **Google Calendar API**.
3. Go to **APIs & Services → OAuth consent screen** and configure it (add your account as a test user if the app is in "Testing" mode).
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**
   - Authorized redirect URI — **must match `GOOGLE_REDIRECT_URI` exactly**:
     ```
     https://curly-sniffle-seven.vercel.app/api/auth/google/callback
     ```
5. Copy the generated **Client ID** and **Client secret**.

> ⚠️ The redirect URI configured in Google Cloud Console must be byte-for-byte identical to `GOOGLE_REDIRECT_URI` (including protocol, domain, and path) or Google will reject the OAuth request with a `redirect_uri_mismatch` error.

### 3. Environment variables

Add the following to your `.env` (local) and to your Vercel project's environment variables:

| Variable | Description |
| --- | --- |
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret from Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://curly-sniffle-seven.vercel.app/api/auth/google/callback` — must match the redirect URI configured in Google Cloud Console |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only, used by `/api` routes to read/write `google_tokens`) |

These are all server-side variables (no `VITE_` prefix) — they are used only by the serverless functions under `/api`, never exposed to the browser.

### 4. Connecting an account

1. Go to **Settings** in the app and click **Connect Google Calendar**.
2. You'll be redirected to Google to sign in and grant calendar access.
3. After authorizing, you're redirected back to Settings, which will show "Connected" along with your Google account email.
4. Click **Disconnect** at any time to delete the stored tokens from `google_tokens`.

## Enhanced daily to-dos

Daily to-dos support:

- **Subtasks**: expandable inline list, each independently checkable; the parent task auto-completes once all subtasks are done.
- **Duration** (minutes) and **time of day**: optional pills on each to-do. To-dos with a time set sort to the top, in chronological order, with timeless to-dos below.
- **Pull from weekly plan**: pulls an incomplete task from this week's weekly plan into today's to-dos as an independent copy (copies the task text, area→category, and any time allocation as duration). The original weekly task is untouched; the daily to-do shows a "from weekly plan" badge linking back to `/weekly`.
- **Task timer**: tap the timer icon on any to-do to start a countdown (defaults to the to-do's duration), stopwatch, or Pomodoro (25/5 by default, adjustable) session. Time spent is logged cumulatively to the to-do, and a floating indicator shows the active timer across all pages.
- **Time-block my day**: analyses today's to-dos with a duration set and your existing Google Calendar events to propose a schedule within your working hours (Settings → Working hours, default 9am–7pm). On confirmation, creates real events on your connected Google Calendar (requires the `calendar` write scope — see the Google Calendar section above).

Run `supabase/phase19_schema.sql` in the Supabase SQL editor to add the required `daily_todos` columns and the `user_preferences` table.

## Twilio SMS integration

Lets you text the app — get a daily morning briefing, log expenses, manage
to-dos, and ask the AI planning assistant questions, all over SMS.

### 1. Twilio account setup

1. Create a [Twilio](https://www.twilio.com/) account and buy a phone number with SMS capability.
2. Go to **Account → API keys & tokens** and create a new **Standard API key**. Note the **SID** (starts with `SK`) and **Secret** — this is your `TWILIO_API_KEY` / `TWILIO_API_SECRET` pair.
3. Your **Account SID** (starts with `AC`) is on the main Console dashboard — this is `TWILIO_ACCOUNT_SID`.
4. Your Twilio number (E.164 format, e.g. `+15551234567`) is `TWILIO_PHONE_NUMBER`.
5. `MY_PHONE_NUMBER` is your personal phone number (E.164 format) — the only number the webhook will accept messages from.

### 2. Configure the webhook in the Twilio console

1. Go to **Phone Numbers → Manage → Active Numbers** and select your Twilio number.
2. Under **Messaging Configuration**, set "A message comes in" to:
   - Webhook: `https://<your-deployment>.vercel.app/api/sms/webhook`
   - Method: `HTTP POST`
3. Save.

### 3. Environment variables

Add the following to your `.env` (local) and to your Vercel project's environment variables:

| Variable | Description |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID (starts with `AC`) |
| `TWILIO_API_KEY` | Twilio API Key SID (starts with `SK`) |
| `TWILIO_API_SECRET` | Twilio API Key secret |
| `TWILIO_PHONE_NUMBER` | Your Twilio number, E.164 format (e.g. `+15551234567`) |
| `MY_PHONE_NUMBER` | Your personal phone number, E.164 format — only messages from this number are processed |
| `CRON_SECRET` | (optional) Random string; if set, the morning-briefing cron endpoint requires it as a Bearer token (Vercel sends this automatically for cron-triggered requests) |

All of these are server-side only (no `VITE_` prefix) — used only by the serverless functions under `/api/sms`.

### 4. Morning briefing cron

`vercel.json` schedules `/api/sms/morning-briefing` to run daily at **08:00 UTC** via Vercel Cron. Adjust the `schedule` cron expression if you want a different time/timezone. Cron jobs only run on Vercel's production deployments (Pro plan or above for non-daily schedules; the Hobby plan supports once-daily crons).

### 5. Texting the app

Once configured, text your Twilio number (`TWILIO_PHONE_NUMBER`) from `MY_PHONE_NUMBER`:

- **Log an expense**: `spent £12 on lunch` or `£45 groceries` → adds to Finance, replies with the category and what's left in your monthly budget.
- **Complete to-dos**: `done 1 2` or `done all` — numbers refer to today's to-do list as sent in the morning briefing.
- **Add a to-do**: `add buy oat milk` or `todo: call dentist`.
- **Ask anything**: `what's my focus today?`, `how's my spending this week?` — routed to Claude with your goals, tasks, habits, mood, and finances as context.
- Anything else gets a short help message with example commands.

Every SMS exchange is saved to the **AI Log** (`type: 'sms'`), and the current status/example commands are shown in **Settings**.
