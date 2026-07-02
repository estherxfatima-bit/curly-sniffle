import { useState, useEffect, useRef, useMemo } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, addDays, addWeeks, addMonths, parseISO } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getQuarterFromDate, getQuarterYear } from '../lib/constants'
import { simulateHabit } from '../lib/habitUtils'

import Confetti from '../components/ui/Confetti'
import ImageHeader from '../components/dashboard/ImageHeader'
import DetailPanel from '../components/dashboard/DetailPanel'
import ReflectionModal from '../components/dashboard/ReflectionModal'
import DailyView, { DEFAULT_ORDER as DAILY_DEFAULT } from '../components/dashboard/views/DailyView'
import WeeklyView, { DEFAULT_ORDER as WEEKLY_DEFAULT } from '../components/dashboard/views/WeeklyView'
import MonthlyView, { DEFAULT_ORDER as MONTHLY_DEFAULT } from '../components/dashboard/views/MonthlyView'
import QuarterlyView, { DEFAULT_ORDER as QUARTERLY_DEFAULT } from '../components/dashboard/views/QuarterlyView'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Pencil, Check as CheckIcon } from 'lucide-react'
import SpendingReminderBanner from '../components/finance/SpendingReminderBanner'
import DashboardFab from '../components/dashboard/DashboardFab'
import { shouldShowSpendingReminder, isReminderDismissedToday, dismissReminderToday } from '../lib/financeUtils'

const VIEWS = ['Daily', 'Weekly', 'Monthly', 'Quarterly']
const VIEW_KEYS = ['daily', 'weekly', 'monthly', 'quarterly']
const DEFAULTS = { daily: DAILY_DEFAULT, weekly: WEEKLY_DEFAULT, monthly: MONTHLY_DEFAULT, quarterly: QUARTERLY_DEFAULT }

// ── helpers ──────────────────────────────────────────────────────────────────
function greeting(name) {
  const h = parseInt(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/London' }).format(new Date()),
    10,
  )
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name ? `${time}, ${name.split(' ')[0]}` : time
}

function shiftRefDate(date, view, dir) {
  if (view === 'daily')     return addDays(date, dir)
  if (view === 'weekly')    return addWeeks(date, dir)
  if (view === 'monthly')   return addMonths(date, dir)
  if (view === 'quarterly') return addMonths(date, dir * 3)
  return date
}

function normalizeOrder(order, view) {
  if (!order?.length) return DEFAULTS[view]
  return order.map(item => typeof item === 'string' ? { id: item, size: 'wide' } : item)
}

