// /api/auth/google/callback — Google OAuth redirect target
// Exchanges the auth code for tokens, looks up the calling user via the
// `state` param (the user's Supabase access token), and stores the
// Google tokens in the google_tokens table.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role needed for server-side access
)

function appBaseUrl() {
  const redirect = process.env.GOOGLE_REDIRECT_URI || ''
  return redirect.replace('/api/auth/google/callback', '')
}

export default async function handler(req, res) {
  const base = appBaseUrl()
  const requestUrl = new URL(req.url, `https://${req.headers.host}`)
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state')
  const error = requestUrl.searchParams.get('error')

  if (error || !code || !state) {
    console.error('[google/callback] missing/invalid params from Google', { error, hasCode: !!code, hasState: !!state })
    return res.redirect(302, `${base}/settings?google=error`)
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(state)
  if (userErr || !userData?.user) {
    console.error('[google/callback] failed to resolve user from state token', userErr?.message || userErr)
    return res.redirect(302, `${base}/settings?google=error`)
  }
  const userId = userData.user.id

  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      throw new Error('Google OAuth env vars are not fully configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI)')
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenRes.json()
    if (!tokenRes.ok) {
      console.error('[google/callback] token exchange failed', {
        status: tokenRes.status,
        error: tokens.error,
        error_description: tokens.error_description,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      })
      throw new Error(tokens.error_description || tokens.error || 'Token exchange failed')
    }

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = await userInfoRes.json()
    if (!userInfoRes.ok) {
      console.error('[google/callback] userinfo request failed', { status: userInfoRes.status, body: userInfo })
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()

    const row = {
      user_id: userId,
      access_token: tokens.access_token,
      expires_at: expiresAt,
      google_email: userInfo.email || null,
      updated_at: new Date().toISOString(),
    }
    // refresh_token is only returned on first consent — keep the existing one if absent
    if (tokens.refresh_token) row.refresh_token = tokens.refresh_token

    const { error: upsertErr } = await supabase.from('google_tokens').upsert(row, { onConflict: 'user_id' })
    if (upsertErr) {
      console.error('[google/callback] failed to upsert google_tokens', upsertErr.message || upsertErr)
      throw upsertErr
    }

    return res.redirect(302, `${base}/settings?google=connected`)
  } catch (e) {
    console.error('[google/callback] OAuth callback failed:', e.message)
    if (e.stack) console.error(e.stack)
    return res.redirect(302, `${base}/settings?google=error`)
  }
}
