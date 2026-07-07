import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { withNetworkRetry, friendlyErrorMessage } from '../../lib/network'
import { useAuth } from '../../hooks/useAuth'
import { useTimer } from '../../hooks/useTimer'
import { format, subDays, addDays, startOfWeek, getDay, parseISO } from 'date-fns'
import { parseTimeAllocationToMinutes, priorityRank, priorityFilterOptions, PRIORITY_COLORS, DEFAULT_TODO_CATEGORIES, TODO_CATEGORY_COLOR_PALETTE } from '../../lib/constants'
import PriorityDot from '../shared/PriorityDot'
import SubtaskList from '../shared/SubtaskList'
import { deleteCalendarEvent } from '../../lib/googleCalendar'
import WeeklyPlanPicker from './WeeklyPlanPicker'
import GoalTaskPicker from './GoalTaskPicker'
import BrainDumpPicker from './BrainDumpPicker'
import TaskCarryoverModal from './TaskCarryoverModal'
import BacklogPicker from './BacklogPicker'
import TimerWidget from './TimerWidget'
import TimeBlockModal from './TimeBlockModal'
import { Plus, Trash2, ChevronDown, ChevronRight, Check, Target, Hourglass, AlarmClock, Link2, Timer as TimerIcon, CalendarClock, ChevronLeft, Download, Lightbulb, Lock, Unlock, FastForward, Rewind, Archive, Pencil, ClipboardList } from 'lucide-react'

const DEFAULT_CATS = DEFAULT_TODO_CATEGORIES.map(c => c.name)

const AREA_TO_CATEGORY = {
  Career: 'Work',
  Creative: 'Creative',
  Personal: 'Personal',
  Financial: 'Personal',
  'Health/Wellness': 'Health',
  Other: 'Personal',
}

const IDEA_CAT_TO_TODO_CATEGORY = {
  Career: 'Work',
  Creative: 'Creative',
  Personal: 'Personal',
  Financial: 'Personal',
  Health: 'Health',
  Other: 'Personal',
}

const FALLBACK_CAT_COLOR = 'var(--career)'

