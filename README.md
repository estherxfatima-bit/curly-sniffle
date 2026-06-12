# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Google Calendar integration

Connecting Google Calendar lets the app show your events on the daily/weekly dashboards and the weekly plan page.

### 1. Supabase setup

1. In the Supabase dashboard, go to **Authentication → Providers → Google** and enable the Google provider.
2. Under "Additional scopes" (or "Scopes"), add the calendar scope alongside the default scopes:
   ```
   https://www.googleapis.com/auth/calendar.readonly
   ```
3. Run `supabase/phase10_schema.sql` in the Supabase SQL editor. This creates the `google_tokens` table (with row-level security so each user can only read/write their own row).

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
