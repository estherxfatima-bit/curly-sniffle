import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, startOfWeek, subDays, parseISO, differenceInCalendarDays } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Plus, Trash2, Check, Droplets, Dumbbell, ChevronDown, ChevronRight, Archive, Pencil, Image as ImageIcon, Moon } from 'lucide-react'
import ArcRing from '../components/ui/ArcRing'
import GoalModal from '../components/goals/GoalModal'
import SavedMealModal from '../components/wellness/SavedMealModal'
import WellnessDashboard from '../components/wellness/WellnessDashboard'

const WORKOUT_TYPES = ['Gym', 'Run', 'Yoga', 'Swim', 'Cycle', 'Walk', 'HIIT', 'Other']
const HYDRATION_GOAL = 2500
const MOOD_OPTIONS = [
  { emoji: '😞', label: 'Bad' },
  { emoji: '😕', label: 'Low' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '🙂', label: 'Good' },
  { emoji: '😄', label: 'Great' },
]
const FREQUENCY_UNITS = ['days', 'weeks', 'months']

function frequencyToDays(value, unit) {
  if (unit === 'weeks') return value * 7
  if (unit === 'months') return value * 30
  return value
}

function routineStatus(routine) {
  if (!routine.last_done_date) return { label: 'Not started', tone: 'muted', daysUntilDue: null, nextDue: null }
  const last = new Date(`${routine.last_done_date}T00:00:00`)
  const intervalDays = frequencyToDays(routine.frequency_value, routine.frequency_unit)
  const next = new Date(last)
  next.setDate(next.getDate() + intervalDays)
  const daysUntilDue = differenceInCalendarDays(next, new Date())
  let label, tone
  if (daysUntilDue < 0) { label = 'Overdue'; tone = 'danger' }
  else if (daysUntilDue <= routine.remind_days_before) { label = 'Due soon'; tone = 'warning' }
  else { label = 'On track'; tone = 'success' }
  return { label, tone, daysUntilDue, nextDue: next }
}

function DotGrid({ days }) {
  // days: array of { date, status: 'workout' | 'rest' | 'none' }, oldest first
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, maxWidth: 220 }}>
      {days.map(d => (
        <div
          key={d.date}
          title={`${d.date} — ${d.status}`}
          style={{
            width: 14, height: 14, borderRadius: '50%',
            background: d.status === 'workout' ? 'var(--wellness)' : 'transparent',
            border: d.status === 'rest' ? '2px solid #8fbf9f' : d.status === 'none' ? '1px solid var(--border)' : 'none',
            opacity: d.status === 'none' ? 0.4 : 1,
          }}
        />
      ))}
    </div>
  )
}

function WellnessDecoration() {
  return (
    <svg width="100" height="70" viewBox="0 0 100 70" fill="none">
      <path d="M20 55 Q20 35 30 30 Q40 25 40 45 Q40 60 30 62 Q20 64 20 55Z" stroke="currentColor" strokeWidth="1.5" opacity="0.2" fill="none"/>
      <circle cx="65" cy="28" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
      <path d="M57 28 L63 34 L73 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" fill="none"/>
      <rect x="55" y="50" width="24" height="14" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.15"/>
      <path d="M59 57 L67 57 M59 53 L71 53" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
    </svg>
  )
}

function HydrationRing({ ml, goal }) {
  const pct  = Math.min(1, ml / goal)
  const size = 100
  const sw   = 10
  const r    = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const dashOffset = circ * (1 - pct * 0.75) // 270° arc
  const startAngle = 135
  const rot = `rotate(${startAngle}, ${size/2}, ${size/2})`

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={sw}
        strokeDasharray={`${circ * 0.75} ${circ}`} strokeDashoffset={0}
        strokeLinecap="round" transform={rot} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--wellness)" strokeWidth={sw}
        strokeDasharray={`${circ * 0.75} ${circ}`} strokeDashoffset={circ * 0.75 * (1 - pct)}
        strokeLinecap="round" transform={rot}
        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)' }} />
      <text x={size/2} y={size/2 - 4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="14" fontWeight="600" fill="var(--text)">{ml}</text>
      <text x={size/2} y={size/2 + 12} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-3)">ml</text>
    </svg>
  )
}

