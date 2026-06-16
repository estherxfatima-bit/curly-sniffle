// Client helper for reading/writing Google Calendar events via /api/calendar/events

export async function fetchCalendarEvents(session, timeMin, timeMax) {
  if (!session?.access_token) return { connected: false, events: [] }
  try {
    const params = new URLSearchParams({ timeMin, timeMax })
    const res = await fetch(`/api/calendar/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) return { connected: false, events: [] }
    return await res.json()
  } catch {
    return { connected: false, events: [] }
  }
}

// Creates an event on the user's primary Google Calendar.
// `start`/`end` should be ISO datetime strings. Returns { id, ... } or { error }.
export async function createCalendarEvent(session, { summary, description, start, end }) {
  if (!session?.access_token) return { error: 'Not signed in' }
  try {
    const res = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ summary, description, start, end }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error || 'Failed to create event' }
    return data
  } catch {
    return { error: 'Failed to create event' }
  }
}

// Updates an existing event. Only the fields passed are changed.
export async function updateCalendarEvent(session, eventId, { calendarId, summary, description, start, end }) {
  if (!session?.access_token || !eventId) return { error: 'Not signed in' }
  try {
    const res = await fetch('/api/calendar/events', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ eventId, calendarId, summary, description, start, end }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error || 'Failed to update event' }
    return data
  } catch {
    return { error: 'Failed to update event' }
  }
}

// Deletes an event from the user's primary Google Calendar. Treats missing
// connection / already-deleted events as success so callers don't need to handle it.
export async function deleteCalendarEvent(session, eventId, calendarId) {
  if (!session?.access_token || !eventId) return { ok: true }
  try {
    const params = new URLSearchParams({ eventId, ...(calendarId ? { calendarId } : {}) })
    const res = await fetch(`/api/calendar/events?${params.toString()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) return { ok: false }
    return await res.json()
  } catch {
    return { ok: false }
  }
}
