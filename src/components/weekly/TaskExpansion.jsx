import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { TASK_AREAS, parseTimeAllocationToParts, buildTimeAllocation } from '../../lib/constants'
import { Plus, Clock, Target, Send, CalendarDays, SkipForward, Repeat, Tag, Ban, RotateCcw, RefreshCw } from 'lucide-react'
import SubtaskList from '../shared/SubtaskList'

const HOUR_OPTS = Array.from({ length: 9 }, (_, i) => i) // 0-8 hours
const MINUTE_OPTS = [0, 15, 30, 45]
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const FREQUENCIES = ['Daily', 'Weekly', '2x/week', '3x/week', 'One-off']

export default function TaskExpansion({ task, goals, onUpdateField, onDismiss, onToggleSubtask, onAddSubtask, onEditSubtask, onRemoveSubtask, onReorderSubtasks, onPushNextWeek, readOnly }) {
  const { user } = useAuth()
  const [subInput, setSubInput] = useState('')
  const [notes, setNotes] = useState(task.notes || '')
  const [showDismissInput, setShowDismissInput] = useState(false)
  const [dismissReason, setDismissReason] = useState('')
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentInput, setCommentInput] = useState('')
  const subtasks = task.subtasks || []

  useEffect(() => { loadComments() }, [task.id])
  useEffect(() => { setNotes(task.notes || '') }, [task.notes])
  useEffect(() => { setSpecificTask(task.specific_task || '') }, [task.specific_task])
  useEffect(() => { setAction(task.action || '') }, [task.action])

  async function loadComments() {
    setLoadingComments(true)
    const { data } = await supabase.from('comments').select('*').eq('task_id', task.id).order('created_at')
    setComments(data || [])
    setLoadingComments(false)
  }

  async function addComment() {
    const content = commentInput.trim()
    if (!content) return
    const { data } = await supabase.from('comments').insert({ user_id: user.id, task_id: task.id, content }).select().single()
    if (data) setComments(prev => [...prev, data])
    setCommentInput('')
  }

  function submitSub() {
    if (subInput.trim()) { onAddSubtask(subInput.trim()); setSubInput('') }
  }

  const [specificTask, setSpecificTask] = useState(task.specific_task || '')
  const [action, setAction] = useState(task.action || '')
  const locked = readOnly || task.complete

  return (
    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 4px 8px' }}>

      {/* Task title + action */}
      {!locked ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            value={specificTask}
            onChange={e => setSpecificTask(e.target.value)}
            onBlur={() => { if (specificTask.trim() !== (task.specific_task || '')) onUpdateField('specific_task', specificTask.trim()) }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
            placeholder="Task title"
            style={{ fontSize: 14, fontWeight: 600, padding: '6px 8px', width: '100%' }}
          />
          <input
            value={action}
            onChange={e => setAction(e.target.value)}
            onBlur={() => { if (action !== (task.action || '')) onUpdateField('action', action) }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
            placeholder="Area of action (optional)"
            style={{ fontSize: 12, padding: '4px 8px', width: '100%', color: 'var(--text-2)' }}
          />
        </div>
      ) : (
        task.action ? (
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>{task.action}</p>
        ) : null
      )}

      {/* Notes — shown first so it's the first thing visible on expand */}
      <div>
        <p className="mono mb-2" style={{ fontSize: 10 }}>Notes</p>
        {task.prev_notes && (
          <div style={{ marginBottom: 8, padding: '6px 10px', background: 'var(--bg-3)', borderRadius: 6, borderLeft: '2px solid var(--border)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Last week</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, fontStyle: 'italic' }}>{task.prev_notes}</p>
          </div>
        )}
        {locked ? (
          <p style={{ fontSize: 12, color: notes ? 'var(--text-2)' : 'var(--text-3)', fontStyle: notes ? 'normal' : 'italic', lineHeight: 1.5 }}>
            {notes || (task.complete ? 'No notes added.' : 'No notes yet.')}
          </p>
        ) : (
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => { if (notes !== (task.notes || '')) onUpdateField('notes', notes) }}
            placeholder="Any blockers, progress, or context…"
            rows={2}
            style={{ fontSize: 12, width: '100%', resize: 'vertical' }}
          />
        )}
      </div>

      {/* Subtasks */}
      <div>
        <p className="mono mb-2">Subtasks</p>
        {subtasks.length > 0 ? (
          <SubtaskList
            subtasks={subtasks}
            onToggle={locked ? undefined : onToggleSubtask}
            onEditText={locked ? undefined : onEditSubtask}
            onDelete={locked ? undefined : onRemoveSubtask}
            onReorder={locked ? undefined : onReorderSubtasks}
            readOnly={locked}
          />
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No subtasks.</p>
        )}
        {!locked && (
          <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
            <input value={subInput} onChange={e => setSubInput(e.target.value)} placeholder="Add subtask…" style={{ fontSize: 12, flex: 1, maxWidth: 260 }}
              onKeyDown={e => e.key === 'Enter' && submitSub()} />
            <button className="btn btn-career btn-xs" style={{ color: '#fff' }} onClick={submitSub}><Plus size={11} /></button>
          </div>
        )}
      </div>

      {/* Time allocation + linked goal */}
      <div className="flex items-center gap-4 wrap">
        <div className="flex items-center gap-2">
          <Tag size={13} color="var(--text-3)" />
          {locked ? (
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{task.area}</span>
          ) : (
            <select value={task.area} onChange={e => onUpdateField('area', e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }}>
              {TASK_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw size={13} color="var(--text-3)" />
          {locked ? (
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{task.frequency}</span>
          ) : (
            <select value={task.frequency || 'Weekly'} onChange={e => onUpdateField('frequency', e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }}>
              {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Clock size={13} color="var(--text-3)" />
          {(() => {
            const { hours, minutes } = parseTimeAllocationToParts(task.time_allocation)
            if (locked) {
              return <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{hours > 0 || minutes > 0 ? `${hours}h ${minutes}m` : 'No estimate'}</span>
            }
            return (
              <>
                <select value={hours} onChange={e => onUpdateField('time_allocation', buildTimeAllocation(Number(e.target.value), minutes))} style={{ fontSize: 12, padding: '4px 8px' }}>
                  {HOUR_OPTS.map(h => <option key={h} value={h}>{h} hr</option>)}
                </select>
                <select value={minutes} onChange={e => onUpdateField('time_allocation', buildTimeAllocation(hours, Number(e.target.value)))} style={{ fontSize: 12, padding: '4px 8px' }}>
                  {MINUTE_OPTS.map(m => <option key={m} value={m}>{m} min</option>)}
                </select>
              </>
            )
          })()}
        </div>
        {!locked && (
          <>
            <div className="flex items-center gap-2">
              <Target size={13} color="var(--text-3)" />
              <select value={task.goal_id || ''} onChange={e => onUpdateField('goal_id', e.target.value || null)} style={{ fontSize: 12, padding: '4px 8px', maxWidth: 220 }}>
                <option value="">No linked goal</option>
                {goals.map(g => <option key={g.id} value={g.id}>{g.category}: {g.primary_goal?.slice(0, 28)}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays size={13} color="var(--text-3)" />
              <select
                value={task.day_of_week ?? ''}
                onChange={e => onUpdateField('day_of_week', e.target.value === '' ? null : Number(e.target.value))}
                style={{ fontSize: 12, padding: '4px 8px' }}
              >
                <option value="">No specific day</option>
                {DAY_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
              </select>
            </div>
            <button
              className={`btn btn-xs ${task.recurring ? 'btn-career' : 'btn-ghost'}`}
              style={task.recurring ? { color: '#fff' } : {}}
              onClick={() => onUpdateField('recurring', !task.recurring)}
              title="Automatically re-create this task every week"
            >
              <Repeat size={12} /> {task.recurring ? 'Recurring weekly' : 'Make recurring'}
            </button>
          </>
        )}
      </div>

      {/* Comments */}
      <div>
        <p className="mono mb-2">Comments</p>
        {loadingComments ? (
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            {comments.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No comments yet.</p>}
            {comments.map(c => (
              <div key={c.id} style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '6px 10px' }}>
                <span>{c.content}</span>
                <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', marginTop: 3 }}>
                  {c.user_id === user.id ? 'You' : 'Partner'} · {format(new Date(c.created_at), 'd MMM, HH:mm')}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 7 }}>
          <input value={commentInput} onChange={e => setCommentInput(e.target.value)} placeholder="Add a comment…" style={{ fontSize: 12, flex: 1, maxWidth: 320 }}
            onKeyDown={e => e.key === 'Enter' && addComment()} />
          <button className="btn btn-career btn-xs" style={{ color: '#fff' }} onClick={addComment}><Send size={11} /></button>
        </div>
      </div>

      {/* Push to next week / Dismiss */}
      {!task.complete && (onPushNextWeek || onDismiss || onUpdateField) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {onPushNextWeek && (
              <button className="btn btn-ghost btn-sm" onClick={() => onPushNextWeek(task)}>
                <SkipForward size={13} /> Push to next week
              </button>
            )}
            {!showDismissInput && (
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-3)' }} onClick={() => setShowDismissInput(true)} title="Mark as dealt with — moves to a dismissed log">
                <Ban size={13} /> Dismiss
              </button>
            )}
          </div>
          {showDismissInput && (
            <div style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>What happened to this task? <span style={{ color: 'var(--text-3)' }}>(optional)</span></p>
              <textarea
                autoFocus
                value={dismissReason}
                onChange={e => setDismissReason(e.target.value)}
                placeholder="e.g. dealt with it in a meeting, no longer relevant, already done offline…"
                rows={2}
                style={{ fontSize: 12, width: '100%', resize: 'vertical', marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-sm btn-ghost"
                  style={{ color: 'var(--text-3)' }}
                  onClick={() => { onDismiss?.(dismissReason.trim() || null); setShowDismissInput(false) }}
                >
                  <Ban size={12} /> Confirm dismiss
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => { setShowDismissInput(false); setDismissReason('') }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