export default function DashboardPage() {
  const { user } = useAuth()

  // ── state ──────────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState('daily')
  const [refDate, setRefDate] = useState(new Date())
  const realToday  = format(new Date(), 'yyyy-MM-dd')
  const isWeekend  = new Date().getDay() === 6 || new Date().getDay() === 0 // Sat or Sun

  // Derived dates from refDate
  const today      = format(refDate, 'yyyy-MM-dd')
  // weekStart/weekEnd always anchor to real-today's week so day navigation
  // doesn't cause weekly cards (priority task, weekly habits) to load a
  // different week's data when the user browses to a day in another week.
  const weekStart  = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd    = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(refDate), 'yyyy-MM-dd')
  const quarter    = getQuarterFromDate(refDate)
  const year       = refDate.getFullYear()
  const quarterStart = format(addMonths(refDate, -3), 'yyyy-MM-dd')

  // Static data (loaded once)
  const [allHabits, setAllHabits] = useState([])
  const [allHabitLogs, setAllHabitLogs] = useState([])
  const [goals,     setGoals]     = useState([])
  const [imageUrl,  setImageUrl]  = useState(null)
  const [staticLoading, setStaticLoading] = useState(true)

  // Period data (reloaded when refDate changes)
  const [habitLogs, setHabitLogs] = useState([])
  const [weekTasks, setWeekTasks] = useState([])
  const [moodWeek,  setMoodWeek]  = useState([])
  const [hydration, setHydration] = useState(0)
  const [savedQuote, setSavedQuote] = useState(null)
  const [savedDailyQuote, setSavedDailyQuote] = useState(null)
  const [periodLoading, setPeriodLoading] = useState(true)

  // Monthly view extra
  const [monthHabitLogs,  setMonthHabitLogs]  = useState([])
  const [income,          setIncome]          = useState([])
  const [fixed,           setFixed]           = useState([])
  const [variable,        setVariable]        = useState([])
  const [savings,         setSavings]         = useState([])
  const [contentBatches,  setContentBatches]  = useState([])

  // Quarterly view extra
  const [moodTrend,       setMoodTrend]       = useState([])
  const [quarterlyNotes,  setQuarterlyNotes]  = useState(null)

  // Finance snapshot (used for the dashboard finance-snapshot / quick-add cards)
  const [financeVariable, setFinanceVariable] = useState([])
  const [financeBudgets,  setFinanceBudgets]  = useState([])
  const [financeReminderDismissed, setFinanceReminderDismissed] = useState(isReminderDismissedToday())

  // Card orders
  const [cardOrders, setCardOrders] = useState({})
  const [editing, setEditing] = useState(false)

  // Panel
  const [panel, setPanel] = useState(null)

  // Confetti
  const [confetti, setConfetti] = useState(false)
  const prevMomentum = useRef(0)

  // Daily reflection deep link (?reflect=1)
  const [showReflection, setShowReflection] = useState(() => new URLSearchParams(window.location.search).get('reflect') === '1')

  // ── data loading ───────────────────────────────────────────────────────────
  useEffect(() => { if (user) loadStatic() }, [user])
  useEffect(() => { if (user) loadPeriod() }, [user, today, weekStart])
  useEffect(() => { if (user) loadFinanceSnapshot() }, [user])
  useEffect(() => { if (user && activeView === 'monthly')   loadMonthly() },   [user, activeView, monthStart])
  useEffect(() => { if (user && activeView === 'quarterly') loadQuarterly() }, [user, activeView, quarter, year])

  async function loadStatic() {
    setStaticLoading(true)
    const [habitsRes, habitLogsRes, goalsRes, profileRes, layoutRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id),
      supabase.from('habit_logs').select('habit_id,log_date').eq('user_id', user.id),
      supabase.from('goals').select('*').eq('user_id', user.id),
      supabase.from('profiles').select('image_url').eq('id', user.id).maybeSingle(),
      supabase.from('dashboard_layout').select('view,card_order').eq('user_id', user.id),
    ])
    setAllHabits(habitsRes.data || [])
    setAllHabitLogs(habitLogsRes.data || [])
    setGoals(goalsRes.data || [])
    setImageUrl(profileRes.data?.image_url || null)

    const orders = {}
    ;(layoutRes.data || []).forEach(row => { orders[row.view] = row.card_order })
    setCardOrders(orders)
    setStaticLoading(false)
  }

  async function loadPeriod() {
    setPeriodLoading(true)
    const [logsRes, tasksRes, moodRes, wellnessRes, quoteRes, dailyQuoteRes] = await Promise.all([
      supabase.from('habit_logs').select('habit_id,log_date').eq('user_id', user.id).gte('log_date', weekStart).lte('log_date', weekEnd),
      supabase.from('weekly_tasks').select('*').eq('user_id', user.id).eq('week_start', weekStart).eq('archived', false),
      supabase.from('mood_logs').select('mood_score,log_date').eq('user_id', user.id).gte('log_date', weekStart).lte('log_date', weekEnd),
      supabase.from('wellness_logs').select('hydration_ml').eq('user_id', user.id).eq('log_date', today).maybeSingle(),
      supabase.from('weekly_quotes').select('quote').eq('user_id', user.id).eq('week_start', weekStart).maybeSingle(),
      supabase.from('daily_quotes').select('quote').eq('user_id', user.id).eq('log_date', today).maybeSingle(),
    ])
    setHabitLogs(logsRes.data || [])
    setWeekTasks(tasksRes.data || [])
    setMoodWeek(moodRes.data || [])
    setHydration(wellnessRes.data?.hydration_ml || 0)
    setSavedQuote(quoteRes.data?.quote || null)
    setSavedDailyQuote(dailyQuoteRes.data?.quote || null)
    setPeriodLoading(false)
  }

  async function loadMonthly() {
    const [mhRes, incRes, fixRes, varRes, savRes, batchRes] = await Promise.all([
      supabase.from('habit_logs').select('habit_id,log_date').eq('user_id', user.id).gte('log_date', monthStart),
      supabase.from('income_sources').select('*').eq('user_id', user.id),
      supabase.from('fixed_expenses').select('*').eq('user_id', user.id),
      supabase.from('variable_expenses').select('amount,category,date').eq('user_id', user.id).gte('date', monthStart),
      supabase.from('savings_allocations').select('amount,frequency').eq('user_id', user.id),
      supabase.from('content_batches').select('id,name,ideas').eq('user_id', user.id).limit(6),
    ])
    setMonthHabitLogs(mhRes.data || [])
    setIncome(incRes.data || [])
    setFixed(fixRes.data || [])
    setVariable(varRes.data || [])
    setSavings(savRes.data || [])
    setContentBatches(batchRes.data || [])
  }

  async function loadFinanceSnapshot() {
    const monthYear = format(new Date(), 'yyyy-MM')
    const [varRes, budRes] = await Promise.all([
      supabase.from('variable_expenses').select('id,amount,category,date,name').eq('user_id', user.id).order('date', { ascending: false }).limit(60),
      supabase.from('budgets').select('*').eq('user_id', user.id).eq('month_year', monthYear),
    ])
    setFinanceVariable(varRes.data || [])
    setFinanceBudgets(budRes.data || [])
  }

  async function addFinanceVariable({ amount, category, name }) {
    const { data } = await supabase.from('variable_expenses').insert({
      user_id: user.id, name, amount, category, date: realToday,
    }).select().single()
    setFinanceVariable(prev => [data, ...prev])
  }

  async function loadQuarterly() {
    const [mtRes, qnRes] = await Promise.all([
      supabase.from('mood_logs').select('mood_score,log_date').eq('user_id', user.id).gte('log_date', quarterStart).order('log_date'),
      supabase.from('quarterly_notes').select('*').eq('user_id', user.id).eq('quarter', quarter).maybeSingle(),
    ])
    setMoodTrend(mtRes.data || [])
    setQuarterlyNotes(qnRes.data || { wins: [], books: [], parking_lot: [] })
  }

  const loading = staticLoading || periodLoading

  // Finance snapshot
  const financeMonth = format(new Date(), 'yyyy-MM')
  const financeTotalVariable = financeVariable.filter(v => v.date.startsWith(financeMonth)).reduce((s, v) => s + v.amount, 0)
  const financeOverallBudget = financeBudgets.find(b => b.category === null)?.amount || 0
  const financeReminderDays = shouldShowSpendingReminder(financeVariable)

  // Habits with done flag + week logs, derived from static habits + period logs
  const todaySet = new Set(habitLogs.filter(l => l.log_date === today).map(l => l.habit_id))
  const weekLogsByHabit = {}
  habitLogs.forEach(l => {
    if (!weekLogsByHabit[l.habit_id]) weekLogsByHabit[l.habit_id] = new Set()
    weekLogsByHabit[l.habit_id].add(l.log_date)
  })
  // Live streaks, recalculated from real habit_logs whenever logs change
  const habitSims = useMemo(() => {
    const logsByHabit = {}
    allHabitLogs.forEach(l => {
      if (!logsByHabit[l.habit_id]) logsByHabit[l.habit_id] = new Set()
      logsByHabit[l.habit_id].add(l.log_date)
    })
    const sims = {}
    allHabits.forEach(h => { sims[h.id] = simulateHabit(h, logsByHabit[h.id] || new Set(), new Date()) })
    return sims
  }, [allHabits, allHabitLogs])

  const habits = allHabits.map(h => ({
    ...h,
    done: todaySet.has(h.id),
    weekLogs: weekLogsByHabit[h.id] || new Set(),
    streak: habitSims[h.id]?.streak ?? 0,
  }))

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
  async function toggleHabit(habit) {
    const isDone = todaySet.has(habit.id)
    if (isDone) {
      const { error } = await supabase.from('habit_logs').delete().eq('user_id', user.id).eq('habit_id', habit.id).eq('log_date', today)
      if (error) { alert(`Couldn't update habit: ${error.message}`); return }
      setHabitLogs(prev => prev.filter(l => !(l.habit_id === habit.id && l.log_date === today)))
      setAllHabitLogs(prev => prev.filter(l => !(l.habit_id === habit.id && l.log_date === today)))
    } else {
      const { error } = await supabase.from('habit_logs').insert({ user_id: user.id, habit_id: habit.id, log_date: today })
      if (error) { alert(`Couldn't update habit: ${error.message}`); return }
      setHabitLogs(prev => [...prev, { habit_id: habit.id, log_date: today }])
      setAllHabitLogs(prev => [...prev, { habit_id: habit.id, log_date: today }])
    }
  }

  function toggleTask(task) {
    const newVal = !task.complete
    supabase.from('weekly_tasks').update({ complete: newVal }).eq('id', task.id)
    setWeekTasks(prev => prev.map(t => t.id === task.id ? { ...t, complete: newVal } : t))
  }

  function removeTask(id) {
    supabase.from('weekly_tasks').delete().eq('id', id)
    setWeekTasks(prev => prev.filter(t => t.id !== id))
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

  function resizeCard(view, id, size) {
    const order = normalizeOrder(cardOrders[view], view).map(c => c.id === id ? { ...c, size } : c)
    saveCardOrder(view, order)
  }

  function removeCard(view, id) {
    const order = normalizeOrder(cardOrders[view], view).filter(c => c.id !== id)
    saveCardOrder(view, order)
  }

  function addCard(view, id) {
    const order = [...normalizeOrder(cardOrders[view], view), { id, size: 'wide' }]
    saveCardOrder(view, order)
  }

  // ── render ─────────────────────────────────────────────────────────────────
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const greetText = !loading && momentum >= 70
    ? `Strong week, ${name.split(' ')[0]} — ${habits.filter(h=>h.done).length} habits, ${weekTasks.filter(t=>t.complete).length} tasks.`
    : greeting(name)

  // Period label + "is current" check, per view
  let periodLabel = ''
  let isCurrentPeriod = false
  if (activeView === 'daily') {
    periodLabel = format(refDate, 'EEEE, d MMMM yyyy')
    isCurrentPeriod = today === realToday
  } else if (activeView === 'weekly') {
    periodLabel = `${format(new Date(weekStart), 'MMM d')} – ${format(new Date(weekEnd), 'MMM d, yyyy')}`
    isCurrentPeriod = weekStart === format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  } else if (activeView === 'monthly') {
    periodLabel = format(refDate, 'MMMM yyyy')
    isCurrentPeriod = monthStart === format(startOfMonth(new Date()), 'yyyy-MM-dd')
  } else if (activeView === 'quarterly') {
    periodLabel = `${quarter} ${year}`
    isCurrentPeriod = quarter === getQuarterFromDate(new Date()) && year === new Date().getFullYear()
  }

  const viewProps = {
    editing,
    onResize: (id, size) => resizeCard(activeView, id, size),
    onRemoveCard: id => removeCard(activeView, id),
    onAddCard: id => addCard(activeView, id),
  }

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

      {/* Spending reminder banner */}
      {financeReminderDays !== false && !financeReminderDismissed && (
        <SpendingReminderBanner days={financeReminderDays} onDismiss={() => { dismissReminderToday(); setFinanceReminderDismissed(true) }} />
      )}

      {/* Subline + Friday banner */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: isWeekend ? 14 : 0 }}>
          {format(new Date(), 'EEEE, d MMMM yyyy')} · {getQuarterYear()}
        </p>
        {isWeekend && (
          <div style={{
            background: 'linear-gradient(135deg, var(--career-tint) 0%, var(--bg) 100%)',
            border: '1px solid var(--career)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <p style={{ color: 'var(--career)', fontWeight: 600, fontSize: 14 }}>Week ending — time for your end-of-week review</p>
              <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 3 }}>Reflect, carry forward, set intentions for next week.</p>
            </div>
            <Link to="/weekly?review=1" className="btn btn-career btn-sm" style={{ flexShrink: 0, color: '#fff' }}>Start →</Link>
          </div>
        )}
      </div>

      {/* View switcher + period nav + edit toggle */}
      <div className="flex items-center justify-between gap-3 mb-6 wrap">
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', borderRadius: 'var(--radius-lg)', padding: 4, width: 'fit-content' }}>
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

        <div className="flex items-center gap-2 wrap">
          {/* Period navigation */}
          <button className="btn-icon btn" onClick={() => setRefDate(d => shiftRefDate(d, activeView, -1))} title="Previous">
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)', minWidth: 150, textAlign: 'center' }}>
            {periodLabel}
          </span>
          <button className="btn-icon btn" onClick={() => setRefDate(d => shiftRefDate(d, activeView, 1))} title="Next">
            <ChevronRight size={15} />
          </button>
          {!isCurrentPeriod && (
            <button className="btn btn-xs btn-ghost" onClick={() => setRefDate(new Date())}>Today</button>
          )}

          {/* Edit layout toggle */}
          <button
            className={`btn btn-sm ${editing ? 'btn-career' : 'btn-ghost'}`}
            style={editing ? { color: '#fff' } : {}}
            onClick={() => setEditing(v => !v)}
          >
            {editing ? <><CheckIcon size={13} /> Done</> : <><Pencil size={13} /> Edit layout</>}
          </button>
        </div>
      </div>

      {/* Active view */}
      {activeView === 'daily' && (
        <DailyView
          habits={habits}
          weekTasks={weekTasks}
          periodLoading={periodLoading}
          hydration={hydration}
          user={user}
          today={today}
          onDateChange={d => setRefDate(parseISO(d))}
          onOpenPanel={setPanel}
          cardOrder={normalizeOrder(cardOrders.daily, 'daily')}
          onReorder={order => saveCardOrder('daily', order)}
          onHydrationAdd={addHydration}
          financeTotalVariable={financeTotalVariable}
          financeOverallBudget={financeOverallBudget}
          onAddExpense={addFinanceVariable}
          savedDailyQuote={savedDailyQuote}
          onSaveDailyQuote={setSavedDailyQuote}
          onToggleHabit={toggleHabit}
          {...viewProps}
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
          cardOrder={normalizeOrder(cardOrders.weekly, 'weekly')}
          onReorder={order => saveCardOrder('weekly', order)}
          onToggleTask={toggleTask}
          onRemoveTask={removeTask}
          {...viewProps}
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
          savings={savings}
          contentBatches={contentBatches}
          onOpenPanel={setPanel}
          cardOrder={normalizeOrder(cardOrders.monthly, 'monthly')}
          onReorder={order => saveCardOrder('monthly', order)}
          {...viewProps}
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
          cardOrder={normalizeOrder(cardOrders.quarterly, 'quarterly')}
          onReorder={order => saveCardOrder('quarterly', order)}
          onNotesUpdate={setQuarterlyNotes}
          {...viewProps}
        />
      )}

      {/* Detail panel */}
      <DetailPanel
        panel={panel ? { ...panel, data: enrichPanelData(panel, { habits, weekTasks, goals, momentum, habitScore, taskScore, moodScore, moodAvg, moodWeek, hydration, toggleHabit, toggleTask, removeTask }) } : null}
        onClose={() => setPanel(null)}
      />

      {showReflection && (
        <ReflectionModal onClose={() => {
          setShowReflection(false)
          const url = new URL(window.location.href)
          url.searchParams.delete('reflect')
          window.history.replaceState({}, '', url.toString())
        }} />
      )}

      <DashboardFab onAddExpense={addFinanceVariable} />
    </div>
  )
}

// Merge panel data with live state
function enrichPanelData(panel, ctx) {
  if (!panel) return null
  const { type } = panel
  const base = panel.data || {}

  if (type === 'habits')   return { ...base, habits: ctx.habits, toggleHabit: ctx.toggleHabit }
  if (type === 'tasks')    return { ...base, tasks: ctx.weekTasks, toggleTask: ctx.toggleTask, onRemoveTask: ctx.removeTask }
  if (type === 'goals')    return { ...base, goals: ctx.goals, tasks: ctx.weekTasks }
  if (type === 'momentum') return { habits: ctx.habits, weekTasks: ctx.weekTasks, momentum: ctx.momentum, habitScore: ctx.habitScore, taskScore: ctx.taskScore, moodScore: ctx.moodScore, moodAvg: ctx.moodAvg }
  if (type === 'mood')     return { moodWeek: ctx.moodWeek }
  if (type === 'water')    return { hydration: ctx.hydration }

  return { ...base, ...panel.data }
}
