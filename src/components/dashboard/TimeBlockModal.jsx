import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import { fetchCalendarEvents, createCalendarEvent } from '../../lib/googleCalendar'
import { proposeTimeBlocks } from '../../lib/timeBlocking'
import { X, Clock, AlertCircle } from 'lucide-react'

// Error states the modal can land in before a schedule is generated.
const ERRORS = {
  no_duration: {
    text: 'None of your todos have a duration set. Add a duration to at least one todo to use this feature.',
    link: null,
  },
  no_hours: {
    text: 'Set your working hours in Settings first.',
    link: { to: '/settings', label: 'Open Settings' },
  },
  not_connected: {
    text: 'Time-blocking needs Google Calendar.',
    link: { to: '/settings', label: 'Connect it in Settings' },
  },
  expired: {
    text: 'Your Google Calendar connection has expired.',
    link: { to: '/settings', label: 'Reconnect in Settings' },
  },
  no_slots: {
    text: 'No free slots found in your working hours today. Your calendar may be fully booked.',
    link: null,
  },
  generic: {
    text: 'Something went wrong while generating your schedule. Please try again.',
    link: null,
  },
}

export default function TimeBlockModal({ session, todos, date, workingHours, onClose, onApply }) {
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [connected, setConnected] = useState(false)
  const [proposal, setProposal] = useState([])
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)

    const schedulable = todos.filter(t => !t.complete && t.duration_minutes > 0)
    if (schedulable.length === 0) {
      console.error('[TimeBlockModal] no todos with duration_minutes set', { todos })
      setError('no_duration')
      setLoading(false)
      return
    }

    if (!workingHours?.start || !workingHours?.end) {
      console.error('[TimeBlockModal] working hours not set', { workingHours })
      setError('no_hours')
      setLoading(false)
      return
    }

    try {
      const dayStart = `${date}T00:00:00.000Z`
      const dayEnd = `${date}T23:59:59.999Z`
      const result = await fetchCalendarEvents(session, dayStart, dayEnd)

      if (!result.connected) {
        if (result.error) {
          console.error('[TimeBlockModal] Google Calendar token expired/invalid', result.error)
          setError('expired')
        } else {
          console.error('[TimeBlockModal] Google Calendar not connected')
          setError('not_connected')
        }
        setLoading(false)
        return
      }

      setConnected(true)

      if (result.error) {
        console.error('[TimeBlockModal] error fetching calendar events', result.error)
      }

      const proposed = proposeTimeBlocks(schedulable, result.events || [], workingHours, date)
      if (proposed.length === 0) {
        console.error('[TimeBlockModal] no free slots available', { schedulable, events: result.events, workingHours, date })
        setError('no_slots')
        setLoading(false)
        return
      }

      setProposal(proposed)
      setLoading(false)
    } catch (err) {
      console.error('[TimeBlockModal] unexpected error generating schedule', err)
      setError('generic')
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirm() {
    setApplying(true)
    const updates = []
    try {
      for (const slot of proposal) {
        let googleEventId = null
        if (connected) {
          const result = await createCalendarEvent(session, {
            summary: slot.todoText,
            description: 'Auto-scheduled by Life OS',
            start: slot.start,
            end: slot.end,
          })
          if (result?.id) {
            googleEventId = result.id
          } else if (result?.error) {
            console.error('[TimeBlockModal] failed to create calendar event', result.error, slot)
          }
        }
        updates.push({ todoId: slot.todoId, scheduled_time: slot.startLabel, google_event_id: googleEventId })
      }
      onApply(updates)
    } catch (err) {
      console.error('[TimeBlockModal] unexpected error applying schedule', err)
    } finally {
      setApplying(false)
    }
  }

  const errorInfo = error ? ERRORS[error] : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: 420, maxHeight: '75vh', overflow: 'auto', padding: 18 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: '0.95rem' }}>Time-block my day</h3>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 0' }}>
            <span className="spinner" style={{
              width: 22, height: 22, borderRadius: '50%',
              border: '2px solid var(--border)', borderTopColor: 'var(--career)',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Analysing your day…</p>
          </div>
        ) : errorInfo ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <AlertCircle size={22} color="var(--text-3)" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{errorInfo.text}</p>
            {errorInfo.link && (
              <Link to={errorInfo.link.to} style={{ fontSize: 12, color: 'var(--career)', display: 'inline-block', marginTop: 8 }} onClick={onClose}>
                {errorInfo.link.label} →
              </Link>
            )}
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
              These slots will be created as events in your Google Calendar.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {proposal.map(slot => (
                <div key={slot.todoId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-3)', borderRadius: 'var(--radius)' }}>
                  <Clock size={12} color="var(--text-3)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)', flexShrink: 0 }}>{slot.startLabel}–{slot.endLabel}</span>
                  <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.todoText}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 'auto', flexShrink: 0 }}>{slot.durationMinutes}m</span>
                </div>
              ))}
            </div>
            <button className="btn btn-career" style={{ color: '#fff', width: '100%' }} onClick={handleConfirm} disabled={applying}>
              {applying ? 'Applying…' : `Confirm schedule for ${format(new Date(`${date}T00:00:00`), 'EEE d MMM')}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
