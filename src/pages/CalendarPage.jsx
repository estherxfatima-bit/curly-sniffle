import { useState, useEffect, useCallback } from 'react'
import { format, startOfWeek, addDays, addWeeks, subWeeks, differenceInMinutes, parseISO, isSameDay } from 'date-fns'
import { ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, Calendar } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { fetchCalendarEvents } from '../lib/googleCalendar'
import { Link } from 'react-router-dom'

// Grid spans 6am – 11pm (17 hours × 60 = 1020 minutes)
const GRID_START_HOUR = 6
const GRID_END_HOUR = 23
const GRID_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60
const HOUR_HEIGHT = 64 // px per hour
const GRID_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function minutesFromGridStart(dateStr) {
  const d = parseISO(dateStr)
  return (d.getHours() - GRID_START_HOUR) * 60 + d.getMinutes()
}

// Compute overlapping columns for a list of timed events on one day.
// Returns events with added { _col, _cols } fields.
function layoutEvents(events) {
  if (!events.length) return events
  const sorted = [...events].sort((a, b) => new Date(a.start) - new Date(b.start))
  const cols = [] // each col is an array of events
  sorted.forEach(ev => {
    const evStart = new Date(ev.start)
    const evEnd = new Date(ev.end)
    let placed = false
    for (let c = 0; c < cols.length; c++) {
      const last = cols[c][cols[c].length - 1]
      if (new Date(last.end) <= evStart) {
        cols[c].push(ev)
        ev._col = c
        placed = true
        break
      }
    }
    if (!placed) {
      ev._col = cols.length
      cols.push([ev])
    }
  })
  // Second pass: assign _cols (total parallel columns at the time of this event)
  sorted.forEach(ev => {
    const evStart = new Date(ev.start)
    const evEnd = new Date(ev.end)
    let maxCol = ev._col
    sorted.forEach(other => {
      if (other === ev) return
      const oStart = new Date(other.start)
      const oEnd = new Date(other.end)
      if (oStart < evEnd && oEnd > evStart) maxCol = Math.max(maxCol, other._col)
    })
    ev._cols = maxCol + 1
  })
  return sorted
}

