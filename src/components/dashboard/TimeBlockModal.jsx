import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import { fetchCalendarEvents, createCalendarEvent } from '../../lib/googleCalendar'
import { proposeTimeBlocks, toMinutes, minutesToTimeString, dateAndMinutesToISO } from '../../lib/timeBlocking'
import {
  DndContext, closestCenter,
  KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X, AlertCircle, GripVertical, Trash2, Plus, RotateCcw } from 'lucide-react'
import PriorityDot from '../shared/PriorityDot'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

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

// Recalculates start/end times for a sequence of blocks, back-to-back from `dayStart`.
function recalcSequential(blocks, dayStart) {
  let cursor = dayStart
  return blocks.map(b => {
    const startMin = cursor
    const endMin = startMin + b.durationMinutes
    cursor = endMin
    return { ...b, startMin, endMin }
  })
}

function SortableBlock({ block, onChangeTime, onChangeDuration, onChangePriority, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.todoId })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 8px', background: 'var(--bg-3)', borderRadius: 'var(--radius)',
      }}
    >
      <span
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        style={{ display: 'flex', alignItems: 'center', cursor: 'grab', color: 'var(--text-3)', touchAction: 'none', flexShrink: 0 }}
      >
        <GripVertical size={13} />
      </span>
      <PriorityDot priority={block.priority_level} onChange={onChangePriority} size={8} />
      <input
        type="time"
        value={minutesToTimeString(block.startMin)}
        onChange={e => onChangeTime(toMinutes(e.target.value, block.startMin))}
        style={{ fontSize: 11, padding: '3px 4px', width: 84, flexShrink: 0 }}
      />
      <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.todoText}</span>
      <input
        type="number"
        min={5}
        step={5}
        value={block.durationMinutes}
        onChange={e => onChangeDuration(Math.max(5, Number(e.target.value) || 5))}
        title="Duration (minutes)"
        style={{ fontSize: 11, padding: '3px 4px', width: 52, flexShrink: 0 }}
      />
      <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>min</span>
      <button className="btn-icon" onClick={onRemove} title="Remove from schedule" style={{ flexShrink: 0, color: 'var(--text-3)' }}>
        <Trash2 size={12} />
      </button>
    </div>
  )
}

export default function TimeBlockModal({ session, todos, date, workingHours, onClose, onApply }) {
  useLockBodyScroll()
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [connected, setConnected] = useState(false)
  const [proposal, setProposal] = useState([])
  const [originalProposal, setOriginalProposal] = useState([])
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [error, setError] = useState(null)

  const dayStart = toMinutes(workingHours?.start, 9 * 60)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

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
      const dayStartIso = `${date}T00:00:00.000Z`
      const dayEndIso = `${date}T23:59:59.999Z`
      const result = await fetchCalendarEvents(session, dayStartIso, dayEndIso)

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

      const withPriority = proposed.map(p => ({
        ...p,
        priority_level: todos.find(t => t.id === p.todoId)?.priority_level || null,
      }))
      setProposal(withPriority)
      setOriginalProposal(withPriority)
      setLoading(false)
    } catch (err) {
      console.error('[TimeBlockModal] unexpected error generating schedule', err)
      setError('generic')
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const ids = proposal.map(b => b.todoId)
    const oldIdx = ids.indexOf(active.id)
    const newIdx = ids.indexOf(over.id)
    if (oldIdx === -1 || newIdx === -1) return
    setProposal(prev => recalcSequential(arrayMove(prev, oldIdx, newIdx), dayStart))
  }

  function updateBlock(todoId, changes) {
    setProposal(prev => prev.map(b => {
      if (b.todoId !== todoId) return b
      const next = { ...b, ...changes }
      next.endMin = next.startMin + next.durationMinutes
      return next
    }))
  }

  function removeBlock(todoId) {
    setProposal(prev => prev.filter(b => b.todoId !== todoId))
  }

  function addTodoToProposal(todo) {
    setProposal(prev => {
      const duration = todo.duration_minutes > 0 ? todo.duration_minutes : 30
      const startMin = prev.length ? Math.max(...prev.map(b => b.endMin)) : dayStart
      return [...prev, {
        todoId: todo.id,
        todoText: todo.text,
        durationMinutes: duration,
        startMin,
        endMin: startMin + duration,
        priority_level: todo.priority_level || null,
      }]
    })
    setShowAddMenu(false)
  }

  function clearAll() {
    setProposal(originalProposal)
  }

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
            start: dateAndMinutesToISO(date, slot.startMin),
            end: dateAndMinutesToISO(date, slot.endMin),
          })
          if (result?.id) {
            googleEventId = result.id
          } else if (result?.error) {
            console.error('[TimeBlockModal] failed to create calendar event', result.error, slot)
          }
        }
        updates.push({ todoId: slot.todoId, scheduled_time: minutesToTimeString(slot.startMin), google_event_id: googleEventId })
      }
      onApply(updates)
    } catch (err) {
      console.error('[TimeBlockModal] unexpected error applying schedule', err)
    } finally {
      setApplying(false)
    }
  }

  const errorInfo = error ? ERRORS[error] : null
  const addableTodos = todos.filter(t => !t.complete && !proposal.some(b => b.todoId === t.id))
  const sortedProposal = [...proposal].sort((a, b) => a.startMin - b.startMin)

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: 460, maxHeight: '80vh', overflow: 'auto', padding: 18 }} onClick={e => e.stopPropagation()}>
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
              Drag to reorder, or edit the time and duration of each block. {connected ? 'These slots will be created as events in your Google Calendar.' : ''}
            </p>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sortedProposal.map(b => b.todoId)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {sortedProposal.map(block => (
                    <SortableBlock
                      key={block.todoId}
                      block={block}
                      onChangeTime={startMin => updateBlock(block.todoId, { startMin })}
                      onChangeDuration={durationMinutes => updateBlock(block.todoId, { durationMinutes })}
                      onChangePriority={v => updateBlock(block.todoId, { priority_level: v })}
                      onRemove={() => removeBlock(block.todoId)}
                    />
                  ))}
                  {sortedProposal.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
                      No blocks left — add a todo below or close to cancel.
                    </p>
                  )}
                </div>
              </SortableContext>
            </DndContext>

            <div className="flex items-center gap-2 wrap mb-3">
              <div style={{ position: 'relative' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddMenu(v => !v)} disabled={addableTodos.length === 0}>
                  <Plus size={13} /> Add todo
                </button>
                {showAddMenu && (
                  <div className="card" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 10, width: 240, maxHeight: 180, overflow: 'auto', padding: 6 }}>
                    {addableTodos.length === 0 ? (
                      <p style={{ fontSize: 12, color: 'var(--text-3)', padding: 6 }}>All todos are already scheduled.</p>
                    ) : addableTodos.map(t => (
                      <button
                        key={t.id}
                        className="btn btn-ghost btn-sm"
                        style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', fontSize: 12 }}
                        onClick={() => addTodoToProposal(t)}
                      >
                        {t.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={clearAll}>
                <RotateCcw size={13} /> Clear all
              </button>
            </div>

            <button className="btn btn-career" style={{ color: '#fff', width: '100%' }} onClick={handleConfirm} disabled={applying || sortedProposal.length === 0}>
              {applying ? 'Applying…' : `Confirm and add to calendar — ${format(new Date(`${date}T00:00:00`), 'EEE d MMM')}`}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
