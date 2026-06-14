import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Plus, Check, Clock, Target, Send, CalendarDays } from 'lucide-react'

const TIME_OPTS = ['15 min', '30 min', '45 min', '1 hr', '1.5 hr', '2 hr', '3 hr']
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function TaskExpansion({ task, goals, onUpdateField, onToggleSubtask, onAddSubtask }) {
  const { user } = useAuth()
  const [subInput, setSubInput] = useState('')
  const [notes, setNotes] = useState(task.notes || '')
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [commentInput, setCommentInput] = useState('')
  const subtasks = task.subtasks || []

  useEffect(() => { loadComments() }, [task.id])

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

  return (
    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 4px 8px' }}>
      {/* Subtasks */}
      <div>
        <p className="mono mb-2">Subtasks</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {subtasks.map(s => (
            <div key={s.id} onClick={() => onToggleSubtask(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <div className={`toggle-dot ${s.complete ? 'done' : ''}`} style={{ width: 16, height: 16, flexShrink: 0 }}>
                {s.complete && <Check size={8} color="white" strokeWidth={3} />}
              </div>
              <span style={{ fontSize: 12, color: s.complete ? 'var(--text-3)' : 'var(--text-2)', textDecoration: s.complete ? 'line-through' : 'none' }}>{s.text}</span>
            </div>
          ))}
          {subtasks.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No subtasks yet.</p>}
        </div>
        <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
          <input value={subInput} onChange={e => setSubInput(e.target.value)} placeholder="Add subtask…" style={{ fontSize: 12, flex: 1, maxWidth: 260 }}
            onKeyDown={e => e.key === 'Enter' && submitSub()} />
          <button className="btn btn-career btn-xs" style={{ color: '#fff' }} onClick={submitSub}><Plus size={11} /></button>
        </div>
      </div>

      {/* Time allocation + linked goal */}
      <div className="flex items-center gap-4 wrap">
        <div className="flex items-center gap-2">
          <Clock size={13} color="var(--text-3)" />
          <select value={task.time_allocation || ''} onChange={e => onUpdateField('time_allocation', e.target.value || null)} style={{ fontSize: 12, padding: '4px 8px' }}>
            <option value="">No time set</option>
            {TIME_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
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
      </div>

      {/* Notes */}
      <div>
        <p className="mono mb-2">Notes</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={() => { if (notes !== (task.notes || '')) onUpdateField('notes', notes) }}
          placeholder="Add a note…"
          rows={2}
          style={{ fontSize: 12, width: '100%', resize: 'vertical' }}
        />
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
    </div>
  )
}
