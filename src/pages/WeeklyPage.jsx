import { useState, useEffect, Fragment } from 'react'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { TASK_AREAS, AREA_COLORS } from '../lib/constants'
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Trash2, RotateCcw, MessageSquare, Check, Target } from 'lucide-react'
import WeeklyReviewModal from '../components/weekly/WeeklyReviewModal'
import PastReviews from '../components/weekly/PastReviews'
import WeeklyQuote from '../components/dashboard/WeeklyQuote'
import TaskExpansion from '../components/weekly/TaskExpansion'
import WeeklyTaskCard from '../components/weekly/WeeklyTaskCard'
import WeeklyAgenda from '../components/calendar/WeeklyAgenda'
import ArcRing from '../components/ui/ArcRing'
import GoalTaskPicker from '../components/dashboard/GoalTaskPicker'

const FREQUENCIES = ['Daily', 'Weekly', '2x/week', '3x/week', 'One-off']
const DAY_SHORT_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function areaColor(area) {
  return AREA_COLORS[area] || AREA_COLORS.Other
}

function goalProgress(goal, metrics, allTasks) {
  if (goal.tracking_type === 'metric') {
    const start = Number(goal.metric_start ?? 0)
    const target = Number(goal.metric_target ?? 0)
    const hist = metrics.filter(m => m.goal_id === goal.id)
    const current = hist.length ? Number(hist[hist.length - 1].value) : start
    const span = target - start
    return span !== 0 ? Math.round(Math.min(Math.max((current - start) / span, 0), 1) * 100) : 0
  }
  const linked = allTasks.filter(t => t.goal_id === goal.id)
  const total = linked.length
  const done = linked.filter(t => t.complete).length
  return total ? Math.round((done / total) * 100) : 0
}

function WeekDecoration() {
  return (
    <svg width="110" height="70" viewBox="0 0 110 70" fill="none">
      {[0,1,2,3,4,5,6].map(i => (
        <rect key={i} x={8 + i*14} y={18} width={10} height={34} rx={3} fill="currentColor" opacity={0.08 + i * 0.04} />
      ))}
      <rect x="8" y="10" width="94" height="2" rx="1" fill="currentColor" opacity="0.2"/>
      <rect x="8" y="58" width="94" height="2" rx="1" fill="currentColor" opacity="0.2"/>
    </svg>
  )
}