export default function CalendarPage() {
  const { session } = useAuth()
  const [weekRef, setWeekRef] = useState(new Date())
  const [events, setEvents] = useState([])
  const [calendars, setCalendars] = useState([])
  const [connected, setConnected] = useState(true)
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selected, setSelected] = useState(null) // selected event for detail

  const weekStart = startOfWeek(weekRef, { weekStartsOn: 1 })

  const load = useCallback(async (isRefresh = false) => {
    if (!session) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const timeMin = weekStart.toISOString()
    const timeMax = addDays(weekStart, 7).toISOString()
    const result = await fetchCalendarEvents(session, timeMin, timeMax)
    setConnected(result.connected)
    setNeedsReconnect(!!result.error)
    setEvents(result.events || [])
    setCalendars(result.calendars || [])
    setLoading(false)
    setRefreshing(false)
  }, [session, weekStart.toISOString()]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const allDayEvents = events.filter(e => e.allDay)
  const timedEvents = events.filter(e => !e.allDay)

  // Group timed events per day and compute layout
  const eventsByDay = weekDays.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd')
    const dayEvents = timedEvents.filter(e => format(parseISO(e.start), 'yyyy-MM-dd') === dayStr)
    return layoutEvents(dayEvents)
  })

  const allDayByDay = weekDays.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return allDayEvents.filter(e => {
      const s = e.start.length === 10 ? e.start : format(parseISO(e.start), 'yyyy-MM-dd')
      const en = e.end.length === 10 ? e.end : format(parseISO(e.end), 'yyyy-MM-dd')
      return s <= dayStr && en > dayStr
    })
  })

  const hours = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i)

  if (!connected && !loading) {
    return (
      <div>
        <div className="page-header"><h1>Calendar</h1></div>
        <div className="card" style={{ maxWidth: 400 }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Connect Google Calendar in <Link to="/settings" style={{ color: 'var(--finance)' }}>Settings</Link> to see your events.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>Calendar</h1>
            <p>{format(weekStart, 'd MMM')} – {format(addDays(weekStart, 6), 'd MMM yyyy')}</p>
          </div>
          <div className="flex items-center gap-2">
            {needsReconnect && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--warning)' }}>
                <AlertTriangle size={13} />
                <Link to="/settings" style={{ color: 'var(--warning)' }}>Reconnect calendar</Link>
              </div>
            )}
            <button className="btn-icon" title="Previous week" onClick={() => setWeekRef(d => subWeeks(d, 1))}><ChevronLeft size={16} /></button>
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekRef(new Date())}>Today</button>
            <button className="btn-icon" title="Next week" onClick={() => setWeekRef(d => addWeeks(d, 1))}><ChevronRight size={16} /></button>
            <button className="btn-icon" title="Refresh" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      {calendars.length > 0 && (
        <div className="flex items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
          {calendars.map(cal => (
            <div key={cal.id} className="flex items-center gap-1">
              <div style={{ width: 10, height: 10, borderRadius: 3, background: cal.backgroundColor, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{cal.summary}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading…</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
            <div />
            {weekDays.map((day, i) => {
              const isToday = format(day, 'yyyy-MM-dd') === todayStr
              return (
                <div key={i} style={{ padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid var(--border)', background: isToday ? 'var(--career-tint, var(--bg-2))' : 'transparent' }}>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{DAYS[i]}</p>
                  <p style={{ fontSize: 16, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--career)' : 'var(--text)', lineHeight: 1.2 }}>{format(day, 'd')}</p>
                </div>
              )
            })}
          </div>

          {/* All-day row */}
          {allDayEvents.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', minHeight: 28 }}>
              <div style={{ padding: '4px 6px', fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'flex-start' }}>all day</div>
              {allDayByDay.map((dayEvs, di) => (
                <div key={di} style={{ borderLeft: '1px solid var(--border)', padding: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {dayEvs.map(ev => (
                    <div
                      key={ev.id}
                      onClick={() => setSelected(ev)}
                      style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: ev.calendarColor, color: ev.calendarFg || '#fff', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      title={ev.summary}
                    >
                      {ev.summary}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Timed grid — scrollable */}
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', position: 'relative' }}>
              {/* Hour labels */}
              <div style={{ position: 'relative', height: GRID_HEIGHT }}>
                {hours.map(h => (
                  <div key={h} style={{ position: 'absolute', top: (h - GRID_START_HOUR) * HOUR_HEIGHT - 8, left: 0, right: 0, textAlign: 'right', paddingRight: 6 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{h}:00</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day, di) => {
                const isToday = format(day, 'yyyy-MM-dd') === todayStr
                const dayEvs = eventsByDay[di]
                return (
                  <div key={di} style={{ position: 'relative', height: GRID_HEIGHT, borderLeft: '1px solid var(--border)', background: isToday ? 'var(--career-tint, var(--bg-2))' : 'transparent' }}>
                    {/* Hour grid lines */}
                    {hours.map(h => (
                      <div key={h} style={{ position: 'absolute', top: (h - GRID_START_HOUR) * HOUR_HEIGHT, left: 0, right: 0, borderTop: '1px solid var(--border)', opacity: 0.4 }} />
                    ))}

                    {/* Events */}
                    {dayEvs.map(ev => {
                      const startMin = Math.max(0, minutesFromGridStart(ev.start))
                      const endMin = Math.min(GRID_MINUTES, minutesFromGridStart(ev.end))
                      const top = (startMin / 60) * HOUR_HEIGHT
                      const height = Math.max(20, ((endMin - startMin) / 60) * HOUR_HEIGHT - 2)
                      const cols = ev._cols || 1
                      const col = ev._col || 0
                      const width = `calc(${100 / cols}% - 4px)`
                      const left = `calc(${(col / cols) * 100}% + 2px)`
                      const startTime = format(parseISO(ev.start), 'HH:mm')
                      const endTime = format(parseISO(ev.end), 'HH:mm')
                      return (
                        <div
                          key={ev.id}
                          onClick={() => setSelected(ev)}
                          title={`${ev.summary}\n${startTime}–${endTime}`}
                          style={{
                            position: 'absolute',
                            top, left, width, height,
                            background: ev.calendarColor || 'var(--career)',
                            color: ev.calendarFg || '#fff',
                            borderRadius: 4,
                            padding: '2px 5px',
                            fontSize: 10,
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            zIndex: 1,
                          }}
                        >
                          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.summary}</div>
                          {height > 28 && <div style={{ opacity: 0.85, fontSize: 9 }}>{startTime}–{endTime}</div>}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Event detail overlay */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 1100, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setSelected(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 400, width: '100%', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ height: 4, background: selected.calendarColor, borderRadius: '4px 4px 0 0', margin: '-24px -24px 16px' }} />
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{selected.summary}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: selected.calendarColor, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{selected.calendarName}</span>
            </div>
            {selected.allDay ? (
              <p style={{ fontSize: 13, color: 'var(--text-2)' }}>All day · {format(selected.start.length === 10 ? parseISO(selected.start) : new Date(selected.start), 'EEE d MMM')}</p>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                {format(parseISO(selected.start), 'EEE d MMM · HH:mm')} – {format(parseISO(selected.end), 'HH:mm')}
              </p>
            )}
            {selected.location && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>📍 {selected.location}</p>}
            {selected.description && <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, whiteSpace: 'pre-wrap' }}>{selected.description}</p>}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 16 }} onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
