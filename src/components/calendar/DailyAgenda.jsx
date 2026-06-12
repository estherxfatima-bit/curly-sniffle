import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { fetchCalendarEvents } from '../../lib/googleCalendar'

export default function DailyAgenda() {
  const { session } = useAuth()
  const [events, setEvents] = useState([])
  const [connected, setConnected] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(); end.setHours(23, 59, 59, 999)
    fetchCalendarEvents(session, start.toISOString(), end.toISOString())
      .then(({ connected, events }) => { setConnected(connected); setEvents(events || []) })
      .finally(() => setLoading(false))
  }, [session])

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading…</p>

  if (!connected) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
        Connect Google Calendar in <Link to="/settings" style={{ color: 'var(--finance)' }}>Settings</Link> to see today's events.
      </p>
    )
  }

  if (!events.length) {
    return <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No events today.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {events.map(e => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="mono" style={{ width: 56, flexShrink: 0, color: 'var(--text-3)' }}>
            {e.allDay ? 'All day' : format(new Date(e.start), 'HH:mm')}
          </span>
          <span style={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.summary}</span>
        </div>
      ))}
    </div>
  )
}
