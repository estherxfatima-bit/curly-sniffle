import { useState, useEffect, useCallback } from 'react'
import { format, addDays, startOfDay, endOfDay } from 'date-fns'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { fetchCalendarEvents } from '../../lib/googleCalendar'
import { RefreshCw, AlertTriangle } from 'lucide-react'

const REFRESH_INTERVAL_MS = 15 * 60 * 1000

// Groups this week's Google Calendar events by day (Mon-Sun)
export default function WeeklyAgenda({ weekStart }) {
  const { session } = useAuth()
  const [events, setEvents] = useState([])
  const [connected, setConnected] = useState(true)
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh) => {
    if (!session) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const start = startOfDay(new Date(weekStart))
    // Fetch the week plus a few days ahead so newly-added events show up promptly.
    const end = endOfDay(addDays(start, 9))
    const { connected, events, error } = await fetchCalendarEvents(session, start.toISOString(), end.toISOString())
    setConnected(connected)
    setNeedsReconnect(!!error)
    setEvents(events || [])
    setLoading(false)
    setRefreshing(false)
  }, [session, weekStart])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load])

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading…</p>

  if (!connected) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
        Connect Google Calendar in <Link to="/settings" style={{ color: 'var(--finance)' }}>Settings</Link> to see this week's events.
      </p>
    )
  }

  if (needsReconnect) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--warning)' }}>
        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
        <span>Calendar connection expired — <Link to="/settings" style={{ color: 'var(--finance)' }}>reconnect</Link> to see this week's events.</span>
      </div>
    )
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(weekStart), i))
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  return (
    <div>
      <div className="flex items-center justify-end mb-2">
        <button className="btn-icon" title="Refresh calendar" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {days.map(day => {
          const dayStr = format(day, 'yyyy-MM-dd')
          const isToday = dayStr === todayStr
          const dayEvents = events.filter(e => format(new Date(e.start), 'yyyy-MM-dd') === dayStr)
          return (
            <div
              key={dayStr}
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '6px 8px', borderRadius: 6,
                background: isToday ? 'var(--career-tint, var(--bg-2))' : 'transparent',
              }}
            >
              <span className="mono" style={{ width: 64, flexShrink: 0, fontSize: 11, color: isToday ? 'var(--career)' : 'var(--text-3)', fontWeight: isToday ? 700 : 400, paddingTop: 1 }}>{format(day, 'EEE d')}</span>
              {dayEvents.length === 0 ? (
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>—</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                  {dayEvents.map(e => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: e.calendarColor || 'var(--career)', flexShrink: 0 }} />
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
    </div>
  )
}
