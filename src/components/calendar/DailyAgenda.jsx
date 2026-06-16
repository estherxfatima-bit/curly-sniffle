import { useState, useEffect, useCallback } from 'react'
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { fetchCalendarEvents } from '../../lib/googleCalendar'
import { RefreshCw, AlertTriangle } from 'lucide-react'

const REFRESH_INTERVAL_MS = 15 * 60 * 1000

export default function DailyAgenda() {
  const { session } = useAuth()
  const [events, setEvents] = useState([])
  const [connected, setConnected] = useState(true)
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh) => {
    if (!session) return
    if (isRefresh) setRefreshing(true)
    // Fetch this week plus a few days ahead so newly-added events (e.g. from
    // a subscribed iCloud calendar) show up without waiting for a wider range.
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    const end = addDays(endOfWeek(new Date(), { weekStartsOn: 1 }), 3)
    const { connected, events, error } = await fetchCalendarEvents(session, start.toISOString(), end.toISOString())
    setConnected(connected)
    setNeedsReconnect(!!error)
    setEvents(events || [])
    setLoading(false)
    setRefreshing(false)
  }, [session])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load])

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading…</p>

  if (!connected) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
        Connect Google Calendar in <Link to="/settings" style={{ color: 'var(--finance)' }}>Settings</Link> to see today's events.
      </p>
    )
  }

  if (needsReconnect) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--warning)' }}>
        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
        <span>Calendar connection expired — <Link to="/settings" style={{ color: 'var(--finance)' }}>reconnect</Link> to see today's events.</span>
      </div>
    )
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todaysEvents = events.filter(e => format(new Date(e.start), 'yyyy-MM-dd') === todayStr)
  const now = new Date()

  return (
    <div>
      <div className="flex items-center justify-end mb-2">
        <button className="btn-icon" title="Refresh calendar" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
        </button>
      </div>
      {todaysEvents.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No events today.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {todaysEvents.map(e => {
            const isNow = !e.allDay && new Date(e.start) <= now && now <= new Date(e.end)
            return (
              <div
                key={e.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 8px', borderRadius: 6,
                  borderLeft: `3px solid ${e.calendarColor || 'var(--career)'}`,
                  background: isNow ? `color-mix(in srgb, ${e.calendarColor || 'var(--career)'} 12%, transparent)` : 'var(--bg-2)',
                }}
              >
                <span className="mono" style={{ width: 52, flexShrink: 0, fontSize: 11, color: isNow ? (e.calendarColor || 'var(--career)') : 'var(--text-3)', fontWeight: isNow ? 700 : 400 }}>
                  {e.allDay ? 'All day' : format(new Date(e.start), 'HH:mm')}
                </span>
                <span style={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isNow ? 600 : 400 }}>{e.summary}</span>
                {isNow && <span className="badge" style={{ fontSize: 9, marginLeft: 'auto', flexShrink: 0, background: e.calendarColor || 'var(--career)', color: '#fff' }}>Now</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