export default function WeeklyPage() {
  const { user } = useAuth()
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [tasks, setTasks] = useState([])
  const [goals, setGoals] = useState([])
  const [metrics, setMetrics] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddRow, setShowAddRow] = useState(false)
  const [showGoalPicker, setShowGoalPicker] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showPastReviews, setShowPastReviews] = useState(false)
  const [expandedTask, setExpandedTask] = useState(null)
  const [groupBy, setGroupBy] = useState('area')
  const [newTask, setNewTask] = useState({ area: 'Career', action: '', frequency: 'Weekly', specific_task: '', goal_id: '' })
  const [savedQuote, setSavedQuote] = useState(null)

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd   = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')

  useEffect(() => { if (user) { loadTasks(); loadGoals(); loadQuote() } }, [user, currentWeek])
  useEffect(() => { if (window.location.search.includes('review=1')) setShowReview(true) }, [])

  async function loadQuote() {
    const { data } = await supabase.from('weekly_quotes').select('quote').eq('user_id', user.id).eq('week_start', weekStartStr).maybeSingle()
    setSavedQuote(data?.quote || null)
  }

  async function loadTasks() {
    setLoading(true)
    const { data } = await supabase.from('weekly_tasks').select('*')
      .eq('user_id', user.id).eq('week_start', weekStartStr).eq('archived', false).order('created_at')
    setTasks(data || [])
    setLoading(false)
  }

  async function loadGoals() {
    const { data: goalsData } = await supabase.from('goals').select('*').eq('user_id', user.id)
    setGoals(goalsData || [])
    const { data: metricsData } = await supabase.from('goal_metrics').select('*').eq('user_id', user.id).order('recorded_at')
    setMetrics(metricsData || [])
  }

  async function addTask() {
    if (!newTask.specific_task.trim()) return
    const { data } = await supabase.from('weekly_tasks').insert({
      user_id: user.id, week_start: weekStartStr, ...newTask,
      goal_id: newTask.goal_id || null, complete: false, carried_forward: false,
    }).select().single()
    if (data) setTasks(prev => [...prev, data])
    setNewTask({ area: 'Career', action: '', frequency: 'Weekly', specific_task: '', goal_id: '' })
    setShowAddRow(false)
  }

  async function pullFromGoalTask(goal, task) {
    const area = goal.category === 'Wellness' ? 'Health/Wellness' : goal.category
    const { data } = await supabase.from('weekly_tasks').insert({
      user_id: user.id, week_start: weekStartStr,
      area, action: goal.primary_goal?.slice(0, 60) || '', frequency: 'One-off',
      specific_task: task.text, goal_id: goal.id,
      complete: false, carried_forward: false,
    }).select().single()
    if (data) setTasks(prev => [...prev, data])

    const remaining = goal.tasks.filter(t => t.id !== task.id)
    await supabase.from('goals').update({ tasks: remaining }).eq('id', goal.id)
    setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, tasks: remaining } : g))
    setShowGoalPicker(false)
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

  async function pushToNextWeek(task) {
    const nextWeekStart = format(addWeeks(weekStart, 1), 'yyyy-MM-dd')
    await supabase.from('weekly_tasks').insert({
      user_id: user.id, week_start: nextWeekStart, area: task.area, action: task.action,
      frequency: task.frequency, specific_task: task.specific_task, goal_id: task.goal_id,
      complete: false, carried_forward: true, notes: task.notes, subtasks: task.subtasks, time_allocation: task.time_allocation,
    })
    await supabase.from('weekly_tasks').update({ archived: true }).eq('id', task.id)
    setTasks(prev => prev.filter(t => t.id !== task.id))
    if (expandedTask === task.id) setExpandedTask(null)
  }

  async function carryForwardIncomplete() {
    const nextWeekStart = format(addWeeks(weekStart, 1), 'yyyy-MM-dd')
    const incomplete = tasks.filter(t => !t.complete)
    if (!incomplete.length) return
    await supabase.from('weekly_tasks').insert(
      incomplete.map(t => ({ user_id: user.id, week_start: nextWeekStart, area: t.area, action: t.action, frequency: t.frequency, specific_task: t.specific_task, goal_id: t.goal_id, complete: false, carried_forward: true, notes: t.notes, subtasks: t.subtasks, time_allocation: t.time_allocation }))
    )
    alert(`${incomplete.length} task(s) carried forward to next week`)
  }

  async function updateTaskField(taskId, field, value) {
    await supabase.from('weekly_tasks').update({ [field]: value }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t))
  }

  async function toggleSubtask(task, subId) {
    const subs = (task.subtasks || []).map(s => s.id === subId ? { ...s, complete: !s.complete } : s)
    await supabase.from('weekly_tasks').update({ subtasks: subs }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, subtasks: subs } : t))
  }

  async function addSubtask(task, text) {
    const subs = [...(task.subtasks || []), { id: crypto.randomUUID(), text, complete: false }]
    await supabase.from('weekly_tasks').update({ subtasks: subs }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, subtasks: subs } : t))
  }

  const incompleteCount = tasks.filter(t => !t.complete).length
  const doneCount = tasks.filter(t => t.complete).length

  // Build groups based on the grouping toggle
  let groups = []
  if (groupBy === 'area') {
    groups = TASK_AREAS.map(area => ({
      key: area, label: area, color: areaColor(area), tasks: tasks.filter(t => t.area === area),
    })).filter(g => g.tasks.length)
  } else {
    groups = goals.map(g => ({
      key: g.id, label: g.primary_goal, goal: g, pct: goalProgress(g, metrics, tasks), tasks: tasks.filter(t => t.goal_id === g.id),
    })).filter(g => g.tasks.length)
    const ungrouped = tasks.filter(t => !t.goal_id)
    if (ungrouped.length) groups.push({ key: 'ungrouped', label: 'Ungrouped', tasks: ungrouped })
  }

  return (
    <div>
      <div className="card mb-5">
        <WeeklyQuote userId={user.id} weekStart={weekStartStr} savedQuote={savedQuote} onSave={setSavedQuote} />
      </div>

      {/* Header */}
      <div className="page-header header-career mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>Weekly Plan</h1>
            <p>{format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}</p>
            <div className="flex items-center gap-3 mt-3">
              <span className="badge badge-career">{doneCount} done</span>
              {incompleteCount > 0 && <span className="badge badge-warning">{incompleteCount} remaining</span>}
            </div>
          </div>
          <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPastReviews(true)}>Past reviews</button>
            <button className="btn btn-career btn-sm" style={{ color: '#fff' }} onClick={() => setShowReview(true)}>Weekly review</button>
          </div>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--career)' }}><WeekDecoration /></div>
      </div>

      {/* Week nav */}
      <div className="flex items-center gap-3 mb-5 wrap">
        <button className="btn btn-icon" onClick={() => setCurrentWeek(w => subWeeks(w, 1))}><ChevronLeft size={16} /></button>
        <button className="btn btn-ghost btn-sm" onClick={() => setCurrentWeek(new Date())} style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>This week</button>
        <button className="btn btn-icon" onClick={() => setCurrentWeek(w => addWeeks(w, 1))}><ChevronRight size={16} /></button>

        {/* Grouping toggle */}
        <div className="flex items-center gap-1" style={{ marginLeft: 8 }}>
          <button className={`btn btn-xs ${groupBy === 'area' ? 'btn-career' : 'btn-ghost'}`} style={groupBy === 'area' ? { color: '#fff' } : {}} onClick={() => setGroupBy('area')}>Group by Area</button>
          <button className={`btn btn-xs ${groupBy === 'goal' ? 'btn-career' : 'btn-ghost'}`} style={groupBy === 'goal' ? { color: '#fff' } : {}} onClick={() => setGroupBy('goal')}>Group by Goal</button>
        </div>

        <div style={{ flex: 1 }} />
        {incompleteCount > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={carryForwardIncomplete}>
            <RotateCcw size={13} /> Carry forward ({incompleteCount})
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => setShowGoalPicker(true)}>
          <Target size={13} /> Pull from goal
        </button>
        <button className="btn btn-career btn-sm" style={{ color: '#fff' }} onClick={() => setShowAddRow(v => !v)}>
          <Plus size={14} /> Add task
        </button>
      </div>

      {/* Table — desktop/tablet */}
      <div className="card weekly-table-view" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th>Area</th>
              <th>Action</th>
              <th>Frequency</th>
              <th>Specific Task</th>
              <th>Goal</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 56 }}></th>
            </tr>
          </thead>
          <tbody>
            {showAddRow && (
              <tr style={{ background: 'var(--career-tint)' }}>
                <td />
                <td><select value={newTask.area} onChange={e => setNewTask(p => ({ ...p, area: e.target.value }))} style={{ fontSize: 12, padding: '4px 8px' }}>{TASK_AREAS.map(a => <option key={a}>{a}</option>)}</select></td>
                <td><input value={newTask.action} onChange={e => setNewTask(p => ({ ...p, action: e.target.value }))} placeholder="Area of action" style={{ fontSize: 12, padding: '4px 8px' }} /></td>
                <td><select value={newTask.frequency} onChange={e => setNewTask(p => ({ ...p, frequency: e.target.value }))} style={{ fontSize: 12, padding: '4px 8px' }}>{FREQUENCIES.map(f => <option key={f}>{f}</option>)}</select></td>
                <td><input value={newTask.specific_task} onChange={e => setNewTask(p => ({ ...p, specific_task: e.target.value }))} placeholder="Specific task" style={{ fontSize: 12, padding: '4px 8px' }} onKeyDown={e => e.key === 'Enter' && addTask()} /></td>
                <td>
                  <select value={newTask.goal_id} onChange={e => setNewTask(p => ({ ...p, goal_id: e.target.value }))} style={{ fontSize: 12, padding: '4px 8px' }}>
                    <option value="">No goal</option>
                    {goals.map(g => <option key={g.id} value={g.id}>{g.category}: {g.primary_goal?.slice(0, 28)}</option>)}
                  </select>
                </td>
                <td />
                <td><div className="flex gap-1"><button className="btn btn-career btn-sm" style={{ color: '#fff' }} onClick={addTask}>Add</button><button className="btn btn-ghost btn-sm" onClick={() => setShowAddRow(false)}>✕</button></div></td>
              </tr>
            )}
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>Loading…</td></tr>
            ) : tasks.length === 0 && !showAddRow ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', fontStyle: 'italic' }}>No tasks this week — click "Add task" to start</td></tr>
            ) : (
              groups.map(group => (
                <Fragment key={group.key}>
                  <tr style={{ background: 'var(--bg-2)' }}>
                    <td colSpan={8} style={{ padding: '8px 16px' }}>
                      {groupBy === 'area' ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: group.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {group.label}
                        </span>
                      ) : (
                        <div className="flex items-center gap-3">
                          {group.goal && <ArcRing value={group.pct} max={100} size={28} strokeWidth={3} color="var(--career)" label={`${group.pct}%`} fontSize={8} />}
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{group.label}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                  {group.tasks.map(task => {
                    const expanded = expandedTask === task.id
                    return (
                      <Fragment key={task.id}>
                        <tr
                          onClick={() => setExpandedTask(expanded ? null : task.id)}
                          style={{ opacity: task.complete ? 0.55 : 1, transition: 'opacity 0.2s', cursor: 'pointer', borderLeft: `3px solid ${areaColor(task.area)}` }}
                        >
                          <td>
                            <div className={`toggle-dot ${task.complete ? 'done' : ''}`} onClick={e => { e.stopPropagation(); toggleTask(task) }} style={{ margin: '0 auto' }}>
                              {task.complete && <Check size={11} color="white" strokeWidth={3} />}
                            </div>
                          </td>
                          <td><span className="badge" style={{ background: `${areaColor(task.area)}22`, color: areaColor(task.area) }}>{task.area}</span></td>
                          <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{task.action}</td>
                          <td><span className="mono">{task.frequency}</span></td>
                          <td>
                            <div className="flex items-center gap-1">
                              <ChevronDown size={12} color="var(--text-3)" style={{ flexShrink: 0, transform: expanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                              <span style={{ textDecoration: task.complete ? 'line-through' : 'none', fontSize: 13 }}>{task.specific_task}</span>
                              {task.carried_forward && <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: 9 }}>carried</span>}
                              {task.day_of_week != null && <span className="badge" style={{ marginLeft: 6, fontSize: 9, background: 'var(--career-tint)', color: 'var(--career)' }}>{DAY_SHORT_LABELS[task.day_of_week]}</span>}
                              {task.notes && <MessageSquare size={11} color="var(--creative)" style={{ flexShrink: 0 }} />}
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{goals.find(g => g.id === task.goal_id)?.primary_goal?.slice(0, 24) || '—'}</td>
                          <td>{task.complete ? <span className="badge badge-success">Done</span> : <span className="badge badge-muted">Open</span>}</td>
                          <td>
                            <div className="flex items-center gap-1">
                              {!task.complete && (
                                <button className="btn-icon btn" title="Push to next week" onClick={e => { e.stopPropagation(); pushToNextWeek(task) }}><ChevronRight size={13} /></button>
                              )}
                              <button className="btn-icon btn" onClick={e => { e.stopPropagation(); deleteTask(task.id) }}><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr style={{ background: 'var(--bg-2)' }}>
                            <td colSpan={8} style={{ padding: '8px 20px 14px' }}>
                              <TaskExpansion
                                task={task}
                                goals={goals}
                                onUpdateField={(field, value) => updateTaskField(task.id, field, value)}
                                onToggleSubtask={subId => toggleSubtask(task, subId)}
                                onAddSubtask={text => addSubtask(task, text)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Cards — mobile */}
      <div className="weekly-card-view">
        {loading ? (
          <p style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>Loading…</p>
        ) : tasks.length === 0 && !showAddRow ? (
          <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', fontStyle: 'italic' }}>No tasks this week — tap "Add task" to start</p>
        ) : (
          groups.map(group => (
            <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ padding: '4px 2px' }}>
                {groupBy === 'area' ? (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: group.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {group.label}
                  </span>
                ) : (
                  <div className="flex items-center gap-3">
                    {group.goal && <ArcRing value={group.pct} max={100} size={28} strokeWidth={3} color="var(--career)" label={`${group.pct}%`} fontSize={8} />}
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{group.label}</span>
                  </div>
                )}
              </div>
              {group.tasks.map(task => (
                <WeeklyTaskCard
                  key={task.id}
                  task={task}
                  areaColor={areaColor}
                  goals={goals}
                  expanded={expandedTask === task.id}
                  onToggleExpand={id => setExpandedTask(expandedTask === id ? null : id)}
                  onToggle={toggleTask}
                  onUpdateField={(field, value) => updateTaskField(task.id, field, value)}
                  onToggleSubtask={subId => toggleSubtask(task, subId)}
                  onAddSubtask={text => addSubtask(task, text)}
                  onPushNextWeek={pushToNextWeek}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* This week's calendar */}
      <div className="card mt-4">
        <div className="flex items-center justify-between mb-4">
          <h3>This week's calendar</h3>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>Mon → Sun</p>
        </div>
        <WeeklyAgenda weekStart={weekStartStr} />
      </div>

      {showReview && <WeeklyReviewModal weekStart={weekStartStr} incompleteTasks={tasks.filter(t => !t.complete)} onClose={() => setShowReview(false)} onComplete={carryForwardIncomplete} />}
      {showPastReviews && <PastReviews onClose={() => setShowPastReviews(false)} />}
      {showGoalPicker && <GoalTaskPicker goals={goals} onSelect={pullFromGoalTask} onClose={() => setShowGoalPicker(false)} />}
    </div>
  )
}
