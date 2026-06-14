import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useTimer } from '../../hooks/useTimer'
import { format, subDays, addDays, startOfWeek, getDay, parseISO } from 'date-fns'
import { parseTimeAllocationToMinutes } from '../../lib/constants'
import { deleteCalendarEvent } from '../../lib/googleCalendar'
import WeeklyPlanPicker from './WeeklyPlanPicker'
import TimerWidget from './TimerWidget'
import TimeBlockModal from './TimeBlockModal'
import { Plus, Trash2, ChevronDown, ChevronRight, Check, Clock, Target, Hourglass, AlarmClock, Link2, Timer as TimerIcon, CalendarClock, ChevronLeft } from 'lucide-react'

const DEFAULT_CATS = ['Work', 'Personal', 'Errands', 'Creative', 'Health']
const TIME_OPTS = ['15 min', '30 min', '45 min', '1 hr', '1.5 hr', '2 hr', '3 hr']

const AREA_TO_CATEGORY = {
  Career: 'Work',
  Creative: 'Creative',
  Personal: 'Personal',
  Financial: 'Personal',
  'Health/Wellness': 'Health',
  Other: 'Personal',
}

const CAT_COLOR = {
  Work: 'var(--career)',
  Personal: 'var(--personal)',
  Errands: 'var(--creative)',
  Creative: 'var(--creative)',
  Health: 'var(--wellness)',
}
function catColor(c) { return CAT_COLOR[c] || 'var(--career)' }

