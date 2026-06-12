// /api/calendar/events — fetches events from the signed-in user's primary
// Google Calendar, refreshing the stored access token if it has expired.
// GET /api/calendar/events?timeMin=...&timeMax=...
// Header: Authorization: Bearer <supabase access token>

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role needed for server-side access
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing Authorization header' })

  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })
  const userId = userData.user.id

  const { data: tokenRow } = await supabase.from('google_tokens').select('*').eq('user_id', userId).maybeSingle()
  if (!tokenRow) return res.status(200).json({ connected: false, events: [] })

  let accessToken = tokenRow.access_token

  // Refresh if the token is expired or about to expire
  if (new Date(tokenRow.expires_at).getTime() < Date.now() + 60 * 1000) {
    if (!tokenRow.refresh_token) {
      return res.status(200).json({ connected: false, error: 'Missing refresh token — please reconnect', events: [] })
    }
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: tokenRow.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const refreshed = await refreshRes.json()
    if (!refreshRes.ok) {
      return res.status(200).json({ connected: false, error: 'Token refresh failed — please reconnect', events: [] })
    }
    accessToken = refreshed.access_token
    const expiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString()
    await supabase.from('google_tokens').update({
      access_token: accessToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
  }

  const { timeMin, timeMax } = req.query
  const params = new URLSearchParams({
    timeMin: timeMin || new Date().toISOString(),
    timeMax: timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  })

  const evRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const evData = await evRes.json()
  if (!evRes.ok) {
    return res.status(200).json({ connected: true, error: evData.error?.message || 'Failed to fetch events', events: [] })
  }

  const events = (evData.items || []).map(e => ({
    id: e.id,
    summary: e.summary || '(No title)',
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    allDay: !e.start?.dateTime,
  }))

  return res.status(200).json({ connected: true, events })
}
