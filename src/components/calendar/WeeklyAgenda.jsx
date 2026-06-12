import { useState, useEffect } from 'react'
import { format, addDays, startOfDay, endOfDay } from 'date-fns'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { fetchCalendarEvents } from '../../lib/googleCalendar'

// Groups this week's Google Calendar events by day (Mon-Sun)
export default function WeeklyAgenda({ weekStart }) {
  const { session } = useAuth()
  const [events, setEvents] = useState([])
  const [connected, setConnected] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    setLoading(true)
    const start = startOfDay(new Date(weekStart))
    const end = endOfDay(addDays(start, 6))
    fetchCalendarEvents(session, start.toISOString(), end.toISOString())
      .then(({ connected, events }) => { setConnected(connected); setEvents(events || []) })
      .finally(() => setLoading(false))
  }, [session, weekStart])

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading…</p>

  if (!connected) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
        Connect Google Calendar in <Link to="/settings" style={{ color: 'var(--finance)' }}>Settings</Link> to see this week's events.
      </p>
    )
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(weekStart), i))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd')
        const dayEvents = events.filter(e => format(new Date(e.start), 'yyyy-MM-dd') === dayStr)
        return (
          <div key={dayStr} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span className="mono" style={{ width: 64, flexShrink: 0, color: 'var(--text-3)', paddingTop: 1 }}>{format(day, 'EEE d')}</span>
            {dayEvents.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>—</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                {dayEvents.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>
                      {e.allDay ? 'All day' : format(new Date(e.start), 'HH:mm')}
                    </span>
                    <span style={{ fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.summary}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