export default function DailyTodos({ compact = false }) {
  const { user, session } = useAuth()
  const today     = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const weekStartStr = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [todos,   setTodos]   = useState([])
  const [loading, setLoading] = useState(true)
  const [input,   setInput]   = useState('')
  const [statusFilter,   setStatusFilter]   = useState('all')    // all | active | done
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categories, setCategories] = useState(DEFAULT_CATS)
  const [newCatInput, setNewCatInput] = useState('')
  const [showAddCat,  setShowAddCat]  = useState(false)
  const [goals, setGoals] = useState([])
  const [showWeeklyPicker, setShowWeeklyPicker] = useState(false)
  const [weeklyTasks, setWeeklyTasks] = useState([])
  const [timerTodo, setTimerTodo] = useState(null)
  const [showTimeBlock, setShowTimeBlock] = useState(false)
  const [workingHours, setWorkingHours] = useState({ start: '09:00', end: '19:00' })
  const [viewDate, setViewDate] = useState(today)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const inputRef = useRef(null)
  const timerCtx = useTimer()
  const carriedRef = useRef(false)

  const isToday = viewDate === today
  const viewDayOfWeek = (getDay(parseISO(viewDate)) + 6) % 7 // 0=Mon..6=Sun

  useEffect(() => {
    if (user) { loadGoals(); loadWorkingHours() }
  }, [user])

  // Carry over yesterday's incomplete tasks (once, only when viewing today), then load todos for viewDate
  useEffect(() => {
    if (!user) return
    ;(async () => {
      if (viewDate === today && !carriedRef.current) {
        carriedRef.current = true
        await carryOverYesterday()
      }
      await loadTodosForDate(viewDate)
    })()
  }, [user, viewDate])

  async function loadGoals() {
    const { data } = await supabase.from('goals').select('id, primary_goal, category').eq('user_id', user.id)
    setGoals(data || [])
  }

  async function loadWorkingHours() {
    const { data } = await supabase.from('user_preferences').select('working_hours_start, working_hours_end').eq('user_id', user.id).maybeSingle()
    if (data) setWorkingHours({ start: data.working_hours_start, end: data.working_hours_end })
  }

  async function loadWeeklyTasks() {
    const { data } = await supabase.from('weekly_tasks').select('*')
      .eq('user_id', user.id).eq('week_start', weekStartStr).eq('complete', false).order('created_at')
    const tasks = data || []
    // Tasks allocated to the day being viewed surface first
    const sorted = [...tasks].sort((a, b) => {
      const aMatch = a.day_of_week === viewDayOfWeek ? 0 : 1
      const bMatch = b.day_of_week === viewDayOfWeek ? 0 : 1
      return aMatch - bMatch
    })
    setWeeklyTasks(sorted)
    setShowWeeklyPicker(true)
  }

  async function carryOverYesterday() {
    // Carry over yesterday's incomplete (idempotent guard via carried_from)
    const { data: yd } = await supabase
      .from('daily_todos')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', yesterday)
      .eq('complete', false)
      .eq('archived', false)

    if (yd?.length) {
      const { data: alreadyDone } = await supabase
        .from('daily_todos')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', today)
        .eq('carried_from', yesterday)
        .limit(1)

      if (!alreadyDone?.length) {
        // Insert carry-overs then archive yesterday
        await supabase.from('daily_todos').insert(
          yd.map(t => ({
            user_id: user.id,
            text: t.text,
            date: today,
            complete: false,
            category: t.category || 'Personal',
            time_allocation: t.time_allocation,
            subtasks: t.subtasks,
            carried_from: yesterday,
            duration_minutes: t.duration_minutes,
          }))
        )
        await supabase.from('daily_todos')
          .update({ archived: true })
          .eq('user_id', user.id)
          .eq('date', yesterday)
          .eq('complete', false)
      }
    }
  }

  async function loadTodosForDate(date) {
    setLoading(true)
    const { data: td } = await supabase
      .from('daily_todos')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .eq('archived', false)
      .order('created_at')

    setTodos(td || [])
    setLoading(false)
  }

  async function addTodo() {
    const text = input.trim()
    if (!text) return
    const { data } = await supabase.from('daily_todos').insert({
      user_id: user.id, text, date: viewDate,
      category: categoryFilter || 'Personal',
      complete: false,
    }).select().single()
    if (data) setTodos(prev => [...prev, data])
    setInput('')
    inputRef.current?.focus()
  }

  async function toggle(todo) {
    const newVal = !todo.complete
    await supabase.from('daily_todos').update({ complete: newVal }).eq('id', todo.id)
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, complete: newVal } : t))
  }

  async function remove(todo) {
    await supabase.from('daily_todos').delete().eq('id', todo.id)
    if (todo.google_event_id) await deleteCalendarEvent(session, todo.google_event_id)
    setTodos(prev => prev.filter(t => t.id !== todo.id))
  }

  async function updateField(id, field, value) {
    await supabase.from('daily_todos').update({ [field]: value }).eq('id', id)
    setTodos(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  async function toggleSubtask(todo, subId) {
    const subs = (todo.subtasks || []).map(s => s.id === subId ? { ...s, complete: !s.complete } : s)
    const allDone = subs.every(s => s.complete)
    await supabase.from('daily_todos').update({ subtasks: subs, complete: allDone }).eq('id', todo.id)
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks: subs, complete: allDone } : t))
  }

  async function addSubtask(todo, text) {
    const subs = [...(todo.subtasks || []), { id: String(Date.now()), text, complete: false }]
    await supabase.from('daily_todos').update({ subtasks: subs }).eq('id', todo.id)
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks: subs } : t))
  }

  async function pullFromWeeklyTask(task) {
    const { data } = await supabase.from('daily_todos').insert({
      user_id: user.id,
      text: task.specific_task || task.action,
      date: viewDate,
      category: AREA_TO_CATEGORY[task.area] || 'Personal',
      complete: false,
      duration_minutes: parseTimeAllocationToMinutes(task.time_allocation),
      weekly_task_ref_id: task.id,
    }).select().single()
    if (data) setTodos(prev => [...prev, data])
    setShowWeeklyPicker(false)
  }

  async function applyTimeBlocks(updates) {
    for (const u of updates) {
      await supabase.from('daily_todos').update({ scheduled_time: u.scheduled_time, google_event_id: u.google_event_id }).eq('id', u.todoId)
    }
    setTodos(prev => prev.map(t => {
      const u = updates.find(x => x.todoId === t.id)
      return u ? { ...t, scheduled_time: u.scheduled_time, google_event_id: u.google_event_id } : t
    }))
    setShowTimeBlock(false)
  }

  function addCategory() {
    const c = newCatInput.trim()
    if (c && !categories.includes(c)) setCategories(prev => [...prev, c])
    setNewCatInput('')
    setShowAddCat(false)
  }

  const allCategories = [...new Set([...categories, ...todos.map(t => t.category).filter(Boolean)])]

  const filtered = todos.filter(t => {
    if (statusFilter === 'active' && t.complete) return false
    if (statusFilter === 'done'   && !t.complete) return false
    if (categoryFilter && t.category !== categoryFilter) return false
    return true
  })

  // Timed todos sort to the top in chronological order, then timeless todos below.
  const sorted = [...filtered].sort((a, b) => {
    if (a.scheduled_time && b.scheduled_time) return a.scheduled_time.localeCompare(b.scheduled_time)
    if (a.scheduled_time) return -1
    if (b.scheduled_time) return 1
    return 0
  })

  const done  = todos.filter(t => t.complete).length
  const total = todos.length
  const blockable = todos.filter(t => !t.complete && t.duration_minutes > 0)

  return (
    <div>
      {/* Header — tapping it opens the full-screen drawer on mobile */}
      <div className="flex items-center justify-between mb-3 wrap todos-card-header" onClick={() => setDrawerOpen(true)}>
        <div>
          <h3>{isToday ? "Today's to-dos" : `${format(parseISO(viewDate), 'EEEE')}'s to-dos`}</h3>
          {!loading && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {done}/{total} done · {format(parseISO(viewDate), 'EEE d MMM')}
              <span className="todos-mobile-hint"> · tap to open</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 wrap" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <button className="btn-icon" onClick={() => setViewDate(d => format(subDays(parseISO(d), 1), 'yyyy-MM-dd'))} title="Previous day">
              <ChevronLeft size={14} />
            </button>
            {!isToday && (
              <button className="btn btn-ghost btn-xs" onClick={() => setViewDate(today)}>Today</button>
            )}
            <button className="btn-icon" onClick={() => setViewDate(d => format(addDays(parseISO(d), 1), 'yyyy-MM-dd'))} title="Next day">
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex gap-2">
            {(['all', 'active', 'done']).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`btn btn-xs ${statusFilter === f ? 'btn-career' : 'btn-ghost'}`}
                style={statusFilter === f ? { color: '#fff' } : {}}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`todos-content${drawerOpen ? ' drawer-open' : ''}`}>
        <button
          className="todos-drawer-backbtn btn btn-ghost btn-sm mb-3"
          style={{ display: 'none', alignSelf: 'flex-start' }}
          onClick={() => setDrawerOpen(false)}
        >
          <ChevronLeft size={14} /> Back
        </button>

        {/* Quick-add input */}
        <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTodo()}
            placeholder="Add task… Enter to save"
            style={{ flex: 1 }}
          />
          <button className="btn btn-career btn-sm" style={{ color: '#fff', flexShrink: 0 }} onClick={addTodo}>
            <Plus size={13} />
          </button>
        </div>

        {/* Pull from weekly plan / Time-block actions */}
        <div className="flex items-center gap-2 mb-3 wrap">
          <button className="btn btn-ghost btn-xs" onClick={loadWeeklyTasks}>
            <Link2 size={12} /> Pull from weekly plan
          </button>
          <button className="btn btn-ghost btn-xs" onClick={() => setShowTimeBlock(true)} disabled={blockable.length === 0}>
            <CalendarClock size={12} /> Time-block my day
          </button>
        </div>

        {/* Category filter chips */}
        <div className="flex items-center gap-2 mb-4 wrap">
          <button
            onClick={() => setCategoryFilter('')}
            className={`btn btn-xs ${!categoryFilter ? 'btn-career' : 'btn-ghost'}`}
            style={!categoryFilter ? { color: '#fff' } : {}}
          >All</button>
          {allCategories.map(c => (
            <button key={c} onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)}
              className={`btn btn-xs ${categoryFilter === c ? '' : 'btn-ghost'}`}
              style={categoryFilter === c ? { background: catColor(c), color: '#fff', border: 'none' } : {}}
            >
              {c}
            </button>
          ))}
          {showAddCat ? (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input value={newCatInput} onChange={e => setNewCatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') setShowAddCat(false) }}
                placeholder="Category name" style={{ fontSize: 11, padding: '3px 8px', width: 110 }} autoFocus />
              <button className="btn btn-xs btn-career" style={{ color: '#fff' }} onClick={addCategory}>+</button>
            </div>
          ) : (
            <button className="btn btn-xs btn-ghost" onClick={() => setShowAddCat(true)} title="Add custom category" style={{ color: 'var(--text-3)' }}>+ cat</button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Loading…</p>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)' }}>
            <p style={{ fontSize: 13, fontStyle: 'italic' }}>
              {statusFilter === 'done' ? `Nothing completed ${isToday ? 'yet today' : 'this day'}.` : 'Nothing here — add something above.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sorted.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                categories={allCategories}
                goals={goals}
                isTimerRunning={timerCtx?.timer?.todoId === todo.id}
                onToggle={() => toggle(todo)}
                onRemove={() => remove(todo)}
                onUpdateField={(f, v) => updateField(todo.id, f, v)}
                onToggleSubtask={sid => toggleSubtask(todo, sid)}
                onAddSubtask={text => addSubtask(todo, text)}
                onOpenTimer={() => setTimerTodo(todo)}
              />
            ))}
          </div>
        )}
      </div>

      {showWeeklyPicker && (
        <WeeklyPlanPicker tasks={weeklyTasks} viewDayOfWeek={viewDayOfWeek} onSelect={pullFromWeeklyTask} onClose={() => setShowWeeklyPicker(false)} />
      )}

      {timerTodo && (
        <TimerWidget todo={timerTodo} onClose={() => setTimerTodo(null)} />
      )}

      {showTimeBlock && (
        <TimeBlockModal
          session={session}
          todos={blockable}
          date={viewDate}
          workingHours={workingHours}
          onClose={() => setShowTimeBlock(false)}
          onApply={applyTimeBlocks}
        />
      )}
    </div>
  )
}