export default function DailyTodos({ compact = false, date = null, onDateChange = null }) {
  const { user, session } = useAuth()
  const today     = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const weekStartStr = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [todos,   setTodos]   = useState([])
  const [loading, setLoading] = useState(true)
  const [input,   setInput]   = useState('')
  const [statusFilter,   setStatusFilter]   = useState('all')    // all | active | done
  const [categoryFilter, setCategoryFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')       // '' | urgent | high | medium | low | none
  const [categories, setCategories] = useState(DEFAULT_CATS)
  const [categoryColors, setCategoryColors] = useState({})
  const [colorsLoaded, setColorsLoaded] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [showAddCat,  setShowAddCat]  = useState(false)
  const [colorPickerCat, setColorPickerCat] = useState(null)
  const [goals, setGoals] = useState([])
  const [milestones, setMilestones] = useState([])
  const [milestoneTasks, setMilestoneTasks] = useState([])
  const [showWeeklyPicker, setShowWeeklyPicker] = useState(false)
  const [showGoalPicker, setShowGoalPicker] = useState(false)
  const [showBrainDumpPicker, setShowBrainDumpPicker] = useState(false)
  const [showBacklogPicker, setShowBacklogPicker] = useState(false)
  const [showPullMenu, setShowPullMenu] = useState(false)
  const [pendingCarryover, setPendingCarryover] = useState(null) // tasks waiting for user decision
  const [backlog, setBacklog] = useState([])
  const [weeklyTasks, setWeeklyTasks] = useState([])
  const [ideas, setIdeas] = useState([])
  const [timerTodo, setTimerTodo] = useState(null)
  const [showTimeBlock, setShowTimeBlock] = useState(false)
  const [workingHours, setWorkingHours] = useState({ start: '09:00', end: '19:00' })
  const [autoCompleteLinked, setAutoCompleteLinked] = useState(true)
  const [viewDate, setViewDate] = useState(date || today)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const inputRef = useRef(null)
  const timerCtx = useTimer()
  const carriedRef = useRef(false)
  const categoryColorsRef = useRef({})
  const latestViewDateRef = useRef(viewDate)

  const isToday = viewDate === today
  const viewDayOfWeek = (getDay(parseISO(viewDate)) + 6) % 7 // 0=Mon..6=Sun

  const [pendingAssignments, setPendingAssignments] = useState([])
  const [decliningId, setDecliningId] = useState(null)
  const [declineReason, setDeclineReason] = useState('')

  useEffect(() => {
    if (user) { loadGoals(); loadWorkingHours(); loadCategoryColors(); loadPendingAssignments() }
  }, [user])

  // Follow the dashboard's day navigation (period-nav arrows) when this widget is
  // controlled by a parent that tracks its own reference date.
  useEffect(() => {
    if (date) setViewDate(date)
  }, [date])

  // Carry over yesterday's incomplete tasks (once, only when viewing today), then load todos for viewDate
  useEffect(() => {
    if (!user) return
    latestViewDateRef.current = viewDate
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
    const { data: milestonesData } = await supabase.from('milestones').select('*').eq('user_id', user.id).order('sort_order')
    setMilestones(milestonesData || [])
    const { data: milestoneTasksData } = await supabase.from('milestone_tasks').select('*').eq('user_id', user.id).order('sort_order')
    setMilestoneTasks(milestoneTasksData || [])
  }

  async function loadPendingAssignments() {
    const { data, error } = await supabase
      .from('partner_assignments')
      .select('*')
      .eq('to_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) { console.warn('[DailyTodos] loadPendingAssignments error', error); return }
    if (!data?.length) { setPendingAssignments([]); return }

    // Fetch sender display names in one query
    const fromIds = [...new Set(data.map(r => r.from_user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', fromIds)
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

    setPendingAssignments(data.map(r => ({ ...r, senderProfile: profileMap[r.from_user_id] || null })))
  }

  async function acceptAssignment(a) {
    await supabase.from('partner_assignments').update({ status: 'accepted' }).eq('id', a.id)
    const today = new Date().toISOString().slice(0, 10)
    const { data: inserted } = await supabase.from('daily_todos').insert({
      user_id: user.id, text: a.text, date: today, complete: false, category: 'Personal',
    }).select().single()
    if (inserted) setTodos(prev => [...prev, inserted])
    setPendingAssignments(prev => prev.filter(x => x.id !== a.id))
  }

  async function declineAssignment(id, reason) {
    await supabase.from('partner_assignments').update({ status: 'declined', decline_reason: reason || null }).eq('id', id)
    setPendingAssignments(prev => prev.filter(x => x.id !== id))
    setDecliningId(null)
    setDeclineReason('')
  }

  async function loadCategoryColors() {
    const { data } = await supabase.from('todo_categories').select('name, colour').eq('user_id', user.id)
    if (data?.length) {
      const map = Object.fromEntries(data.map(r => [r.name, r.colour]))
      categoryColorsRef.current = map
      setCategoryColors(map)
      setCategories(prev => [...new Set([...prev, ...data.map(r => r.name)])])
      setColorsLoaded(true)
      return
    }
    // First run: no rows yet — seed the default categories so they have a persisted colour.
    const { data: seeded } = await supabase.from('todo_categories')
      .insert(DEFAULT_TODO_CATEGORIES.map(c => ({ user_id: user.id, name: c.name, colour: c.colour })))
      .select('name, colour')
    if (seeded?.length) {
      const map = Object.fromEntries(seeded.map(r => [r.name, r.colour]))
      categoryColorsRef.current = map
      setCategoryColors(map)
    }
    setColorsLoaded(true)
  }

  // Lazily create a todo_categories row (with a default colour) the first time a category
  // that isn't tracked yet is touched — covers free-text categories typed before this feature existed.
  // Reads/writes categoryColorsRef synchronously so concurrent calls (e.g. backfilling several
  // categories in the same render pass) each see the others' just-assigned colours instead of
  // all racing to read the same stale `categoryColors` state closure and landing on palette index 0.
  async function ensureCategoryColor(name) {
    if (!name || categoryColorsRef.current[name]) return
    const colour = TODO_CATEGORY_COLOR_PALETTE[Object.keys(categoryColorsRef.current).length % TODO_CATEGORY_COLOR_PALETTE.length]
    categoryColorsRef.current = { ...categoryColorsRef.current, [name]: colour }
    setCategoryColors(categoryColorsRef.current)
    await supabase.from('todo_categories').upsert({ user_id: user.id, name, colour }, { onConflict: 'user_id,name' })
  }

  function catColor(c) { return categoryColors[c] || FALLBACK_CAT_COLOR }

  async function setCategoryColor(name, colour) {
    setCategoryColors(prev => ({ ...prev, [name]: colour }))
    await supabase.from('todo_categories').upsert({ user_id: user.id, name, colour }, { onConflict: 'user_id,name' })
  }

  async function loadWorkingHours() {
    const { data } = await supabase.from('user_preferences').select('working_hours_start, working_hours_end, auto_complete_linked_tasks').eq('user_id', user.id).maybeSingle()
    if (data) {
      setWorkingHours({ start: data.working_hours_start, end: data.working_hours_end })
      setAutoCompleteLinked(data.auto_complete_linked_tasks ?? true)
    }
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
    // Find incomplete, unarchived todos from any prior day
    const { data: pending } = await supabase
      .from('daily_todos')
      .select('*')
      .eq('user_id', user.id)
      .lt('date', today)
      .eq('complete', false)
      .eq('archived', false)
      .order('date', { ascending: false })

    if (!pending?.length) return

    // Guard: skip any source dates already processed (already carried or already in backlog)
    const sourceDates = [...new Set(pending.map(t => t.date))]
    const [carriedRes, backlogRes] = await Promise.all([
      supabase.from('daily_todos').select('carried_from').eq('user_id', user.id).eq('date', today).in('carried_from', sourceDates),
      supabase.from('task_backlog').select('source_date').eq('user_id', user.id).in('source_date', sourceDates),
    ])
    const alreadyProcessedDates = new Set([
      ...((carriedRes.data || []).map(r => r.carried_from)),
      ...((backlogRes.data || []).map(r => r.source_date)),
    ])
    const toPrompt = pending.filter(t => !alreadyProcessedDates.has(t.date))
    if (!toPrompt.length) return

    // Show the modal — user decides what happens to each task
    setPendingCarryover(toPrompt)
  }

  async function applyCarryoverDecisions(decisions) {
    setPendingCarryover(null)

    const toCarry  = decisions.filter(t => t.decision === 'carry')
    const toBacklog = decisions.filter(t => t.decision === 'backlog')
    const toSkip   = decisions.filter(t => t.decision === 'skip')
    const allSrcIds = decisions.map(t => t.id)
    const allSrcDates = [...new Set(decisions.map(t => t.date))]

    // Insert "carry" tasks into today
    if (toCarry.length) {
      const { data: inserted, error } = await supabase.from('daily_todos').insert(
        toCarry.map(t => ({
          user_id:            user.id,
          text:               t.text,
          date:               today,
          complete:           false,
          category:           t.category || 'Personal',
          time_allocation:    t.time_allocation,
          subtasks:           t.subtasks,
          carried_from:       t.date,
          duration_minutes:   t.duration_minutes,
          priority_level:     t.priority_level,
          is_private:         t.is_private ?? false,
          goal_id:            t.goal_id,
          sort_order:         t.sort_order,
          scheduled_time:     t.scheduled_time,
          weekly_task_ref_id: t.weekly_task_ref_id,
        }))
      ).select()
      if (!error && inserted) setTodos(prev => [...prev, ...inserted])
    }

    // Insert "backlog" tasks into task_backlog
    if (toBacklog.length) {
      const { data: inserted } = await supabase.from('task_backlog').insert(
        toBacklog.map(t => ({
          user_id:     user.id,
          text:        t.text,
          category:    t.category || 'Personal',
          goal_id:     t.goal_id || null,
          source_date: t.date,
        }))
      ).select()
      if (inserted) setBacklog(prev => [...prev, ...inserted])
    }

    // Archive all source todos (carry, backlog, and skip)
    if (allSrcIds.length) {
      await supabase.from('daily_todos')
        .update({ archived: true })
        .eq('user_id', user.id)
        .in('id', allSrcIds)
    }
  }

  async function loadBacklog() {
    const { data } = await supabase.from('task_backlog').select('*').eq('user_id', user.id).order('created_at')
    setBacklog(data || [])
    setShowBacklogPicker(true)
  }

  async function pullFromBacklog(item) {
    const { data, error } = await withNetworkRetry(() =>
      supabase.from('daily_todos').insert({
        user_id: user.id, text: item.text, date: viewDate,
        category: item.category || 'Personal', complete: false, goal_id: item.goal_id || null,
      }).select().single()
    )
    if (error) { alert(`Couldn't pull task: ${friendlyErrorMessage(error)}`); return }
    setTodos(prev => [...prev, data])
    // Remove from backlog
    await supabase.from('task_backlog').delete().eq('id', item.id)
    setBacklog(prev => prev.filter(b => b.id !== item.id))
    if (backlog.filter(b => b.id !== item.id).length === 0) setShowBacklogPicker(false)
  }

  async function deleteFromBacklog(id) {
    await supabase.from('task_backlog').delete().eq('id', id)
    setBacklog(prev => prev.filter(b => b.id !== id))
  }

  async function loadTodosForDate(date) {
    if (latestViewDateRef.current !== date) return
    setLoading(true)

    // For today: only show active (non-archived) todos.
    // For past days: show active todos + archived ones that were carried forward,
    // so the user can see what they had that day including items they didn't finish.
    let query = supabase
      .from('daily_todos')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at')

    if (date === today) {
      query = query.eq('archived', false)
    }
    // Past dates: no archived filter — show everything including carried-forward items

    const { data: td } = await query

    // Bail if the user navigated to a different day while this request was in flight.
    if (latestViewDateRef.current !== date) return
    setTodos(td || [])
    setLoading(false)
  }

  async function addTodo() {
    const text = input.trim()
    if (!text) return
    const { data, error } = await withNetworkRetry(() => supabase.from('daily_todos').insert({
      user_id: user.id, text, date: viewDate,
      category: categoryFilter || 'Personal',
      complete: false,
    }).select().single())
    if (error) { alert(`Couldn't save task: ${friendlyErrorMessage(error)}`); return }
    setTodos(prev => [...prev, data])
    setInput('')
    inputRef.current?.focus()
  }

  async function toggle(todo) {
    const newVal = !todo.complete
    await supabase.from('daily_todos').update({ complete: newVal }).eq('id', todo.id)
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, complete: newVal } : t))
    if (newVal && todo.weekly_task_ref_id && autoCompleteLinked) {
      await supabase.from('weekly_tasks').update({ complete: true }).eq('id', todo.weekly_task_ref_id)
    }
  }

  async function remove(todo) {
    await supabase.from('daily_todos').delete().eq('id', todo.id)
    if (todo.google_event_id) await deleteCalendarEvent(session, todo.google_event_id)
    setTodos(prev => prev.filter(t => t.id !== todo.id))
  }

  async function pushToTomorrow(todo) {
    const nextDate = format(addDays(parseISO(todo.date), 1), 'yyyy-MM-dd')
    await supabase.from('daily_todos').insert({
      user_id: user.id, text: todo.text, date: nextDate, complete: false,
      category: todo.category, time_allocation: todo.time_allocation, subtasks: todo.subtasks,
      carried_from: todo.date, duration_minutes: todo.duration_minutes, goal_id: todo.goal_id,
    })
    await supabase.from('daily_todos').update({ archived: true }).eq('id', todo.id)
    setTodos(prev => prev.filter(t => t.id !== todo.id))
  }

  async function pushToYesterday(todo) {
    const prevDate = format(addDays(parseISO(todo.date), -1), 'yyyy-MM-dd')
    await supabase.from('daily_todos').insert({
      user_id: user.id, text: todo.text, date: prevDate, complete: false,
      category: todo.category, time_allocation: todo.time_allocation, subtasks: todo.subtasks,
      carried_from: todo.date, duration_minutes: todo.duration_minutes, goal_id: todo.goal_id,
    })
    await supabase.from('daily_todos').update({ archived: true }).eq('id', todo.id)
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

  async function editSubtaskText(todo, subId, text) {
    const subs = (todo.subtasks || []).map(s => s.id === subId ? { ...s, text } : s)
    await supabase.from('daily_todos').update({ subtasks: subs }).eq('id', todo.id)
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks: subs } : t))
  }

  async function removeSubtask(todo, subId) {
    const subs = (todo.subtasks || []).filter(s => s.id !== subId)
    await supabase.from('daily_todos').update({ subtasks: subs }).eq('id', todo.id)
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks: subs } : t))
  }

  async function reorderSubtasks(todo, subs) {
    await supabase.from('daily_todos').update({ subtasks: subs }).eq('id', todo.id)
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks: subs } : t))
  }

  async function pullFromWeeklyTask(task, subtask) {
    const { data } = await supabase.from('daily_todos').insert(subtask ? {
      user_id: user.id,
      text: subtask.text,
      date: viewDate,
      category: AREA_TO_CATEGORY[task.area] || 'Personal',
      complete: false,
    } : {
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

  async function loadIdeas() {
    const { data } = await supabase.from('idea_parking_lot').select('*')
      .eq('user_id', user.id).eq('acted_on', false).order('created_at', { ascending: false })
    setIdeas(data || [])
    setShowBrainDumpPicker(true)
  }

  async function pullFromBrainDump(idea) {
    const { data } = await supabase.from('daily_todos').insert({
      user_id: user.id,
      text: idea.text,
      date: viewDate,
      category: IDEA_CAT_TO_TODO_CATEGORY[idea.category] || 'Personal',
      complete: false,
    }).select().single()
    if (data) setTodos(prev => [...prev, data])
    await supabase.from('idea_parking_lot').update({ acted_on: true }).eq('id', idea.id)
    setShowBrainDumpPicker(false)
  }

  async function pullFromGoalTask(goal, task, milestoneId) {
    const { data, error } = await withNetworkRetry(() => supabase.from('daily_todos').insert({
      user_id: user.id,
      text: task.text,
      date: viewDate,
      category: AREA_TO_CATEGORY[goal.category === 'Wellness' ? 'Health/Wellness' : goal.category] || 'Personal',
      complete: false,
      goal_id: goal.id,
      milestone_id: milestoneId || null,
    }).select().single())
    if (error) { alert(`Couldn't pull task: ${friendlyErrorMessage(error)}`); return }
    setTodos(prev => [...prev, data])
    setShowGoalPicker(false)
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
    if (c && !categories.includes(c)) {
      setCategories(prev => [...prev, c])
      ensureCategoryColor(c)
    }
    setNewCatInput('')
    setShowAddCat(false)
  }

  const allCategories = [...new Set([...categories, ...todos.map(t => t.category).filter(Boolean)])]

  // Backfill: any category in use (typed before this feature existed) that has no colour
  // row yet gets one lazily assigned from the palette.
  useEffect(() => {
    if (!colorsLoaded) return
    allCategories.forEach(c => { if (!categoryColorsRef.current[c]) ensureCategoryColor(c) })
  }, [colorsLoaded, allCategories.join('|'), Object.keys(categoryColors).length])

  const filtered = todos.filter(t => {
    if (statusFilter === 'active' && t.complete) return false
    if (statusFilter === 'done'   && !t.complete) return false
    if (categoryFilter && t.category !== categoryFilter) return false
    if (priorityFilter === 'none' && t.priority_level) return false
    if (priorityFilter && priorityFilter !== 'none' && t.priority_level !== priorityFilter) return false
    return true
  })

  // Pinned priorities sort first, then timed todos in chronological order, then by priority.
  const sorted = [...filtered].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    if (a.scheduled_time && b.scheduled_time) return a.scheduled_time.localeCompare(b.scheduled_time)
    if (a.scheduled_time) return -1
    if (b.scheduled_time) return 1
    return priorityRank(a.priority_level) - priorityRank(b.priority_level)
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
            <button className="btn-icon" onClick={() => {
              const d = format(subDays(parseISO(viewDate), 1), 'yyyy-MM-dd')
              setViewDate(d); onDateChange?.(d)
            }} title="Previous day">
              <ChevronLeft size={14} />
            </button>
            {!isToday && (
              <button className="btn btn-ghost btn-xs" onClick={() => { setViewDate(today); onDateChange?.(today) }}>Today</button>
            )}
            <button className="btn-icon" onClick={() => {
              const d = format(addDays(parseISO(viewDate), 1), 'yyyy-MM-dd')
              setViewDate(d); onDateChange?.(d)
            }} title="Next day">
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

        {/* Pull task / Time-block actions */}
        <div className="flex items-center gap-2 mb-3 wrap" style={{ position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost btn-xs" onClick={() => setShowPullMenu(v => !v)}>
              <Download size={12} /> Pull task
            </button>
            {showPullMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 89 }} onClick={() => setShowPullMenu(false)} />
                <div className="card" style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 90,
                  padding: 6, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  <button className="btn btn-ghost btn-xs" style={{ justifyContent: 'flex-start' }} onClick={() => { setShowPullMenu(false); setShowGoalPicker(true) }}>
                    <Target size={12} /> Goals
                  </button>
                  <button className="btn btn-ghost btn-xs" style={{ justifyContent: 'flex-start' }} onClick={() => { setShowPullMenu(false); loadWeeklyTasks() }}>
                    <Link2 size={12} /> Weekly plan
                  </button>
                  <button className="btn btn-ghost btn-xs" style={{ justifyContent: 'flex-start' }} onClick={() => { setShowPullMenu(false); loadIdeas() }}>
                    <Lightbulb size={12} /> Brain dump
                  </button>
                  <button className="btn btn-ghost btn-xs" style={{ justifyContent: 'flex-start' }} onClick={() => { setShowPullMenu(false); loadBacklog() }}>
                    <Archive size={12} /> Backlog
                  </button>
                </div>
              </>
            )}
          </div>
          <button className="btn btn-ghost btn-xs" onClick={() => setShowTimeBlock(true)}
            title="Find free slots for your timed to-dos">
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
            <div key={c} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)}
                className={`btn btn-xs ${categoryFilter === c ? '' : 'btn-ghost'}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  ...(categoryFilter === c ? { background: catColor(c), color: '#fff', border: 'none' } : {}),
                }}
              >
                <span
                  onClick={e => { e.stopPropagation(); setColorPickerCat(colorPickerCat === c ? null : c) }}
                  title="Change category colour"
                  style={{
                    width: 11, height: 11, borderRadius: '50%', background: catColor(c), flexShrink: 0, cursor: 'pointer',
                    border: categoryFilter === c ? '1.5px solid #fff' : '1.5px solid var(--bg)',
                    boxShadow: '0 0 0 1px var(--border)',
                  }}
                />
                {c}
              </button>
              {colorPickerCat === c && (
                <CategoryColorPicker
                  current={catColor(c)}
                  onPick={colour => { setCategoryColor(c, colour); setColorPickerCat(null) }}
                  onClose={() => setColorPickerCat(null)}
                />
              )}
            </div>
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

        {/* Priority filter bar */}
        <div className="flex items-center gap-2 mb-4" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          {priorityFilterOptions().map(opt => (
            <button key={opt.value || 'all'} onClick={() => setPriorityFilter(priorityFilter === opt.value ? '' : opt.value)}
              className={`btn btn-xs ${priorityFilter === opt.value ? '' : 'btn-ghost'}`}
              style={{
                flexShrink: 0,
                ...(priorityFilter === opt.value
                  ? { background: PRIORITY_COLORS[opt.value] || 'var(--career)', color: '#fff', border: 'none' }
                  : {}),
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Pending partner assignments — prominent alert card */}
        {pendingAssignments.length > 0 && (
          <div style={{
            marginBottom: 18,
            borderRadius: 'var(--radius)',
            border: '2px solid var(--career)',
            background: 'var(--card-bg)',
            boxShadow: '0 0 0 4px var(--career-tint)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '10px 14px',
              background: 'var(--career)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {/* Pulsing dot */}
              <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'block' }} />
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.5)',
                  animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                }} />
              </span>
              <ClipboardList size={14} color="#fff" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', flex: 1 }}>
                {pendingAssignments.length === 1
                  ? '1 task assigned to you — waiting for your response'
                  : `${pendingAssignments.length} tasks assigned to you — waiting for your response`}
              </span>
            </div>

            {/* Assignment rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {pendingAssignments.map((a, i) => {
                const fromName = a.senderProfile?.display_name || a.senderProfile?.email?.split('@')[0] || 'Your partner'
                const isDecliningSelf = decliningId === a.id
                return (
                  <div key={a.id} style={{
                    padding: '12px 14px',
                    borderBottom: i < pendingAssignments.length - 1 ? '1px solid var(--border)' : 'none',
                    background: i % 2 === 0 ? 'var(--card-bg)' : 'var(--bg-2)',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{a.text}</div>
                    {a.note && <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', marginBottom: 4 }}>{a.note}</div>}
                    <div style={{ fontSize: 11, color: 'var(--career)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                      from {fromName}{a.due_date ? ` · due ${a.due_date}` : ''}
                    </div>
                    {isDecliningSelf ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={declineReason}
                          onChange={e => setDeclineReason(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') declineAssignment(a.id, declineReason); if (e.key === 'Escape') { setDecliningId(null); setDeclineReason('') } }}
                          placeholder="Reason for declining (optional)…"
                          style={{ fontSize: 12, flex: 1, padding: '4px 8px' }}
                        />
                        <button className="btn btn-xs" style={{ background: '#ef4444', color: '#fff', flexShrink: 0 }} onClick={() => declineAssignment(a.id, declineReason)}>Send</button>
                        <button className="btn btn-xs btn-ghost" style={{ flexShrink: 0 }} onClick={() => { setDecliningId(null); setDeclineReason('') }}>Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          className="btn btn-sm btn-career"
                          style={{ color: '#fff', fontWeight: 600 }}
                          onClick={() => acceptAssignment(a)}
                        >
                          ✓ Accept & add to today
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          style={{ color: '#ef4444' }}
                          onClick={() => { setDecliningId(a.id); setDeclineReason('') }}
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
                catColor={catColor}
                goals={goals}
                isTimerRunning={timerCtx?.timer?.todoId === todo.id}
                onToggle={() => toggle(todo)}
                onRemove={() => remove(todo)}
                onPushTomorrow={() => pushToTomorrow(todo)}
                onPushYesterday={() => pushToYesterday(todo)}
                onUpdateField={(f, v) => updateField(todo.id, f, v)}
                onToggleSubtask={sid => toggleSubtask(todo, sid)}
                onAddSubtask={text => addSubtask(todo, text)}
                onEditSubtask={(sid, text) => editSubtaskText(todo, sid, text)}
                onRemoveSubtask={sid => removeSubtask(todo, sid)}
                onReorderSubtasks={subs => reorderSubtasks(todo, subs)}
                onOpenTimer={() => setTimerTodo(todo)}
              />
            ))}
          </div>
        )}
      </div>

      {showWeeklyPicker && (
        <WeeklyPlanPicker tasks={weeklyTasks} viewDayOfWeek={viewDayOfWeek} onSelect={pullFromWeeklyTask} onClose={() => setShowWeeklyPicker(false)} />
      )}

      {showGoalPicker && (
        <GoalTaskPicker goals={goals} milestones={milestones} milestoneTasks={milestoneTasks} onSelect={pullFromGoalTask} onClose={() => setShowGoalPicker(false)} />
      )}

      {showBrainDumpPicker && (
        <BrainDumpPicker ideas={ideas} onSelect={pullFromBrainDump} onClose={() => setShowBrainDumpPicker(false)} />
      )}

      {pendingCarryover && (
        <TaskCarryoverModal
          tasks={pendingCarryover}
          catColor={catColor}
          onConfirm={applyCarryoverDecisions}
          onDismiss={() => setPendingCarryover(null)}
        />
      )}

      {showBacklogPicker && (
        <BacklogPicker
          items={backlog}
          catColor={catColor}
          onSelect={pullFromBacklog}
          onDelete={deleteFromBacklog}
          onClose={() => setShowBacklogPicker(false)}
        />
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

function CategoryColorPicker({ current, onPick, onClose }) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 95 }} onClick={onClose} />
      <div className="card" style={{
        position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 96,
        padding: 8, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
      }}>
        {TODO_CATEGORY_COLOR_PALETTE.map(hex => (
          <button
            key={hex}
            onClick={() => onPick(hex)}
            title={hex}
            style={{
              width: 20, height: 20, borderRadius: '50%', background: hex, cursor: 'pointer',
              border: hex.toLowerCase() === current.toLowerCase() ? '2px solid var(--text)' : '1px solid var(--border)',
              padding: 0,
            }}
          />
        ))}
      </div>
    </>
  )
}

function TodoItem({ todo, categories, catColor, goals, isTimerRunning, onToggle, onRemove, onPushTomorrow, onPushYesterday, onUpdateField, onToggleSubtask, onAddSubtask, onEditSubtask, onRemoveSubtask, onReorderSubtasks, onOpenTimer }) {
  const [expanded,     setExpanded]     = useState(false)
  const [showOptions,  setShowOptions]  = useState(false)
  const [addingSub,    setAddingSub]    = useState(false)
  const [subInput,     setSubInput]     = useState('')
  const [editingText,  setEditingText]  = useState(false)
  const [textInput,    setTextInput]    = useState(todo.text)
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

  function saveText() {
    const t = textInput.trim()
    if (t && t !== todo.text) onUpdateField('text', t)
    else setTextInput(todo.text)
    setEditingText(false)
  }

  return (
    <div className="todo-item-row" style={{
      background: todo.complete ? 'var(--bg-2)' : 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${todo.complete ? 'var(--border)' : (todo.priority_level === 'urgent' ? PRIORITY_COLORS.urgent : cc)}`,
      borderRadius: 'var(--radius)',
      padding: '9px 12px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      transition: 'opacity 0.2s, transform 0.2s',
      opacity: todo.complete ? 0.62 : todo.archived ? 0.5 : 1,
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        {/* Expand chevron + subtask count */}
        {subtasks.length > 0 ? (
          <button className="btn-icon" style={{ padding: '2px 4px', flexShrink: 0, color: 'var(--text-3)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 2 }} onClick={() => setExpanded(v => !v)} title={expanded ? 'Collapse subtasks' : 'Expand subtasks'}>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, lineHeight: 1,
              color: 'var(--career)', background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '1px 5px',
            }}>
              {subtasks.filter(s => s.complete).length}/{subtasks.length}
            </span>
          </button>
        ) : <div style={{ width: 18, flexShrink: 0 }} />}

        {/* Toggle dot */}
        <div className={`toggle-dot ${todo.complete ? 'done' : ''}`} onClick={onToggle}
          style={{ borderColor: todo.complete ? 'var(--success)' : cc, flexShrink: 0, cursor: 'pointer', marginTop: 2 }}>
          {todo.complete && <Check size={10} color="white" strokeWidth={3} />}
        </div>

        {/* Priority dot — always visible, cycles Urgent/High/Medium/Low/None */}
        <PriorityDot priority={todo.priority_level} onChange={v => onUpdateField('priority_level', v)} />

        {/* Text */}
        {editingText ? (
          <input
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onBlur={saveText}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setTextInput(todo.text); setEditingText(false) } }}
            autoFocus
            style={{ flex: 1, fontSize: 13, fontWeight: 500, minWidth: 0, padding: '2px 6px' }}
          />
        ) : (
          <span
            onClick={() => setShowOptions(v => !v)}
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 500,
              color: todo.complete ? 'var(--text-3)' : 'var(--text)',
              textDecoration: todo.complete ? 'line-through' : 'none',
              transition: 'all 0.18s',
              minWidth: 0,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              cursor: 'pointer',
            }}>
            {todo.text}
          </span>
        )}

        {/* Options toggle chevron */}
        <button className="btn-icon" style={{ padding: 2, flexShrink: 0, color: showOptions ? 'var(--career)' : 'var(--text-3)' }}
          onClick={() => setShowOptions(v => !v)} title="Show options">
          {showOptions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Options row */}
      {showOptions && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginTop: 8, paddingLeft: 27 }}>
        {/* Running timer indicator */}
        {isTimerRunning && (
          <span className="badge badge-career" style={{ fontSize: 9, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
            <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} /> timing
          </span>
        )}

        {/* Carried label */}
        {todo.carried_from && !todo.archived && (
          <span className="badge badge-warning" style={{ fontSize: 9, flexShrink: 0 }}>carried</span>
        )}
        {todo.archived && (
          <span className="badge" style={{ fontSize: 9, flexShrink: 0, background: 'var(--bg-3)', color: 'var(--text-3)' }}>carried forward →</span>
        )}

        {/* Pinned priority label */}
        {todo.pinned && (
          <span className="badge" style={{ fontSize: 9, flexShrink: 0, background: 'var(--career-tint)', color: 'var(--career)' }}>priority</span>
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
          <DurationSelect
            minutes={todo.duration_minutes}
            onChange={v => { onUpdateField('duration_minutes', v); setEditingDuration(false) }}
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

        {/* Privacy toggle */}
        <button
          className="btn-icon"
          style={{ padding: 2, flexShrink: 0, color: todo.is_private ? 'var(--text-3)' : 'var(--career)' }}
          onClick={() => onUpdateField('is_private', !todo.is_private)}
          title={todo.is_private ? 'Private — hidden from accountability partners. Click to share.' : 'Shared with accepted accountability partners. Click to make private.'}
        >
          {todo.is_private ? <Lock size={12} /> : <Unlock size={12} />}
        </button>

        {/* Timer */}
        <button className="btn-icon" style={{ padding: 2, color: isTimerRunning ? 'var(--career)' : 'var(--text-3)', flexShrink: 0 }} onClick={onOpenTimer} title="Task timer">
          <TimerIcon size={12} />
        </button>

        {/* Add subtask */}
        <button className="btn-icon" style={{ padding: 2, color: 'var(--text-3)', flexShrink: 0 }} onClick={() => setAddingSub(v => !v)} title="Add subtask">
          <Plus size={12} />
        </button>

        {/* Push to yesterday (undo an accidental push-forward) */}
        {!todo.complete && (
          <button className="btn-icon" style={{ padding: 2, color: 'var(--text-3)', flexShrink: 0 }} onClick={onPushYesterday} title="Move to yesterday">
            <Rewind size={12} />
          </button>
        )}

        {/* Push to tomorrow */}
        {!todo.complete && (
          <button className="btn-icon" style={{ padding: 2, color: 'var(--text-3)', flexShrink: 0 }} onClick={onPushTomorrow} title="Push to tomorrow">
            <FastForward size={12} />
          </button>
        )}

        {/* Edit text */}
        <button className="btn-icon" style={{ padding: 2, flexShrink: 0, color: 'var(--text-3)' }} onClick={() => { setTextInput(todo.text); setEditingText(true); setShowOptions(false) }} title="Edit task text">
          <Pencil size={12} />
        </button>

        {/* Delete */}
        <button className="btn-icon" style={{ padding: 2, flexShrink: 0 }} onClick={onRemove} title="Delete to-do">
          <Trash2 size={12} />
        </button>
      </div>
      )}

      {/* Subtasks */}
      {expanded && subtasks.length > 0 && (
        <div style={{ marginTop: 8, paddingLeft: 42 }}>
          <SubtaskList
            subtasks={subtasks}
            accentColor={cc}
            onToggle={sid => onToggleSubtask(sid)}
            onEditText={(sid, text) => onEditSubtask(sid, text)}
            onDelete={sid => onRemoveSubtask(sid)}
            onReorder={onReorderSubtasks}
          />
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

const DURATION_HOUR_OPTS = Array.from({ length: 9 }, (_, i) => i) // 0-8 hours
const DURATION_MINUTE_OPTS = [0, 15, 30, 45]

function DurationSelect({ minutes, onChange }) {
  const total = minutes || 0
  const [hours, setHours] = useState(Math.floor(total / 60))
  const [mins, setMins]   = useState(total % 60)

  // Closes once focus leaves both selects, so picking hours doesn't collapse the editor
  // before minutes can be set.
  function handleBlur(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return
    onChange(hours * 60 + mins || null)
  }

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()} onBlur={handleBlur}>
      <select
        autoFocus
        value={hours}
        onChange={e => setHours(Number(e.target.value))}
        style={{ fontSize: 11, padding: '2px 4px', borderRadius: 6 }}
      >
        {DURATION_HOUR_OPTS.map(h => <option key={h} value={h}>{h} hr</option>)}
      </select>
      <select
        value={mins}
        onChange={e => setMins(Number(e.target.value))}
        style={{ fontSize: 11, padding: '2px 4px', borderRadius: 6 }}
      >
        {DURATION_MINUTE_OPTS.map(m => <option key={m} value={m}>{m} min</option>)}
      </select>
    </div>
  )
}
