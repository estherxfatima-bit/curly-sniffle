import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { fetchCalendarEvents, createCalendarEvent } from '../../lib/googleCalendar'
import { proposeTimeBlocks } from '../../lib/timeBlocking'
import { X, Clock } from 'lucide-react'

export default function TimeBlockModal({ session, todos, date, workingHours, onClose, onApply }) {
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [connected, setConnected] = useState(false)
  const [proposal, setProposal] = useState([])

  async function load() {
    setLoading(true)
    const dayStart = `${date}T00:00:00.000Z`
    const dayEnd = `${date}T23:59:59.999Z`
    const { connected: isConnected, events } = await fetchCalendarEvents(session, dayStart, dayEnd)
    setConnected(isConnected)
    const schedulable = todos.filter(t => !t.complete && t.duration_minutes > 0)
    setProposal(proposeTimeBlocks(schedulable, events || [], workingHours, date))
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirm() {
    setApplying(true)
    const updates = []
    for (const slot of proposal) {
      let googleEventId = null
      if (connected) {
        const result = await createCalendarEvent(session, {
          summary: slot.todoText,
          description: 'Auto-scheduled by Life OS',
          start: slot.start,
          end: slot.end,
        })
        if (result?.id) googleEventId = result.id
      }
      updates.push({ todoId: slot.todoId, scheduled_time: slot.startLabel, google_event_id: googleEventId })
    }
    setApplying(false)
    onApply(updates)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: 420, maxHeight: '75vh', overflow: 'auto', padding: 18 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: '0.95rem' }}>Time-block my day</h3>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Analysing your day…</p>
        ) : proposal.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
            No to-dos with a duration set, or no free slots left today.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
              {connected
                ? 'These slots will be created as events in your Google Calendar.'
                : 'Google Calendar is not connected — slots will be set on your to-dos only.'}
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
