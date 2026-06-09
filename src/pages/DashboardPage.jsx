import { useState, useEffect, useRef } from 'react'
import { format, startOfWeek, startOfMonth, subDays } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getCurrentQuarter, getQuarterYear } from '../lib/constants'

import Confetti from '../components/ui/Confetti'
import ImageHeader from '../components/dashboard/ImageHeader'
import DetailPanel from '../components/dashboard/DetailPanel'
import DailyView from '../components/dashboard/views/DailyView'
import WeeklyView from '../components/dashboard/views/WeeklyView'
import MonthlyView from '../components/dashboard/views/MonthlyView'
import QuarterlyView from '../components/dashboard/views/QuarterlyView'
import { Link } from 'react-router-dom'

const VIEWS = ['Daily', 'Weekly', 'Monthly', 'Quarterly']
const VIEW_KEYS = ['daily', 'weekly', 'monthly', 'quarterly']

// ── helpers ──────────────────────────────────────────────────────────────────
function greeting(name) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name ? `${time}, ${name.split(' ')[0]}` : time
}

export default function DashboardPage() {
  const { user } = useAuth()

  const today      = format(new Date(), 'yyyy-MM-dd')
  const weekStart  = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const quarter    = getCurrentQuarter()
  // rough quarter start — use 90 days back for mood trend
  const quarterStart = format(subDays(new Date(), 90), 'yyyy-MM-dd')
  const isFriday   = new Date().getDay() === 5

  // ── state ──────────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState('daily')

  // Core data
  const [habits,    setHabits]    = useState([])
  const [weekTasks, setWeekTasks] = useState([])
  const [goals,     setGoals]     = useState([])
  const [moodWeek,  setMoodWeek]  = useState([])
  const [hydration, setHydration] = useState(0)
  const [imageUrl,  setImageUrl]  = useState(null)
  const [loading,   setLoading]   = useState(true)

  // Weekly view extra
  const [savedQuote, setSavedQuote] = useState(null)

  // Monthly view extra
  const [monthHabitLogs,  setMonthHabitLogs]  = useState([])
  const [income,          setIncome]          = useState([])
  const [fixed,           setFixed]           = useState([])
  const [variable,        setVariable]        = useState([])
  const [contentBatches,  setContentBatches]  = useState([])
  const [monthlyLoaded,   setMonthlyLoaded]   = useState(false)

  // Quarterly view extra
  const [moodTrend,       setMoodTrend]       = useState([])
  const [quarterlyNotes,  setQuarterlyNotes]  = useState(null)
  const [quarterlyLoaded, setQuarterlyLoaded] = useState(false)

  // Card orders
  const [cardOrders, setCardOrders] = useState({})

  // Panel
  const [panel, setPanel] = useState(null)

  // Confetti
  const [confetti, setConfetti] = useState(false)
  const prevMomentum = useRef(0)

  // ── data loading ───────────────────────────────────────────────────────────
  useEffect(() => { if (user) loadCore() }, [user])

  async function loadCore() {
    setLoading(true)
    const [habitsRes, logsRes, tasksRes, goalsRes, moodRes, wellnessRes, profileRes, layoutRes, quoteRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id),
      supabase.from('habit_logs').select('habit_id,log_date').eq('user_id', user.id).gte('log_date', weekStart),
      supabase.from('weekly_tasks').select('*').eq('user_id', user.id).eq('week_start', weekStart),
      supabase.from('goals').select('*').eq('user_id', user.id),
      supabase.from('mood_logs').select('mood_score,log_date').eq('user_id', user.id).gte('log_date', weekStart),
      supabase.from('wellness_logs').select('hydration_ml').eq('user_id', user.id).eq('log_date', today).maybeSingle(),
      supabase.from('profiles').select('image_url').eq('id', user.id).maybeSingle(),
      supabase.from('dashboard_layout').select('view,card_order').eq('user_id', user.id),
      supabase.from('weekly_quotes').select('quote').eq('user_id', user.id).eq('week_start', weekStart).maybeSingle(),
    ])

    // Habits with done flag + week logs
    const allHabits = habitsRes.data || []
    const logRows   = logsRes.data || []
    const todaySet  = new Set(logRows.filter(l => l.log_date === today).map(l => l.habit_id))
    const weekLogsByHabit = {}
    logRows.forEach(l => {
      if (!weekLogsByHabit[l.habit_id]) weekLogsByHabit[l.habit_id] = new Set()
      weekLogsByHabit[l.habit_id].add(l.log_date)
    })
    const habitsWithMeta = allHabits.map(h => ({
      ...h,
      done: todaySet.has(h.id),
      weekLogs: weekLogsByHabit[h.id] || new Set(),
    }))

    setHabits(habitsWithMeta)
    setWeekTasks(tasksRes.data || [])
    setGoals(goalsRes.data || [])
    setMoodWeek(moodRes.data || [])
    setHydration(wellnessRes.data?.hydration_ml || 0)
    setImageUrl(profileRes.data?.image_url || null)
    setSavedQuote(quoteRes.data?.quote || null)

    // Card orders
    const orders = {}
    ;(layoutRes.data || []).forEach(row => { orders[row.view] = row.card_order })
    setCardOrders(orders)

    setLoading(false)
  }

  // Lazy load Monthly data
  async function loadMonthly() {
    if (monthlyLoaded) return
    const thisMonth = format(new Date(), 'yyyy-MM')
    const [mhRes, incRes, fixRes, varRes, batchRes] = await Promise.all([
      supabase.from('habit_logs').select('habit_id,log_date').eq('user_id', user.id).gte('log_date', monthStart),
      supabase.from('income_sources').select('*').eq('user_id', user.id),
      supabase.from('fixed_expenses').select('*').eq('user_id', user.id),
      supabase.from('variable_expenses').select('amount,category,date').eq('user_id', user.id).gte('date', monthStart),
      supabase.from('content_batches').select('id,name,ideas').eq('user_id', user.id).limit(6),
    ])
    setMonthHabitLogs(mhRes.data || [])
    setIncome(incRes.data || [])
    setFixed(fixRes.data || [])
    setVariable(varRes.data || [])
    setContentBatches(batchRes.data || [])
    setMonthlyLoaded(true)
  }

  // Lazy load Quarterly data
  async function loadQuarterly() {
    if (quarterlyLoaded) return
    const [mtRes, qnRes] = await Promise.all([
      supabase.from('mood_logs').select('mood_score,log_date').eq('user_id', user.id).gte('log_date', quarterStart).order('log_date'),
      supabase.from('quarterly_notes').select('*').eq('user_id', user.id).eq('quarter', quarter).maybeSingle(),
    ])
    setMoodTrend(mtRes.data || [])
    setQuarterlyNotes(qnRes.data || { wins: [], books: [], parking_lot: [] })
    setQuarterlyLoaded(true)
  }

  // On view switch — lazy load if needed
  useEffect(() => {
    if (activeView === 'monthly') loadMonthly()
    if (activeView === 'quarterly') loadQuarterly()
  }, [activeView])

  // ── momentum ───────────────────────────────────────────────────────────────
  const habitScore = habits.length  ? (habits.filter(h => h.done).length  / habits.length)  * 40 : 0
  const taskScore  = weekTasks.length ? (weekTasks.filter(t => t.complete).length / weekTasks.length) * 40 : 0
  const moodAvg    = moodWeek.length  ? moodWeek.reduce((s, m) => s + m.mood_score, 0) / moodWeek.length : null
  const moodScore  = moodAvg ? (moodAvg / 5) * 20 : 0
  const momentum   = Math.round(habitScore + taskScore + moodScore)

  useEffect(() => {
    if (!loading && momentum >= 80 && prevMomentum.current < 80) {
      setConfetti(true)
      setTimeout(() => setConfetti(false), 100)
    }
    prevMomentum.current = momentum
  }, [momentum, loading])

  // ── actions ────────────────────────────────────────────────────────────────
  function toggleHabit(habit) {
    supabase.from('habit_logs').insert({ user_id: user.id, habit_id: habit.id, log_date: today })
    setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, done: true } : h))
  }

  function toggleTask(task) {
    const newVal = !task.complete
    supabase.from('weekly_tasks').update({ complete: newVal }).eq('id', task.id)
    setWeekTasks(prev => prev.map(t => t.id === task.id ? { ...t, complete: newVal } : t))
  }

  async function addHydration(ml) {
    const newVal = hydration + ml
    const existing = await supabase.from('wellness_logs').select('id').eq('user_id', user.id).eq('log_date', today).maybeSingle()
    if (existing.data) {
      await supabase.from('wellness_logs').update({ hydration_ml: newVal }).eq('id', existing.data.id)
    } else {
      await supabase.from('wellness_logs').insert({ user_id: user.id, log_date: today, hydration_ml: newVal })
    }
    setHydration(newVal)
  }

  async function saveCardOrder(view, newOrder) {
    setCardOrders(prev => ({ ...prev, [view]: newOrder }))
    await supabase.from('dashboard_layout').upsert(
      { user_id: user.id, view, card_order: newOrder },
      { onConflict: 'user_id,view' }
    )
  }

  // ── render ─────────────────────────────────────────────────────────────────
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const greetText = !loading && momentum >= 70
    ? `Strong week, ${name.split(' ')[0]} — ${habits.filter(h=>h.done).length} habits, ${weekTasks.filter(t=>t.complete).length} tasks.`
    : greeting(name)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.1em' }}>LOADING…</p>
      </div>
    )
  }

  return (
    <div>
      <Confetti active={confetti} />

      {/* Moodboard image header with greeting overlaid */}
      <ImageHeader user={user} imageUrl={imageUrl} onUpdate={setImageUrl} greeting={greetText} />

      {/* Subline + Friday banner */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: isFriday ? 14 : 0 }}>
          {format(new Date(), 'EEEE, d MMMM yyyy')} · {getQuarterYear()}
        </p>
        {isFriday && (
          <div style={{
            background: 'linear-gradient(135deg, var(--career-tint) 0%, var(--bg) 100%)',
            border: '1px solid var(--career)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <p style={{ color: 'var(--career)', fontWeight: 600, fontSize: 14 }}>It's Friday — time for your end-of-week review</p>
              <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 3 }}>Reflect, carry forward, set intentions for next week.</p>
            </div>
            <Link to="/weekly?review=1" className="btn btn-career btn-sm" style={{ flexShrink: 0, color: '#fff' }}>Start →</Link>
          </div>
        )}
      </div>

      {/* View switcher — pill toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-2)', borderRadius: 'var(--radius-lg)', padding: 4, width: 'fit-content' }}>
        {VIEWS.map((label, i) => {
          const key = VIEW_KEYS[i]
          const active = activeView === key
          return (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              style={{
                padding: '7px 18px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                background: active ? 'var(--card-bg)' : 'transparent',
                color: active ? 'var(--career)' : 'var(--text-3)',
                border: active ? '1px solid var(--border)' : 'none',
                boxShadow: active ? 'var(--shadow)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'var(--font-body)',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Active view */}
      {activeView === 'daily' && (
        <DailyView
          habits={habits}
          weekTasks={weekTasks}
          hydration={hydration}
          user={user}
          today={today}
          onOpenPanel={setPanel}
          cardOrder={cardOrders.daily}
          onReorder={order => saveCardOrder('daily', order)}
          onHydrationAdd={addHydration}
        />
      )}

      {activeView === 'weekly' && (
        <WeeklyView
          habits={habits}
          weekTasks={weekTasks}
          momentum={momentum}
          habitScore={habitScore}
          taskScore={taskScore}
          moodScore={moodScore}
          moodAvg={moodAvg}
          moodWeek={moodWeek}
          weekStart={weekStart}
          savedQuote={savedQuote}
          userId={user.id}
          onSaveQuote={setSavedQuote}
          onOpenPanel={setPanel}
          cardOrder={cardOrders.weekly}
          onReorder={order => saveCardOrder('weekly', order)}
          onToggleTask={toggleTask}
        />
      )}

      {activeView === 'monthly' && (
        <MonthlyView
          habits={habits}
          monthHabitLogs={monthHabitLogs}
          goals={goals}
          weekTasks={weekTasks}
          income={income}
          fixed={fixed}
          variable={variable}
          contentBatches={contentBatches}
          onOpenPanel={setPanel}
          cardOrder={cardOrders.monthly}
          onReorder={order => saveCardOrder('monthly', order)}
        />
      )}

      {activeView === 'quarterly' && (
        <QuarterlyView
          goals={goals}
          weekTasks={weekTasks}
          moodTrend={moodTrend}
          quarterlyNotes={quarterlyNotes}
          userId={user.id}
          quarter={quarter}
          onOpenPanel={setPanel}
          cardOrder={cardOrders.quarterly}
          onReorder={order => saveCardOrder('quarterly', order)}
          onNotesUpdate={setQuarterlyNotes}
        />
      )}

      {/* Detail panel */}
      <DetailPanel
        panel={panel ? { ...panel, data: enrichPanelData(panel, { habits, weekTasks, goals, momentum, habitScore, taskScore, moodScore, moodAvg, moodWeek, hydration, toggleHabit, toggleTask }) } : null}
        onClose={() => setPanel(null)}
      />
    </div>
  )
}

// Merge panel data with live state
function enrichPanelData(panel, ctx) {
  if (!panel) return null
  const { type } = panel
  const base = panel.data || {}

  if (type === 'habits')   return { ...base, habits: ctx.habits, toggleHabit: ctx.toggleHabit }
  if (type === 'tasks')    return { ...base, tasks: ctx.weekTasks, toggleTask: ctx.toggleTask }
  if (type === 'goals')    return { ...base, goals: ctx.goals, tasks: ctx.weekTasks }
  if (type === 'momentum') return { habits: ctx.habits, weekTasks: ctx.weekTasks, momentum: ctx.momentum, habitScore: ctx.habitScore, taskScore: ctx.taskScore, moodScore: ctx.moodScore, moodAvg: ctx.moodAvg }
  if (type === 'mood')     return { moodWeek: ctx.moodWeek }
  if (type === 'water')    return { hydration: ctx.hydration }

  return { ...base, ...panel.data }
}
