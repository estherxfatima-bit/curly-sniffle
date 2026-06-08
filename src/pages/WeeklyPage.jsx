import { useState, useEffect } from 'react'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { TASK_AREAS } from '../lib/constants'
import { ChevronLeft, ChevronRight, Plus, Trash2, RotateCcw, MessageSquare, Check } from 'lucide-react'
import WeeklyReviewModal from '../components/weekly/WeeklyReviewModal'
import PastReviews from '../components/weekly/PastReviews'

const FREQUENCIES = ['Daily', 'Weekly', '2x/week', '3x/week', 'One-off']

export default function WeeklyPage() {
  const { user } = useAuth()
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [tasks, setTasks] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddRow, setShowAddRow] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showPastReviews, setShowPastReviews] = useState(false)
  const [editingNote, setEditingNote] = useState(null) // task id
  const [newTask, setNewTask] = useState({ area: 'Career', action: '', frequency: 'Weekly', specific_task: '', goal_id: '' })

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')

  useEffect(() => {
    if (user) {
      loadTasks()
      loadGoals()
    }
  }, [user, currentWeek])

  useEffect(() => {
    // Open review modal if ?review=1 in URL
    if (window.location.search.includes('review=1')) setShowReview(true)
  }, [])

  async function loadTasks() {
    setLoading(true)
    const { data } = await supabase
      .from('weekly_tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', weekStartStr)
      .order('created_at')
    setTasks(data || [])
    setLoading(false)
  }

  async function loadGoals() {
    const { data } = await supabase.from('goals').select('id, primary_goal, category').eq('user_id', user.id)
    setGoals(data || [])
  }

  async function addTask() {
    if (!newTask.specific_task.trim()) return
    const { data } = await supabase.from('weekly_tasks').insert({
      user_id: user.id,
      week_start: weekStartStr,
      area: newTask.area,
      action: newTask.action,
      frequency: newTask.frequency,
      specific_task: newTask.specific_task,
      goal_id: newTask.goal_id || null,
      complete: false,
      carried_forward: false,
    }).select().single()
    if (data) setTasks(prev => [...prev, data])
    setNewTask({ area: 'Career', action: '', frequency: 'Weekly', specific_task: '', goal_id: '' })
    setShowAddRow(false)
  }

  async function toggleTask(task) {
    const newVal = !task.complete
    await supabase.from('weekly_tasks').update({ complete: newVal }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, complete: newVal } : t))
  }

  async function deleteTask(id) {
    await supabase.from('weekly_tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function carryForwardIncomplete() {
    const nextWeekStart = format(addWeeks(weekStart, 1), 'yyyy-MM-dd')
    const incomplete = tasks.filter(t => !t.complete)
    if (incomplete.length === 0) return

    const toInsert = incomplete.map(t => ({
      user_id: user.id,
      week_start: nextWeekStart,
      area: t.area,
      action: t.action,
      frequency: t.frequency,
      specific_task: t.specific_task,
      goal_id: t.goal_id,
      complete: false,
      carried_forward: true,
      notes: t.notes,
    }))
    await supabase.from('weekly_tasks').insert(toInsert)
    alert(`${incomplete.length} task(s) carried forward to next week`)
  }

  async function saveNote(taskId, note) {
    await supabase.from('weekly_tasks').update({ notes: note }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, notes: note } : t))
    setEditingNote(null)
  }

  const groupedByArea = TASK_AREAS.map(area => ({
    area,
    tasks: tasks.filter(t => t.area === area),
  })).filter(g => g.tasks.length > 0 || showAddRow)

  const incompleteCount = tasks.filter(t => !t.complete).length

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>Weekly Plan</h1>
            <p>{format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPastReviews(true)}>
              Past reviews
            </button>
            <button className="btn btn-accent btn-sm" onClick={() => setShowReview(true)}>
              Weekly review
            </button>
          </div>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-3 mb-4">
        <button className="btn-icon btn" onClick={() => setCurrentWeek(w => subWeeks(w, 1))}>
          <ChevronLeft size={16} />
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setCurrentWeek(new Date())}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}
        >
          This week
        </button>
        <button className="btn-icon btn" onClick={() => setCurrentWeek(w => addWeeks(w, 1))}>
          <ChevronRight size={16} />
        </button>

        <div style={{ flex: 1 }} />

        {incompleteCount > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={carryForwardIncomplete}>
            <RotateCcw size={13} />
            Carry forward ({incompleteCount})
          </button>
        )}
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddRow(v => !v)}>
          <Plus size={14} />
          Add task
        </button>
      </div>

      {/* Task table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '28px' }}></th>
              <th>Area</th>
              <th>Action</th>
              <th>Frequency</th>
              <th>Specific Task</th>
              <th>Goal</th>
              <th style={{ width: '80px' }}>Status</th>
              <th style={{ width: '72px' }}></th>
            </tr>
          </thead>
          <tbody>
            {showAddRow && (
              <tr style={{ background: 'var(--bg-3)' }}>
                <td></td>
                <td>
                  <select value={newTask.area} onChange={e => setNewTask(p => ({ ...p, area: e.target.value }))} style={{ fontSize: '12px', padding: '4px 8px' }}>
                    {TASK_AREAS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </td>
                <td>
                  <input value={newTask.action} onChange={e => setNewTask(p => ({ ...p, action: e.target.value }))} placeholder="What area of action" style={{ fontSize: '12px', padding: '4px 8px' }} />
                </td>
                <td>
                  <select value={newTask.frequency} onChange={e => setNewTask(p => ({ ...p, frequency: e.target.value }))} style={{ fontSize: '12px', padding: '4px 8px' }}>
                    {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                  </select>
                </td>
                <td>
                  <input value={newTask.specific_task} onChange={e => setNewTask(p => ({ ...p, specific_task: e.target.value }))} placeholder="Specific task" style={{ fontSize: '12px', padding: '4px 8px' }} onKeyDown={e => e.key === 'Enter' && addTask()} />
                </td>
                <td>
                  <select value={newTask.goal_id} onChange={e => setNewTask(p => ({ ...p, goal_id: e.target.value }))} style={{ fontSize: '12px', padding: '4px 8px' }}>
                    <option value="">No goal</option>
                    {goals.map(g => <option key={g.id} value={g.id}>{g.category}: {g.primary_goal?.slice(0, 30)}</option>)}
                  </select>
                </td>
                <td></td>
                <td>
                  <div className="flex items-center gap-1">
                    <button className="btn btn-primary btn-sm" onClick={addTask}>Add</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAddRow(false)}>✕</button>
                  </div>
                </td>
              </tr>
            )}

            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>Loading…</td></tr>
            ) : tasks.length === 0 && !showAddRow ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>No tasks this week — click "Add task" to start</td></tr>
            ) : (
              tasks.map(task => (
                <>
                  <tr key={task.id} style={{ opacity: task.complete ? 0.55 : 1 }}>
                    <td>
                      <div
                        className={`toggle-dot ${task.complete ? 'done' : ''}`}
                        onClick={() => toggleTask(task)}
                        style={{ margin: '0 auto' }}
                      >
                        {task.complete && <Check size={11} color="white" strokeWidth={3} />}
                      </div>
                    </td>
                    <td>
                      <span className="mono" style={{ color: 'var(--text-2)' }}>{task.area}</span>
                    </td>
                    <td style={{ color: 'var(--text-2)', fontSize: '12px' }}>{task.action}</td>
                    <td><span className="mono" style={{ color: 'var(--text-3)' }}>{task.frequency}</span></td>
                    <td>
                      <span style={{ textDecoration: task.complete ? 'line-through' : 'none', fontSize: '13px' }}>
                        {task.specific_task}
                      </span>
                      {task.carried_forward && <span className="badge badge-warning" style={{ marginLeft: '6px' }}>carried</span>}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                      {goals.find(g => g.id === task.goal_id)?.primary_goal?.slice(0, 24) || '—'}
                    </td>
                    <td>
                      {task.complete ? (
                        <span className="badge badge-success">Done</span>
                      ) : (
                        <span className="badge badge-muted">Open</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="btn-icon btn"
                          title="Notes"
                          onClick={() => setEditingNote(editingNote === task.id ? null : task.id)}
                          style={{ color: task.notes ? 'var(--accent)' : undefined }}
                        >
                          <MessageSquare size={13} />
                        </button>
                        <button className="btn-icon btn" onClick={() => deleteTask(task.id)} title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingNote === task.id && (
                    <tr key={`note-${task.id}`} style={{ background: 'var(--bg-3)' }}>
                      <td colSpan={8} style={{ padding: '8px 16px' }}>
                        <NoteEditor task={task} onSave={saveNote} />
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showReview && (
        <WeeklyReviewModal
          weekStart={weekStartStr}
          incompleteTasks={tasks.filter(t => !t.complete)}
          onClose={() => setShowReview(false)}
          onComplete={carryForwardIncomplete}
        />
      )}

      {showPastReviews && (
        <PastReviews onClose={() => setShowPastReviews(false)} />
      )}
    </div>
  )
}

function NoteEditor({ task, onSave }) {
  const [note, setNote] = useState(task.notes || '')
  return (
    <div className="flex items-center gap-2">
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Add a note or comment…"
        style={{ fontSize: '12px' }}
        onKeyDown={e => e.key === 'Enter' && onSave(task.id, note)}
        autoFocus
      />
      <button className="btn btn-primary btn-sm" onClick={() => onSave(task.id, note)}>Save</button>
    </div>
  )
}
