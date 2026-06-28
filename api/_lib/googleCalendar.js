// Shared Google Calendar helpers — used by /api/calendar/events (session-authed,
// browser) and /api/_lib/calendarSms.js (service-role, SMS webhook/cron).
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Returns a valid access token for the user, refreshing it if needed.
// Returns { error: '...' } if the user isn't connected or refresh fails.
export async function getAccessToken(userId) {
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

// Returns the list of calendars the user has subscribed to, restricted to
// ones selected to show in their Google Calendar UI.
export async function listCalendars(accessToken) {
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=freeBusyReader', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) {
    console.error('[googleCalendar] failed to list calendars', data)
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

// Returns merged + sorted events across all of the user's calendars in the
// given window, in the same shape as /api/calendar/events GET.
export async function listUpcomingEvents(accessToken, { timeMin, timeMax }) {
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime' })
  const calendars = await listCalendars(accessToken)

  const results = await Promise.all(calendars.map(async ({ id: calendarId }) => {
    const evRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const evData = await evRes.json()
    if (!evRes.ok) return []
    return (evData.items || []).map(e => ({
      id: e.id,
      calendarId,
      summary: e.summary || '(No title)',
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      allDay: !e.start?.dateTime,
    }))
  }))

  return results.flat().sort((a, b) => new Date(a.start) - new Date(b.start))
}

// Creates an event on the user's primary calendar. `start`/`end` are either
// ISO datetimes (timed event) or 'yyyy-MM-dd' strings (all-day, when allDay is true).
export async function createEvent(accessToken, { summary, description, start, end, allDay, timeZone }) {
  const body = {
    summary,
    description: description || '',
    start: allDay ? { date: start } : { dateTime: start, timeZone: timeZone || 'UTC' },
    end: allDay ? { date: end } : { dateTime: end, timeZone: timeZone || 'UTC' },
  }
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) return { error: data.error?.message || 'Failed to create event' }
  return { id: data.id, summary: data.summary, start: data.start?.dateTime || data.start?.date, end: data.end?.dateTime || data.end?.date }
}

export async function deleteEvent(accessToken, eventId, calendarId) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || 'primary')}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const data = await res.json().catch(() => ({}))
    return { error: data.error?.message || 'Failed to delete event' }
  }
  return { ok: true }
}
