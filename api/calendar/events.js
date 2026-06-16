// /api/calendar/events — read/write the signed-in user's Google Calendars,
// refreshing the stored access token if it has expired.
// GET    /api/calendar/events?timeMin=...&timeMax=...        — list events across all of the user's calendars
// POST   /api/calendar/events  { summary, description, start, end } — create event on the primary calendar
// DELETE /api/calendar/events?eventId=...                    — delete event from the primary calendar
// Header: Authorization: Bearer <supabase access token>

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role needed for server-side access
)

// Returns a valid access token for the user, refreshing it if needed.
// Returns { error: '...' } if the user isn't connected or refresh fails.
async function getAccessToken(userId) {
  const { data: tokenRow } = await supabase.from('google_tokens').select('*').eq('user_id', userId).maybeSingle()
  if (!tokenRow) return { error: 'not_connected' }

  if (new Date(tokenRow.expires_at).getTime() < Date.now() + 60 * 1000) {
    if (!tokenRow.refresh_token) return { error: 'reconnect' }
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
    if (!refreshRes.ok) return { error: 'reconnect' }
    const accessToken = refreshed.access_token
    const expiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString()
    await supabase.from('google_tokens').update({
      access_token: accessToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
    return { accessToken }
  }

  return { accessToken: tokenRow.access_token }
}

// Returns the list of calendars the user has subscribed to (including secondary
// calendars synced from other providers, e.g. iCloud calendars subscribed in Google
// Calendar), restricted to ones the user has selected to show in their UI.
// Returns full calendar metadata: id, summary, backgroundColor, foregroundColor
async function listCalendars(accessToken) {
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=freeBusyReader', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) {
    console.error('[api/calendar/events] failed to list calendars', data)
    return [{ id: 'primary', summary: 'Calendar', backgroundColor: '#4285f4', foregroundColor: '#ffffff' }]
  }
  const calendars = (data.items || []).filter(c => c.selected !== false)
  if (calendars.length === 0) return [{ id: 'primary', summary: 'Calendar', backgroundColor: '#4285f4', foregroundColor: '#ffffff' }]
  return calendars.map(c => ({
    id: c.id,
    summary: c.summaryOverride || c.summary || c.id,
    backgroundColor: c.backgroundColor || '#4285f4',
    foregroundColor: c.foregroundColor || '#ffffff',
  }))
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing Authorization header' })

  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })
  const userId = userData.user.id

  if (req.method === 'GET') {
    const { accessToken, error } = await getAccessToken(userId)
    if (error === 'not_connected') return res.status(200).json({ connected: false, events: [] })
    if (error === 'reconnect') return res.status(200).json({ connected: false, error: 'Missing refresh token — please reconnect', events: [] })

    const { timeMin, timeMax } = req.query
    const params = new URLSearchParams({
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    })

    const calendars = await listCalendars(accessToken)
    // Build a lookup: calendarId -> { summary, backgroundColor, foregroundColor }
    const calMeta = Object.fromEntries(calendars.map(c => [c.id, c]))

    const results = await Promise.all(calendars.map(async ({ id: calendarId }) => {
      const evRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const evData = await evRes.json()
      if (!evRes.ok) {
        console.error('[api/calendar/events] failed to fetch events for calendar', calendarId, evData.error?.message || evData)
        return { calendarId, events: [], error: evData.error?.message }
      }
      const meta = calMeta[calendarId] || {}
      return {
        calendarId,
        events: (evData.items || []).map(e => ({
          id: e.id,
          calendarId,
          calendarName: meta.summary || calendarId,
          calendarColor: meta.backgroundColor || '#4285f4',
          calendarFg: meta.foregroundColor || '#ffffff',
          summary: e.summary || '(No title)',
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          allDay: !e.start?.dateTime,
          description: e.description || '',
          location: e.location || '',
        })),
      }
    }))

    const events = results.flatMap(r => r.events).sort((a, b) => new Date(a.start) - new Date(b.start))
    const calendarMeta = calendars
    const firstError = results.find(r => r.error)?.error

    if (events.length === 0 && firstError) {
      return res.status(200).json({ connected: true, error: firstError, events: [], calendars: calendarMeta })
    }

    return res.status(200).json({ connected: true, events, calendars: calendarMeta })
  }

  if (req.method === 'POST') {
    const { accessToken, error } = await getAccessToken(userId)
    if (error === 'not_connected') return res.status(409).json({ error: 'Google Calendar is not connected' })
    if (error === 'reconnect') return res.status(409).json({ error: 'Missing refresh token — please reconnect Google Calendar' })

    const { summary, description, start, end } = req.body || {}
    if (!summary || !start || !end) return res.status(400).json({ error: 'summary, start, and end are required' })

    const evRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary,
        description: description || '',
        start: { dateTime: start },
        end: { dateTime: end },
      }),
    })
    const evData = await evRes.json()
    if (!evRes.ok) return res.status(502).json({ error: evData.error?.message || 'Failed to create event' })

    return res.status(200).json({ id: evData.id, summary: evData.summary, start: evData.start?.dateTime, end: evData.end?.dateTime })
  }

  if (req.method === 'DELETE') {
    const { accessToken, error } = await getAccessToken(userId)
    if (error === 'not_connected') return res.status(200).json({ ok: true })
    if (error === 'reconnect') return res.status(200).json({ ok: true })

    const { eventId } = req.query
    if (!eventId) return res.status(400).json({ error: 'eventId is required' })

    const evRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    // 404/410 means already deleted — treat as success either way
    if (!evRes.ok && evRes.status !== 404 && evRes.status !== 410) {
      const evData = await evRes.json().catch(() => ({}))
      return res.status(502).json({ error: evData.error?.message || 'Failed to delete event' })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
