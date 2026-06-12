// Client helper for fetching Google Calendar events via /api/calendar/events

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