function TodoItem({ todo, categories, goals, isTimerRunning, onToggle, onRemove, onUpdateField, onToggleSubtask, onAddSubtask, onOpenTimer }) {
  const [expanded,     setExpanded]     = useState(false)
  const [addingSub,    setAddingSub]    = useState(false)
  const [subInput,     setSubInput]     = useState('')
  const [editingTime,  setEditingTime]  = useState(false)
  const [editingCat,   setEditingCat]   = useState(false)
  const [editingGoal,  setEditingGoal]  = useState(false)
  const [editingDuration, setEditingDuration] = useState(false)
  const [editingScheduled, setEditingScheduled] = useState(false)
  const subtasks = todo.subtasks || []
  const linkedGoal = goals.find(g => g.id === todo.goal_id)
  const cc = catColor(todo.category)

  function submitSub() {
    if (subInput.trim()) { onAddSubtask(subInput.trim()); setSubInput('') }
    setAddingSub(false)
  }

  return (
    <div className="todo-item-row" style={{
      background: todo.complete ? 'var(--bg-2)' : 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${todo.complete ? 'var(--border)' : cc}`,
      borderRadius: 'var(--radius)',
      padding: '9px 12px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      transition: 'opacity 0.2s, transform 0.2s',
      opacity: todo.complete ? 0.62 : 1,
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        {/* Expand chevron */}
        {subtasks.length > 0 ? (
          <button className="btn-icon" style={{ padding: 2, flexShrink: 0, color: 'var(--text-3)' }} onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : <div style={{ width: 18, flexShrink: 0 }} />}

        {/* Toggle dot */}
        <div className={`toggle-dot ${todo.complete ? 'done' : ''}`} onClick={onToggle}
          style={{ borderColor: todo.complete ? 'var(--success)' : cc, flexShrink: 0, cursor: 'pointer' }}>
          {todo.complete && <Check size={10} color="white" strokeWidth={3} />}
        </div>

        {/* Text */}
        <span style={{
          flex: 1,
          fontSize: 13,
          fontWeight: 500,
          color: todo.complete ? 'var(--text-3)' : 'var(--text)',
          textDecoration: todo.complete ? 'line-through' : 'none',
          transition: 'all 0.18s',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {todo.text}
        </span>

        {/* Running timer indicator */}
        {isTimerRunning && (
          <span className="badge badge-career" style={{ fontSize: 9, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
            <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} /> timing
          </span>
        )}

        {/* Carried-from label */}
        {todo.carried_from && (
          <span className="badge badge-warning" style={{ fontSize: 9, flexShrink: 0 }}>yesterday</span>
        )}

        {/* From weekly plan badge */}
        {todo.weekly_task_ref_id && (
          <a href="/weekly" title="View in weekly plan" className="badge" style={{ fontSize: 9, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3, color: 'var(--career)', background: 'var(--career-tint)', textDecoration: 'none' }}>
            <Link2 size={9} /> from weekly plan
          </a>
        )}

        {/* Scheduled time pill */}
        {editingScheduled ? (
          <input
            type="time"
            autoFocus
            defaultValue={todo.scheduled_time || ''}
            onBlur={e => { onUpdateField('scheduled_time', e.target.value || null); setEditingScheduled(false) }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
            style={{ fontSize: 11, padding: '2px 6px', width: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}
          />
        ) : todo.scheduled_time ? (
          <span
            onClick={() => setEditingScheduled(true)}
            title="Click to change"
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--career)', background: 'var(--career-tint)', borderRadius: 10, padding: '2px 7px', cursor: 'pointer', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
            <AlarmClock size={9} /> {todo.scheduled_time}
          </span>
        ) : (
          <button onClick={() => setEditingScheduled(true)} className="btn-icon" style={{ padding: 2, color: 'var(--border)', flexShrink: 0 }} title="Set time of day">
            <AlarmClock size={12} />
          </button>
        )}

        {/* Duration pill */}
        {editingDuration ? (
          <input
            type="number"
            min="0"
            step="5"
            autoFocus
            defaultValue={todo.duration_minutes || ''}
            placeholder="min"
            onBlur={e => { const v = e.target.value ? Number(e.target.value) : null; onUpdateField('duration_minutes', v); setEditingDuration(false) }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
            style={{ fontSize: 11, padding: '2px 6px', width: 56, border: '1px solid var(--border)', borderRadius: 6 }}
          />
        ) : todo.duration_minutes ? (
          <span
            onClick={() => setEditingDuration(true)}
            title="Click to change"
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-3)', background: 'var(--bg-3)', borderRadius: 10, padding: '2px 7px', cursor: 'pointer', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
            <Hourglass size={9} /> {todo.duration_minutes}m
          </span>
        ) : (
          <button onClick={() => setEditingDuration(true)} className="btn-icon" style={{ padding: 2, color: 'var(--border)', flexShrink: 0 }} title="Set duration">
            <Hourglass size={12} />
          </button>
        )}

        {/* Time pill — click to cycle */}
        {editingTime ? (
          <select
            autoFocus
            value={todo.time_allocation || ''}
            onChange={e => { onUpdateField('time_allocation', e.target.value || null); setEditingTime(false) }}
            onBlur={() => setEditingTime(false)}
            style={{ fontSize: 11, padding: '2px 6px', width: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}
          >
            <option value="">No time</option>
            {TIME_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        ) : todo.time_allocation ? (
          <span
            onClick={() => setEditingTime(true)}
            title="Click to change"
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-3)', background: 'var(--bg-3)', borderRadius: 10, padding: '2px 7px', cursor: 'pointer', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
            <Clock size={9} /> {todo.time_allocation}
          </span>
        ) : (
          <button onClick={() => setEditingTime(true)} className="btn-icon" style={{ padding: 2, color: 'var(--border)', flexShrink: 0 }} title="Set time">
            <Clock size={12} />
          </button>
        )}

        {/* Category pill — click to cycle */}
        {editingCat ? (
          <select
            autoFocus
            value={todo.category || 'Personal'}
            onChange={e => { onUpdateField('category', e.target.value); setEditingCat(false) }}
            onBlur={() => setEditingCat(false)}
            style={{ fontSize: 11, padding: '2px 6px', width: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <span
            onClick={() => setEditingCat(true)}
            title="Click to change category"
            style={{ fontSize: 9, color: cc, background: `${cc}1a`, borderRadius: 10, padding: '2px 7px', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}>
            {todo.category}
          </span>
        )}

        {/* Linked goal — click to set */}
        {editingGoal ? (
          <select
            autoFocus
            value={todo.goal_id || ''}
            onChange={e => { onUpdateField('goal_id', e.target.value || null); setEditingGoal(false) }}
            onBlur={() => setEditingGoal(false)}
            style={{ fontSize: 11, padding: '2px 6px', width: 'auto', maxWidth: 140, border: '1px solid var(--border)', borderRadius: 6 }}
          >
            <option value="">No linked goal</option>
            {goals.map(g => <option key={g.id} value={g.id}>{g.category}: {g.primary_goal?.slice(0, 24)}</option>)}
          </select>
        ) : linkedGoal ? (
          <span
            onClick={() => setEditingGoal(true)}
            title={linkedGoal.primary_goal}
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--career)', background: 'var(--career-tint)', borderRadius: 10, padding: '2px 7px', cursor: 'pointer', fontFamily: 'var(--font-mono)', flexShrink: 0, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Target size={9} /> {linkedGoal.primary_goal?.slice(0, 14)}
          </span>
        ) : (
          <button onClick={() => setEditingGoal(true)} className="btn-icon" style={{ padding: 2, color: 'var(--border)', flexShrink: 0 }} title="Link to a goal">
            <Target size={12} />
          </button>
        )}

        {/* Timer */}
        <button className="btn-icon" style={{ padding: 2, color: isTimerRunning ? 'var(--career)' : 'var(--text-3)', flexShrink: 0 }} onClick={onOpenTimer} title="Task timer">
          <TimerIcon size={12} />
        </button>

        {/* Add subtask */}
        <button className="btn-icon" style={{ padding: 2, color: 'var(--text-3)', flexShrink: 0 }} onClick={() => setAddingSub(v => !v)} title="Add subtask">
          <Plus size={12} />
        </button>

        {/* Delete */}
        <button className="btn-icon" style={{ padding: 2, flexShrink: 0 }} onClick={onRemove}>
          <Trash2 size={12} />
        </button>
      </div>

      {/* Subtasks */}
      {expanded && subtasks.length > 0 && (
        <div style={{ marginTop: 8, paddingLeft: 42, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {subtasks.map(s => (
            <div key={s.id} onClick={() => onToggleSubtask(s.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <div className={`toggle-dot ${s.complete ? 'done' : ''}`} style={{ width: 16, height: 16, borderColor: cc, flexShrink: 0 }}>
                {s.complete && <Check size={8} color="white" strokeWidth={3} />}
              </div>
              <span style={{ fontSize: 12, color: s.complete ? 'var(--text-3)' : 'var(--text-2)', textDecoration: s.complete ? 'line-through' : 'none' }}>
                {s.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add-subtask input */}
      {addingSub && (
        <div style={{ marginTop: 8, paddingLeft: 42, display: 'flex', gap: 7 }}>
          <input
            value={subInput}
            onChange={e => setSubInput(e.target.value)}
            placeholder="Subtask…"
            style={{ fontSize: 12, flex: 1 }}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') submitSub(); if (e.key === 'Escape') setAddingSub(false) }}
          />
          <button className="btn btn-career btn-xs" style={{ color: '#fff' }} onClick={submitSub}>Add</button>
        </div>
      )}
    </div>
  )
}