export default function WellnessPage() {
  const { user } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [tab, setTab]                 = useState(() => new URLSearchParams(window.location.search).get('tab') || 'dashboard')
  const [mealTab, setMealTab]         = useState('plan')
  const [routines, setRoutines]       = useState([])
  const [newRoutine, setNewRoutine]   = useState({ name: '', frequency_value: 1, frequency_unit: 'weeks', remind_days_before: 2 })
  const [measurements, setMeasurements] = useState([])
  const [weightUnit, setWeightUnit]   = useState('kg')
  const [newMeasurement, setNewMeasurement] = useState({ date: format(new Date(), 'yyyy-MM-dd'), weight: '', custom: [] })
  const [newCustomName, setNewCustomName] = useState('')
  const [recentWorkoutDays, setRecentWorkoutDays] = useState([])
  const [workouts, setWorkouts]       = useState([])
  const [scheduledWorkouts, setScheduledWorkouts] = useState([])
  const [hydrationHistory, setHydrationHistory]   = useState([])
  const [mealPlan, setMealPlan]       = useState({ id: null, plan_text: '', prep_notes: '' })
  const [groceryList, setGroceryList] = useState({ id: null, items: [] })
  const [savedMeals, setSavedMeals]   = useState([])
  const [mealArchive, setMealArchive]       = useState([])
  const [groceryArchive, setGroceryArchive] = useState([])
  const [expandedArchive, setExpandedArchive] = useState(() => new Set())
  const [wellnessLog, setWellnessLog] = useState(null)
  const [wellnessGoals, setWellnessGoals] = useState([])
  const [weeklyTasks, setWeeklyTasks] = useState([])
  const [dailyTodos, setDailyTodos]   = useState([])
  const [goalMetrics, setGoalMetrics] = useState([])
  const [editingGoal, setEditingGoal] = useState(null)
  const [showMealModal, setShowMealModal] = useState(false)
  const [editingMeal, setEditingMeal] = useState(null)
  const [loading, setLoading]         = useState(true)

  // Forms
  const [newWorkout, setNewWorkout] = useState({ type: 'Gym', duration_min: '', notes: '', log_date: today })
  const [newGroceryItem, setNewGroceryItem] = useState('')
  const [hydrationInput, setHydrationInput] = useState(250)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const sevenDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd')
    const twentyEightDaysAgo = format(subDays(new Date(), 27), 'yyyy-MM-dd')
    const [wRes, swRes, mpRes, glRes, wlRes, hhRes, goalsRes, weeklyRes, dailyRes, metricsRes, mpaRes, glaRes, smRes, routinesRes, measurementsRes, prefsRes, recentRes] = await Promise.all([
      supabase.from('workout_logs').select('*').eq('user_id', user.id).eq('planned', false).order('log_date', { ascending: false }).limit(30),
      supabase.from('workout_logs').select('*').eq('user_id', user.id).eq('planned', true).order('log_date'),
      supabase.from('meal_plans').select('*').eq('user_id', user.id).eq('week_start', weekStart).maybeSingle(),
      supabase.from('grocery_lists').select('*').eq('user_id', user.id).eq('week_start', weekStart).maybeSingle(),
      supabase.from('wellness_logs').select('*').eq('user_id', user.id).eq('log_date', today).maybeSingle(),
      supabase.from('wellness_logs').select('log_date, hydration_ml').eq('user_id', user.id).gte('log_date', sevenDaysAgo),
      supabase.from('goals').select('*').eq('user_id', user.id).eq('category', 'Wellness'),
      supabase.from('weekly_tasks').select('id, goal_id, complete').eq('user_id', user.id).not('goal_id', 'is', null),
      supabase.from('daily_todos').select('id, goal_id, complete').eq('user_id', user.id).not('goal_id', 'is', null),
      supabase.from('goal_metrics').select('*').eq('user_id', user.id).order('recorded_at'),
      supabase.from('meal_plan_archive').select('*').eq('user_id', user.id).order('archived_at', { ascending: false }),
      supabase.from('grocery_list_archive').select('*').eq('user_id', user.id).order('archived_at', { ascending: false }),
      supabase.from('saved_meals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('wellness_routines').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('body_measurements').select('*').eq('user_id', user.id).order('date'),
      supabase.from('user_preferences').select('weight_unit').eq('user_id', user.id).maybeSingle(),
      supabase.from('workout_logs').select('log_date, type, planned').eq('user_id', user.id).gte('log_date', twentyEightDaysAgo),
    ])
    setWorkouts(wRes.data || [])
    setScheduledWorkouts(swRes.data || [])
    setMealPlan(mpRes.data ? { id: mpRes.data.id, plan_text: mpRes.data.plan_text || '', prep_notes: mpRes.data.prep_notes || '' } : { id: null, plan_text: '', prep_notes: '' })
    setGroceryList(glRes.data ? { id: glRes.data.id, items: glRes.data.items || [] } : { id: null, items: [] })
    setWellnessLog(wlRes.data)
    setHydrationHistory(hhRes.data || [])
    setWellnessGoals(goalsRes.data || [])
    setWeeklyTasks(weeklyRes.data || [])
    setDailyTodos(dailyRes.data || [])
    setGoalMetrics(metricsRes.data || [])
    setMealArchive(mpaRes.data || [])
    setGroceryArchive(glaRes.data || [])
    setSavedMeals(smRes.data || [])
    setRoutines(routinesRes.data || [])
    setMeasurements(measurementsRes.data || [])
    setWeightUnit(prefsRes.data?.weight_unit || 'kg')
    setRecentWorkoutDays((recentRes.data || []).filter(w => !w.planned))
    setLoading(false)
  }

  // Workout streak
  const workoutDates = [...new Set(workouts.map(w => w.log_date))].sort().reverse()
  let streak = 0
  let check = new Date(today)
  for (const d of workoutDates) {
    if (d === format(check, 'yyyy-MM-dd')) { streak++; check = subDays(check, 1) }
    else if (d === format(subDays(check, 1), 'yyyy-MM-dd')) { check = subDays(check, 1); streak++; check = subDays(check, 1) }
    else break
  }

  async function addWorkout() {
    if (!newWorkout.type) return
    const { data } = await supabase.from('workout_logs').insert({
      user_id: user.id, log_date: newWorkout.log_date, type: newWorkout.type,
      duration_min: newWorkout.duration_min ? parseInt(newWorkout.duration_min) : null,
      notes: newWorkout.notes || null,
    }).select().single()
    setWorkouts(prev => [data, ...prev])
    setNewWorkout({ type: 'Gym', duration_min: '', notes: '', log_date: today })
  }

  async function deleteWorkout(id) {
    await supabase.from('workout_logs').delete().eq('id', id)
    setWorkouts(prev => prev.filter(w => w.id !== id))
  }

  async function addScheduledWorkout({ type, log_date, notes }) {
    const { data } = await supabase.from('workout_logs').insert({
      user_id: user.id, log_date, type, notes: notes || null, planned: true,
    }).select().single()
    if (data) setScheduledWorkouts(prev => [...prev, data].sort((a, b) => a.log_date.localeCompare(b.log_date)))
  }

  async function completeScheduledWorkout(id) {
    const { data } = await supabase.from('workout_logs').update({ planned: false }).eq('id', id).select().single()
    setScheduledWorkouts(prev => prev.filter(w => w.id !== id))
    if (data) setWorkouts(prev => [data, ...prev])
  }

  async function deleteScheduledWorkout(id) {
    await supabase.from('workout_logs').delete().eq('id', id)
    setScheduledWorkouts(prev => prev.filter(w => w.id !== id))
  }

  async function logRestDay() {
    const { data } = await supabase.from('workout_logs').insert({
      user_id: user.id, log_date: today, type: 'rest', duration_min: null, planned: false,
    }).select().single()
    if (data) {
      setWorkouts(prev => [data, ...prev])
      setRecentWorkoutDays(prev => [...prev, { log_date: data.log_date, type: 'rest', planned: false }])
    }
  }

  // Routines
  async function addRoutine() {
    if (!newRoutine.name.trim()) return
    const { data } = await supabase.from('wellness_routines').insert({
      user_id: user.id,
      name: newRoutine.name.trim(),
      frequency_value: parseInt(newRoutine.frequency_value) || 1,
      frequency_unit: newRoutine.frequency_unit,
      remind_days_before: parseInt(newRoutine.remind_days_before) || 0,
    }).select().single()
    if (data) setRoutines(prev => [...prev, data])
    setNewRoutine({ name: '', frequency_value: 1, frequency_unit: 'weeks', remind_days_before: 2 })
  }

  async function markRoutineDone(routine) {
    const { data } = await supabase.from('wellness_routines').update({ last_done_date: today }).eq('id', routine.id).select().single()
    if (data) setRoutines(prev => prev.map(r => r.id === routine.id ? data : r))
  }

  async function deleteRoutine(id) {
    await supabase.from('wellness_routines').delete().eq('id', id)
    setRoutines(prev => prev.filter(r => r.id !== id))
  }

  // Body measurements
  function addCustomMeasurementRow() {
    if (!newCustomName.trim()) return
    setNewMeasurement(p => ({ ...p, custom: [...p.custom, { name: newCustomName.trim(), value: '' }] }))
    setNewCustomName('')
  }
  function updateCustomMeasurementRow(idx, value) {
    setNewMeasurement(p => ({ ...p, custom: p.custom.map((c, i) => i === idx ? { ...c, value } : c) }))
  }
  function removeCustomMeasurementRow(idx) {
    setNewMeasurement(p => ({ ...p, custom: p.custom.filter((_, i) => i !== idx) }))
  }
  async function saveMeasurement() {
    const custom_measurements = {}
    for (const c of newMeasurement.custom) {
      if (c.name && c.value !== '') custom_measurements[c.name] = parseFloat(c.value)
    }
    const { data } = await supabase.from('body_measurements').insert({
      user_id: user.id,
      date: newMeasurement.date,
      weight: newMeasurement.weight !== '' ? parseFloat(newMeasurement.weight) : null,
      custom_measurements,
    }).select().single()
    if (data) setMeasurements(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)))
    setNewMeasurement({ date: format(new Date(), 'yyyy-MM-dd'), weight: '', custom: [] })
  }
  async function deleteMeasurement(id) {
    await supabase.from('body_measurements').delete().eq('id', id)
    setMeasurements(prev => prev.filter(m => m.id !== id))
  }

  // Mood
  async function setMood(emoji, label) {
    if (wellnessLog) {
      const { data } = await supabase.from('wellness_logs').update({ mood: label, mood_emoji: emoji }).eq('id', wellnessLog.id).select().single()
      if (data) setWellnessLog(data)
    } else {
      const { data } = await supabase.from('wellness_logs').upsert(
        { user_id: user.id, log_date: today, mood: label, mood_emoji: emoji },
        { onConflict: 'user_id,log_date' }
      ).select().single()
      if (data) setWellnessLog(data)
    }
  }

  async function logHydration() {
    const existing = wellnessLog
    const current = existing?.hydration_ml || 0
    const updated = current + hydrationInput
    if (existing) {
      await supabase.from('wellness_logs').update({ hydration_ml: updated }).eq('id', existing.id)
      setWellnessLog(prev => ({ ...prev, hydration_ml: updated }))
    } else {
      const { data } = await supabase.from('wellness_logs').insert({ user_id: user.id, log_date: today, hydration_ml: updated }).select().single()
      setWellnessLog(data)
    }
  }

  // Meal plan
  function updatePlanText(value) {
    setMealPlan(prev => ({ ...prev, plan_text: value }))
  }
  function updatePrepNotes(value) {
    setMealPlan(prev => ({ ...prev, prep_notes: value }))
  }
  async function persistMealPlan() {
    const payload = { user_id: user.id, week_start: weekStart, plan_text: mealPlan.plan_text, prep_notes: mealPlan.prep_notes, updated_at: new Date().toISOString() }
    const { data } = await supabase.from('meal_plans').upsert(payload, { onConflict: 'user_id,week_start' }).select().single()
    if (data) setMealPlan(prev => ({ ...prev, id: data.id }))
  }

  // Grocery list
  async function persistGroceryList(items) {
    const payload = { user_id: user.id, week_start: weekStart, items, updated_at: new Date().toISOString() }
    const { data } = await supabase.from('grocery_lists').upsert(payload, { onConflict: 'user_id,week_start' }).select().single()
    setGroceryList({ id: data?.id ?? groceryList.id, items })
  }
  function addGroceryItem() {
    if (!newGroceryItem.trim()) return
    persistGroceryList([...groceryList.items, { text: newGroceryItem.trim(), checked: false }])
    setNewGroceryItem('')
  }
  function toggleGroceryItem(idx) {
    const items = groceryList.items.map((it, i) => i === idx ? { ...it, checked: !it.checked } : it)
    const unchecked = items.filter(it => !it.checked)
    const checked = items.filter(it => it.checked)
    persistGroceryList([...unchecked, ...checked])
  }
  function clearChecked() {
    persistGroceryList(groceryList.items.filter(it => !it.checked))
  }

  // Saved meals
  async function saveMeal(form) {
    if (editingMeal?.id) {
      const { data } = await supabase.from('saved_meals').update(form).eq('id', editingMeal.id).select().single()
      if (data) setSavedMeals(prev => prev.map(m => m.id === data.id ? data : m))
    } else {
      const { data } = await supabase.from('saved_meals').insert({ user_id: user.id, ...form }).select().single()
      if (data) setSavedMeals(prev => [data, ...prev])
    }
    setShowMealModal(false)
    setEditingMeal(null)
  }
  async function deleteMeal(id) {
    if (!confirm('Delete this meal?')) return
    await supabase.from('saved_meals').delete().eq('id', id)
    setSavedMeals(prev => prev.filter(m => m.id !== id))
  }
  function addMealToGroceryList(meal) {
    const existing = new Set(groceryList.items.map(it => it.text.trim().toLowerCase()))
    const newItems = []
    for (const ing of (meal.ingredients || [])) {
      const key = ing.trim().toLowerCase()
      if (!key || existing.has(key)) continue
      existing.add(key)
      newItems.push({ text: ing.trim(), checked: false })
    }
    if (newItems.length === 0) return
    persistGroceryList([...groceryList.items, ...newItems])
  }

  // Archive
  async function archiveWeek() {
    const name = `Week of ${format(parseISO(weekStart), 'd MMMM yyyy')}`
    const [mpaRes, glaRes] = await Promise.all([
      supabase.from('meal_plan_archive').insert({ user_id: user.id, name, week_start: weekStart, plan_text: mealPlan.plan_text, prep_notes: mealPlan.prep_notes }).select().single(),
      supabase.from('grocery_list_archive').insert({ user_id: user.id, name, week_start: weekStart, items: groceryList.items }).select().single(),
    ])
    if (mpaRes.data) setMealArchive(prev => [mpaRes.data, ...prev])
    if (glaRes.data) setGroceryArchive(prev => [glaRes.data, ...prev])
  }
  function toggleArchiveExpanded(id) {
    setExpandedArchive(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Wellness goals
  function linkedTasksFor(goalId) {
    return [...weeklyTasks.filter(t => t.goal_id === goalId), ...dailyTodos.filter(t => t.goal_id === goalId)]
  }
  function goalProgress(goal) {
    if (goal.tracking_type === 'metric') {
      const start = Number(goal.metric_start ?? 0)
      const target = Number(goal.metric_target ?? 0)
      const history = goalMetrics.filter(m => m.goal_id === goal.id)
      const current = history.length ? Number(history[history.length - 1].value) : start
      const span = target - start
      return span !== 0 ? Math.round(Math.min(Math.max((current - start) / span, 0), 1) * 100) : 0
    }
    const linked = linkedTasksFor(goal.id)
    const total = linked.length
    const done = linked.filter(t => t.complete).length
    return total ? Math.round((done / total) * 100) : 0
  }

  if (loading) return <p style={{ padding: 40, color: 'var(--text-3)', textAlign: 'center' }}>Loading…</p>

  return (
    <div>
      <div className="page-header header-wellness mb-6">
        <div>
          <h1>Wellness</h1>
          <p>Workouts, meals, hydration, and goals in one place</p>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--wellness)' }}><WellnessDecoration /></div>
      </div>

      {/* Wellness goals */}
      <div className="mb-6">
        <h3 style={{ fontSize: '0.95rem', marginBottom: 10 }}>Wellness goals</h3>
        {wellnessGoals.length === 0 ? (
          <div className="empty-state">
            <p>No wellness goals yet. <Link to="/goals" style={{ color: 'var(--wellness)' }}>Add one on the Goals page</Link>.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {wellnessGoals.map(goal => {
              const pct = goalProgress(goal)
              const linkedCount = linkedTasksFor(goal.id).length
              return (
                <div
                  key={goal.id}
                  className="card card-wellness"
                  onClick={() => setEditingGoal(goal)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}
                >
                  <ArcRing value={pct} max={100} size={44} strokeWidth={4} color="var(--wellness)" label={`${pct}%`} fontSize={9} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.primary_goal}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{linkedCount} task{linkedCount === 1 ? '' : 's'} linked</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5" style={{ '--section-tab-color': 'var(--wellness)' }}>
        {['dashboard', 'workouts', 'meals', 'hydration', 'routines', 'body'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`btn btn-sm tab-item ${tab === t ? 'active' : 'btn-ghost'}`}
            style={tab === t ? { color: '#fff', background: 'var(--wellness)' } : {}}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Dashboard tab */}
      {tab === 'dashboard' && (
        <WellnessDashboard
          streak={streak}
          sessionsThisWeek={workouts.filter(w => w.log_date >= weekStart).length}
          hydrationToday={wellnessLog?.hydration_ml || 0}
          hydrationHistory={hydrationHistory}
          mealPlan={mealPlan}
          wellnessGoals={wellnessGoals}
          goalProgress={goalProgress}
          linkedTasksFor={linkedTasksFor}
          workouts={workouts}
          scheduledWorkouts={scheduledWorkouts}
          today={today}
          onAddScheduled={addScheduledWorkout}
          onCompleteScheduled={completeScheduledWorkout}
          onDeleteScheduled={deleteScheduledWorkout}
        />
      )}

      {/* Workouts tab */}
      {tab === 'workouts' && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="card" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
              <Dumbbell size={16} color="var(--wellness)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                {streak > 0 ? `${streak} day streak ${streak >= 3 ? '🔥' : ''}` : 'No current streak'}
              </span>
            </div>
            <div className="card" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{workouts.filter(w => w.log_date >= weekStart).length} sessions this week</span>
            </div>
          </div>

          <div className="card mb-4">
            <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>Log workout</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <select value={newWorkout.type} onChange={e => setNewWorkout(p => ({ ...p, type: e.target.value }))} style={{ fontSize: 12 }}>
                {WORKOUT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <input type="number" placeholder="Duration (min)" value={newWorkout.duration_min} onChange={e => setNewWorkout(p => ({ ...p, duration_min: e.target.value }))} style={{ fontSize: 12, width: 130 }} />
              <input type="date" value={newWorkout.log_date} onChange={e => setNewWorkout(p => ({ ...p, log_date: e.target.value }))} style={{ fontSize: 12 }} />
            </div>
            <input placeholder="Notes (optional)" value={newWorkout.notes} onChange={e => setNewWorkout(p => ({ ...p, notes: e.target.value }))} style={{ fontSize: 12, marginBottom: 8 }} />
            <button className="btn btn-sm btn-wellness" style={{ color: '#fff' }} onClick={addWorkout}><Plus size={12} /> Log</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {workouts.map(w => (
              <div key={w.id} className="card flex items-center justify-between gap-3" style={{ padding: '10px 14px' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{w.type}{w.duration_min ? ` · ${w.duration_min}min` : ''}</p>
                  {w.notes && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{w.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{w.log_date}</span>
                  <button className="btn-icon btn" onClick={() => deleteWorkout(w.id)}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meals tab */}
      {tab === 'meals' && (
        <div>
          {/* Meal sub-tabs */}
          <div className="flex gap-2 mb-4" style={{ '--section-tab-color': 'var(--wellness)' }}>
            {[{ key: 'plan', label: 'Plan' }, { key: 'myMeals', label: 'My Meals' }].map(t => (
              <button key={t.key} onClick={() => setMealTab(t.key)} className={`btn btn-sm tab-item ${mealTab === t.key ? 'active' : 'btn-ghost'}`}
                style={mealTab === t.key ? { color: '#fff', background: 'var(--wellness)' } : {}}>
                {t.label}
              </button>
            ))}
          </div>

          {mealTab === 'plan' && (
            <div>
              {/* Weekly plan */}
              <div className="card mb-4">
                <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>This week's plan</h3>
                <textarea
                  value={mealPlan.plan_text}
                  onChange={e => updatePlanText(e.target.value)}
                  onBlur={persistMealPlan}
                  placeholder="Jot down what you're eating this week…"
                  style={{ width: '100%', minHeight: 180, fontSize: 13 }}
                />
                <div style={{ marginTop: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 4 }}>Meal prep notes</label>
                  <textarea
                    value={mealPlan.prep_notes}
                    onChange={e => updatePrepNotes(e.target.value)}
                    onBlur={persistMealPlan}
                    placeholder="Batch prep instructions…"
                    style={{ width: '100%', minHeight: 70, fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Grocery list */}
              <div className="card mb-4">
                <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>Grocery list</h3>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input
                    placeholder="Add item and press Enter…"
                    value={newGroceryItem}
                    onChange={e => setNewGroceryItem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addGroceryItem()}
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  {groceryList.items.some(it => it.checked) && (
                    <button className="btn btn-sm btn-ghost" onClick={clearChecked}>Clear checked</button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {groceryList.items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-3" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <button
                        onClick={() => toggleGroceryItem(idx)}
                        style={{
                          width: 20, height: 20, borderRadius: 4, border: `2px solid ${it.checked ? 'var(--wellness)' : 'var(--border)'}`,
                          background: it.checked ? 'var(--wellness)' : 'transparent', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                        }}
                      >
                        {it.checked && <Check size={12} color="#fff" />}
                      </button>
                      <span style={{ fontSize: 13, flex: 1, textDecoration: it.checked ? 'line-through' : 'none', color: it.checked ? 'var(--text-3)' : 'var(--text)' }}>
                        {it.text}
                      </span>
                    </div>
                  ))}
                  {groceryList.items.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>List is empty.</p>}
                </div>
              </div>

              {/* Archive this week */}
              <div className="flex justify-end mb-4">
                <button className="btn btn-sm btn-wellness" style={{ color: '#fff' }} onClick={archiveWeek}>
                  <Archive size={12} /> Archive this week
                </button>
              </div>

              {/* Archive browser */}
              <div className="card">
                <button
                  onClick={() => toggleArchiveExpanded('__archive_section__')}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <span className="flex items-center gap-2" style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    {expandedArchive.has('__archive_section__') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Archive
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{mealArchive.length} week{mealArchive.length === 1 ? '' : 's'}</span>
                </button>

                {expandedArchive.has('__archive_section__') && (
                  <div style={{ marginTop: 12 }}>
                    {mealArchive.length === 0 ? (
                      <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No archived weeks yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {mealArchive.map(entry => {
                          const grocery = groceryArchive.find(g => g.name === entry.name && g.week_start === entry.week_start)
                          const open = expandedArchive.has(entry.id)
                          return (
                            <div key={entry.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                              <button
                                onClick={() => toggleArchiveExpanded(entry.id)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', padding: '4px 0', cursor: 'pointer' }}
                              >
                                <span className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 500 }}>
                                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  {entry.name}
                                </span>
                                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{format(new Date(entry.archived_at), 'd MMM yyyy')}</span>
                              </button>
                              {open && (
                                <div style={{ marginTop: 8, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  <div>
                                    <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 4 }}>Plan</p>
                                    <p style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{entry.plan_text || <span style={{ color: 'var(--text-3)' }}>—</span>}</p>
                                  </div>
                                  {entry.prep_notes && (
                                    <div>
                                      <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 2 }}>Prep notes</p>
                                      <p style={{ fontSize: 12 }}>{entry.prep_notes}</p>
                                    </div>
                                  )}
                                  {grocery && grocery.items?.length > 0 && (
                                    <div>
                                      <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 4 }}>Grocery list</p>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {grocery.items.map((it, i) => (
                                          <p key={i} style={{ fontSize: 12, textDecoration: it.checked ? 'line-through' : 'none', color: it.checked ? 'var(--text-3)' : 'var(--text)' }}>{it.text}</p>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {mealTab === 'myMeals' && (
            <div>
              <div className="flex justify-end mb-4">
                <button className="btn btn-sm btn-wellness" style={{ color: '#fff' }} onClick={() => { setEditingMeal(null); setShowMealModal(true) }}>
                  <Plus size={12} /> Add meal
                </button>
              </div>

              {savedMeals.length === 0 ? (
                <div className="empty-state"><p>No saved meals yet. Add your go-to recipes to build a library.</p></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  {savedMeals.map(meal => (
                    <div key={meal.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      {meal.image_url ? (
                        <img src={meal.image_url} alt={meal.name} style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: 120, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ImageIcon size={28} color="var(--text-3)" />
                        </div>
                      )}
                      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{meal.name}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{(meal.ingredients || []).length} ingredient{(meal.ingredients || []).length === 1 ? '' : 's'}</p>
                        </div>
                        <div className="flex items-center gap-2 wrap" style={{ marginTop: 'auto' }}>
                          <button className="btn btn-xs btn-wellness" style={{ color: '#fff' }} onClick={() => addMealToGroceryList(meal)}>
                            <Plus size={11} /> Add to grocery list
                          </button>
                          <button className="btn-icon btn" onClick={() => { setEditingMeal(meal); setShowMealModal(true) }}><Pencil size={12} /></button>
                          <button className="btn-icon btn" onClick={() => deleteMeal(meal.id)}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hydration tab */}
      {tab === 'hydration' && (
        <div style={{ maxWidth: 360 }}>
          <div className="card">
            <h3 style={{ fontSize: '0.9rem', marginBottom: 16 }}>
              <Droplets size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--wellness)' }} />
              Hydration today
            </h3>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <HydrationRing ml={wellnessLog?.hydration_ml || 0} goal={HYDRATION_GOAL} />
            </div>
            <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginBottom: 14 }}>
              Goal: {HYDRATION_GOAL}ml
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={hydrationInput} onChange={e => setHydrationInput(parseInt(e.target.value))} style={{ fontSize: 12, flex: 1 }}>
                {[150, 200, 250, 330, 500, 750, 1000].map(ml => <option key={ml} value={ml}>{ml}ml</option>)}
              </select>
              <button className="btn btn-sm btn-wellness" style={{ color: '#fff' }} onClick={logHydration}>+ Log</button>
            </div>
          </div>
        </div>
      )}

      {editingGoal && (
        <GoalModal
          goal={editingGoal}
          defaults={null}
          onClose={() => setEditingGoal(null)}
          onSave={goal => {
            setWellnessGoals(prev => goal.category === 'Wellness'
              ? prev.map(g => g.id === goal.id ? goal : g)
              : prev.filter(g => g.id !== goal.id))
            setEditingGoal(null)
          }}
        />
      )}

      {showMealModal && (
        <SavedMealModal
          meal={editingMeal}
          userId={user.id}
          onClose={() => { setShowMealModal(false); setEditingMeal(null) }}
          onSave={saveMeal}
        />
      )}
    </div>
  )
}
