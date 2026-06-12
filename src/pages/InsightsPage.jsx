import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, eachDayOfInterval, subMonths, parseISO, differenceInCalendarDays } from 'date-fns'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Cell, Legend,
} from 'recharts'
import { Link } from 'react-router-dom'
import { SortableCard, DraggableCardList } from '../components/dashboard/DraggableCard'
import AddWidgetMenu from '../components/dashboard/AddWidgetMenu'
import ArcRing from '../components/ui/ArcRing'
import { Pencil, Check as CheckIcon } from 'lucide-react'
import { longestStreak, bestDayOfWeek, DAY_NAMES, getBuckets } from '../lib/insightsUtils'
import PeriodNav from '../components/ui/PeriodNav'
import { getTrailingBounds } from '../lib/periodNav'
import { VARIABLE_CATS, toMonthly } from '../lib/financeUtils'
import { getQuarterFromDate } from '../lib/constants'

const ROSE    = 'var(--personal)'
const COBALT  = 'var(--career)'
const GOLD    = 'var(--creative)'
const EMERALD = 'var(--finance)'
const PIE_COLORS = [GOLD, COBALT, ROSE, EMERALD, 'var(--wellness)', '#8a5cd4', 'var(--text-3)']

const CARD_LABELS = {
  'mood-trend':              'Mood trend',
  'mood-by-dow':             'Mood by day of week',
  'mood-vs-workout':         'Mood vs workout days',
  'habit-completion':        'Habit completion rate',
  'habit-best-day':          'Best day per habit',
  'habit-streaks':           'Longest streaks ever',
  'habit-mom':               'Month-on-month habit completion',
  'tasks-weekly':            'Tasks created vs completed',
  'carry-forward':           'Carry-forward rate',
  'goal-velocity':           'Goal progress velocity',
  'productive-area':         'Most productive area',
  'content-status':          'Ideas by status',
  'content-pillar':          'Ideas by pillar',
  'content-batches':         'Batch completion',
  'content-idea-to-post':    'Idea → posted time',
  'content-last-posted':     'Last posted',
  'finance-spend-category':  'Monthly spend by category',
  'finance-income-trend':    'Income trend',
  'finance-tax-pot':         'Tax pot growth',
  'finance-savings-rate':    'Savings rate',
  'finance-budget-adherence': 'Budget adherence',
}

const DEFAULT_ORDER = [
  { id: 'mood-trend',               size: 'wide' },
  { id: 'mood-by-dow',               size: 'square' },
  { id: 'mood-vs-workout',           size: 'square' },
  { id: 'habit-completion',          size: 'wide' },
  { id: 'habit-best-day',            size: 'square' },
  { id: 'habit-streaks',             size: 'square' },
  { id: 'habit-mom',                 size: 'wide' },
  { id: 'tasks-weekly',              size: 'wide' },
  { id: 'carry-forward',             size: 'square' },
  { id: 'goal-velocity',             size: 'wide' },
  { id: 'productive-area',           size: 'square' },
  { id: 'content-status',            size: 'square' },
  { id: 'content-pillar',            size: 'square' },
  { id: 'content-batches',           size: 'wide' },
  { id: 'content-idea-to-post',      size: 'square' },
  { id: 'content-last-posted',       size: 'square' },
  { id: 'finance-spend-category',    size: 'wide' },
  { id: 'finance-income-trend',      size: 'square' },
  { id: 'finance-tax-pot',           size: 'square' },
  { id: 'finance-savings-rate',      size: 'square' },
  { id: 'finance-budget-adherence',  size: 'wide' },
]

function normalizeOrder(order) {
  if (!order?.length) return DEFAULT_ORDER
  return order.map(item => typeof item === 'string' ? { id: item, size: 'wide' } : item)
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12, boxShadow: 'var(--shadow-card)' }}>
      <p style={{ color: 'var(--text-3)', marginBottom: 4, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.color || 'var(--text)' }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</p>)}
    </div>
  )
}

function InsightsDecoration() {
  return (
    <svg width="110" height="70" viewBox="0 0 110 70" fill="none">
      {[20,35,22,48,30,42,55].map((h, i) => (
        <rect key={i} x={8 + i*14} y={58-h} width={10} height={h} rx={3} fill="currentColor" opacity={0.08 + i * 0.03}/>
      ))}
    </svg>
  )
}

function Empty({ children }) {
  return <p style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontStyle: 'italic' }}>{children}</p>
}

export default function InsightsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)

  // Daily / weekly / monthly period navigation — same pattern as the Dashboard
  const [activeView, setActiveView] = useState('daily')
  const [refDate, setRefDate] = useState(new Date())

  // Raw data
  const [habits, setHabits] = useState([])
  const [habitLogs, setHabitLogs] = useState([])
  const [moodLogs, setMoodLogs] = useState([])
  const [workoutLogs, setWorkoutLogs] = useState([])
  const [weeklyTasks, setWeeklyTasks] = useState([])
  const [goals, setGoals] = useState([])
  const [goalMetrics, setGoalMetrics] = useState([])
  const [contentIdeas, setContentIdeas] = useState([])
  const [contentBatches, setContentBatches] = useState([])
  const [incomeSources, setIncomeSources] = useState([])
  const [fixedExpenses, setFixedExpenses] = useState([])
  const [variableExpenses, setVariableExpenses] = useState([])
  const [budgets, setBudgets] = useState([])

  // Card layout
  const [cardOrder, setCardOrder] = useState(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const sixMonthsAgo = format(subMonths(new Date(), 5), 'yyyy-MM')

    const [
      habitsRes, habitLogsRes, moodRes, workoutRes, tasksRes, goalsRes,
      ideasRes, batchesRes, incomeRes, fixedRes, variableRes, budgetsRes, layoutRes,
    ] = await Promise.all([
      supabase.from('habits').select('id,name,emoji,color').eq('user_id', user.id),
      supabase.from('habit_logs').select('habit_id,log_date').eq('user_id', user.id),
      supabase.from('mood_logs').select('mood_score,log_date').eq('user_id', user.id),
      supabase.from('workout_logs').select('log_date,planned').eq('user_id', user.id).eq('planned', false),
      supabase.from('weekly_tasks').select('week_start,area,complete,carried_forward,goal_id').eq('user_id', user.id),
      supabase.from('goals').select('*').eq('user_id', user.id),
      supabase.from('content_ideas').select('title,pillar,status,batch,posted_date,created_at').eq('user_id', user.id),
      supabase.from('content_batches').select('id,name').eq('user_id', user.id),
      supabase.from('income_sources').select('amount,frequency,is_self_employed').eq('user_id', user.id),
      supabase.from('fixed_expenses').select('amount').eq('user_id', user.id),
      supabase.from('variable_expenses').select('amount,category,date').eq('user_id', user.id).gte('date', `${sixMonthsAgo}-01`),
      supabase.from('budgets').select('*').eq('user_id', user.id).gte('month_year', sixMonthsAgo),
      supabase.from('dashboard_layout').select('card_order').eq('user_id', user.id).eq('view', 'insights').maybeSingle(),
    ])

    setHabits(habitsRes.data || [])
    setHabitLogs(habitLogsRes.data || [])
    setMoodLogs(moodRes.data || [])
    setWorkoutLogs(workoutRes.data || [])
    setWeeklyTasks(tasksRes.data || [])
    setGoals(goalsRes.data || [])
    setContentIdeas(ideasRes.data || [])
    setContentBatches(batchesRes.data || [])
    setIncomeSources(incomeRes.data || [])
    setFixedExpenses(fixedRes.data || [])
    setVariableExpenses(variableRes.data || [])
    setBudgets(budgetsRes.data || [])
    setCardOrder(normalizeOrder(layoutRes.data?.card_order))

    // Goal metrics for metric-tracked goals in the active quarter
    const currentQuarter = getQuarterFromDate(new Date())
    const currentYear = new Date().getFullYear()
    const metricGoalIds = (goalsRes.data || [])
      .filter(g => g.tracking_type === 'metric' && g.quarter === currentQuarter && g.year === currentYear)
      .map(g => g.id)
    if (metricGoalIds.length) {
      const { data } = await supabase.from('goal_metrics').select('goal_id,value,recorded_at').in('goal_id', metricGoalIds).order('recorded_at', { ascending: false })
      setGoalMetrics(data || [])
    } else {
      setGoalMetrics([])
    }

    setLoading(false)
  }

  // Card layout persistence
  async function saveCardOrder(newOrder) {
    setCardOrder(newOrder)
    await supabase.from('dashboard_layout').upsert(
      { user_id: user.id, view: 'insights', card_order: newOrder },
      { onConflict: 'user_id,view' }
    )
  }
  function resizeCard(id, size) { saveCardOrder(normalizeOrder(cardOrder).map(c => c.id === id ? { ...c, size } : c)) }
  function removeCard(id) { saveCardOrder(normalizeOrder(cardOrder).filter(c => c.id !== id)) }
  function addCard(id) { saveCardOrder([...normalizeOrder(cardOrder), { id, size: 'wide' }]) }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading insights…</div>

  // ── Date range ─────────────────────────────────────────────────────────────
  // Trailing window (ending at the period currently being viewed) used for trend charts and range stats
  const { start: rangeStart, end: rangeEnd } = getTrailingBounds(refDate, activeView)
  const rangeStartStr = format(rangeStart, 'yyyy-MM-dd')
  const rangeEndStr   = format(rangeEnd, 'yyyy-MM-dd')
  const rangeDayStrs  = eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map(d => format(d, 'yyyy-MM-dd'))
  const buckets = getBuckets(rangeStart, rangeEnd, activeView)

  // ── Mood ───────────────────────────────────────────────────────────────────
  const moodInRange = moodLogs.filter(m => m.log_date >= rangeStartStr && m.log_date <= rangeEndStr).sort((a, b) => a.log_date.localeCompare(b.log_date))
  const moodTrendData = buckets.map(b => {
    const vals = moodInRange.filter(m => m.log_date >= b.startStr && m.log_date <= b.endStr).map(m => m.mood_score)
    return { date: b.label, mood: vals.length ? vals.reduce((a, c) => a + c, 0) / vals.length : null }
  }).filter(d => d.mood !== null)

  const dowMap = {}
  moodInRange.forEach(m => { const dow = parseISO(m.log_date).getDay(); (dowMap[dow] ||= []).push(m.mood_score) })
  const moodByDowData = DAY_NAMES.map((name, i) => ({ day: name, avg: dowMap[i]?.length ? dowMap[i].reduce((a, b) => a + b, 0) / dowMap[i].length : 0 }))

  const workoutDates = new Set(workoutLogs.filter(w => w.log_date >= rangeStartStr && w.log_date <= rangeEndStr).map(w => w.log_date))
  const workoutMoods = moodInRange.filter(m => workoutDates.has(m.log_date)).map(m => m.mood_score)
  const restMoods    = moodInRange.filter(m => !workoutDates.has(m.log_date)).map(m => m.mood_score)
  const moodVsWorkoutData = [
    { label: 'Workout days', avg: workoutMoods.length ? workoutMoods.reduce((a, b) => a + b, 0) / workoutMoods.length : 0, count: workoutMoods.length },
    { label: 'Rest days', avg: restMoods.length ? restMoods.reduce((a, b) => a + b, 0) / restMoods.length : 0, count: restMoods.length },
  ]

  // ── Habits ─────────────────────────────────────────────────────────────────
  const habitCompletionData = habits.map(h => {
    const count = habitLogs.filter(l => l.habit_id === h.id && rangeDayStrs.includes(l.log_date)).length
    return { name: `${h.emoji || ''} ${h.name}`.trim(), rate: rangeDayStrs.length ? Math.round((count / rangeDayStrs.length) * 100) : 0 }
  })

  const habitBestDayData = habits.map(h => ({
    name: h.name, emoji: h.emoji,
    best: bestDayOfWeek(habitLogs.filter(l => l.habit_id === h.id && rangeDayStrs.includes(l.log_date)).map(l => l.log_date)),
  }))

  const habitStreakData = habits.map(h => ({
    name: h.name, emoji: h.emoji,
    streak: longestStreak(habitLogs.filter(l => l.habit_id === h.id).map(l => l.log_date)),
  })).sort((a, b) => b.streak - a.streak)

  const thisMonthStr = format(refDate, 'yyyy-MM')
  const lastMonthDate = subMonths(refDate, 1)
  const lastMonthStr = format(lastMonthDate, 'yyyy-MM')
  const daysInThisMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate()
  const daysInLastMonth = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0).getDate()
  const habitMomData = habits.map(h => {
    const logs = habitLogs.filter(l => l.habit_id === h.id)
    const thisCount = logs.filter(l => l.log_date.startsWith(thisMonthStr)).length
    const lastCount = logs.filter(l => l.log_date.startsWith(lastMonthStr)).length
    return {
      name: `${h.emoji || ''} ${h.name}`.trim(),
      'This month': Math.round((thisCount / daysInThisMonth) * 100),
      'Last month': Math.round((lastCount / daysInLastMonth) * 100),
    }
  })

  // ── Tasks & goals ──────────────────────────────────────────────────────────
  const weeksInRange = [...new Set(weeklyTasks.filter(t => t.week_start >= rangeStartStr && t.week_start <= rangeEndStr).map(t => t.week_start))].sort()
  const tasksWeeklyData = weeksInRange.map(ws => {
    const weekTasks = weeklyTasks.filter(t => t.week_start === ws)
    return { week: format(parseISO(ws), 'd MMM'), Created: weekTasks.length, Completed: weekTasks.filter(t => t.complete).length }
  })
  const carryForwardData = weeksInRange.map(ws => {
    const weekTasks = weeklyTasks.filter(t => t.week_start === ws)
    return { week: format(parseISO(ws), 'd MMM'), rate: weekTasks.length ? Math.round((weekTasks.filter(t => t.carried_forward).length / weekTasks.length) * 100) : 0 }
  })

  const currentQuarter = getQuarterFromDate(new Date())
  const currentYear = new Date().getFullYear()
  const activeGoals = goals.filter(g => g.quarter === currentQuarter && g.year === currentYear)
  const qStartMonth = { Q1: 0, Q2: 3, Q3: 6, Q4: 9 }[currentQuarter]
  const qStart = new Date(currentYear, qStartMonth, 1)
  const qEnd   = new Date(currentYear, qStartMonth + 3, 0)
  const totalQDays = differenceInCalendarDays(qEnd, qStart) + 1
  const elapsedDays = Math.min(totalQDays, Math.max(0, differenceInCalendarDays(new Date(), qStart) + 1))
  const elapsedPct = (elapsedDays / totalQDays) * 100

  const goalVelocityData = activeGoals.map(g => {
    let progressPct
    if (g.tracking_type === 'metric') {
      const latest = goalMetrics.find(m => m.goal_id === g.id)
      const cur = latest ? latest.value : (g.metric_start ?? 0)
      const range = (g.metric_target ?? 0) - (g.metric_start ?? 0)
      progressPct = range !== 0 ? Math.max(0, Math.min(100, ((cur - (g.metric_start ?? 0)) / range) * 100)) : 0
    } else {
      const linked = weeklyTasks.filter(t => t.goal_id === g.id)
      progressPct = linked.length ? (linked.filter(t => t.complete).length / linked.length) * 100 : 0
    }
    const diff = progressPct - elapsedPct
    const status = diff >= -5 ? 'On track' : diff >= -20 ? 'At risk' : 'Behind'
    return { id: g.id, name: g.primary_goal, category: g.category, progressPct: Math.round(progressPct), status }
  })

  const areaStats = {}
  weeklyTasks.filter(t => t.week_start >= rangeStartStr && t.week_start <= rangeEndStr).forEach(t => {
    areaStats[t.area] ||= { total: 0, done: 0 }
    areaStats[t.area].total++
    if (t.complete) areaStats[t.area].done++
  })
  const areaData = Object.entries(areaStats).map(([area, s]) => ({ area, rate: Math.round((s.done / s.total) * 100), total: s.total }))
  const topArea = areaData.length ? areaData.reduce((a, b) => (b.rate > a.rate ? b : a)) : null

  // ── Content ────────────────────────────────────────────────────────────────
  const statusCounts = {}
  contentIdeas.forEach(i => { const key = i.status || 'Idea'; statusCounts[key] = (statusCounts[key] || 0) + 1 })
  const contentStatusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }))

  const pillarCounts = {}
  contentIdeas.forEach(i => { if (i.pillar) pillarCounts[i.pillar] = (pillarCounts[i.pillar] || 0) + 1 })
  const contentPillarData = Object.entries(pillarCounts).map(([name, value]) => ({ name, value }))

  const batchCompletionData = contentBatches.map(b => {
    const ideas = contentIdeas.filter(i => i.batch === b.name)
    const posted = ideas.filter(i => i.status === 'Posted').length
    return { name: b.name, pct: ideas.length ? Math.round((posted / ideas.length) * 100) : 0, total: ideas.length, posted }
  })

  const postedWithDates = contentIdeas.filter(i => i.status === 'Posted' && i.posted_date && i.created_at)
  const avgDaysToPost = postedWithDates.length
    ? Math.round(postedWithDates.reduce((s, i) => s + differenceInCalendarDays(parseISO(i.posted_date), parseISO(i.created_at.slice(0, 10))), 0) / postedWithDates.length)
    : null

  const lastPosted = contentIdeas.filter(i => i.status === 'Posted' && i.posted_date).sort((a, b) => b.posted_date.localeCompare(a.posted_date))[0] || null

  // ── Finance ────────────────────────────────────────────────────────────────
  const DAYS_PER_MONTH = 30.44
  const bucketDays = (b) => differenceInCalendarDays(parseISO(b.endStr), parseISO(b.startStr)) + 1

  const spendByCategoryData = buckets.map(b => {
    const row = { month: b.label }
    VARIABLE_CATS.forEach(cat => {
      row[cat] = variableExpenses.filter(v => v.date >= b.startStr && v.date <= b.endStr && v.category === cat).reduce((s, v) => s + v.amount, 0)
    })
    return row
  })

  const totalIncomeMonthly = incomeSources.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0)
  const incomeTrendData = buckets.map(b => ({ month: b.label, income: Math.round(totalIncomeMonthly * bucketDays(b) / DAYS_PER_MONTH) }))

  const selfEmpIncome = incomeSources.filter(i => i.is_self_employed).reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0)
  const monthlyTaxPot = selfEmpIncome * 0.25
  const taxPotData = buckets.reduce((acc, b) => {
    const cumulative = (acc.length ? acc[acc.length - 1].taxPot : 0) + monthlyTaxPot * bucketDays(b) / DAYS_PER_MONTH
    acc.push({ month: b.label, taxPot: Math.round(cumulative) })
    return acc
  }, [])

  const totalFixedMonthly = fixedExpenses.reduce((s, f) => s + f.amount, 0)
  const savingsRateData = buckets.map(b => {
    const days = bucketDays(b)
    const varSpend = variableExpenses.filter(v => v.date >= b.startStr && v.date <= b.endStr).reduce((s, v) => s + v.amount, 0)
    const incomeForBucket = totalIncomeMonthly * days / DAYS_PER_MONTH
    const fixedForBucket = totalFixedMonthly * days / DAYS_PER_MONTH
    const rate = incomeForBucket > 0 ? Math.round(((incomeForBucket - fixedForBucket - varSpend) / incomeForBucket) * 100) : 0
    return { month: b.label, rate }
  })

  const budgetAdherenceData = activeView === 'monthly' ? buckets.map(b => {
    const monthBudgets = budgets.filter(bu => bu.month_year === b.key && bu.category !== null)
    if (!monthBudgets.length) return { month: b.label, pct: 0, noData: true }
    let within = 0
    monthBudgets.forEach(bu => {
      const spend = variableExpenses.filter(v => v.date.startsWith(b.key) && v.category === bu.category).reduce((s, v) => s + v.amount, 0)
      if (spend <= bu.amount) within++
    })
    return { month: b.label, pct: Math.round((within / monthBudgets.length) * 100) }
  }) : []
  const hasBudgetAdherenceData = budgetAdherenceData.some(d => !d.noData)

  // ── Card content ──────────────────────────────────────────────────────────
  const order = normalizeOrder(cardOrder)
  const available = Object.entries(CARD_LABELS)
    .filter(([id]) => !order.some(o => o.id === id))
    .map(([id, label]) => ({ id, label }))

  const CARDS = {
    'mood-trend': (
      <div className="card card-personal">
        <h3 className="mb-4">Mood trend</h3>
        {moodTrendData.length < 2 ? <Empty>Log your mood daily to see trends appear here.</Empty> : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={moodTrendData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="mood" stroke={ROSE} strokeWidth={2.5} dot={{ fill: ROSE, r: 3, strokeWidth: 0 }} name="Mood" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    ),

    'mood-by-dow': (
      <div className="card card-personal">
        <h3 className="mb-4">Mood by day of week</h3>
        {moodByDowData.every(d => d.avg === 0) ? <Empty>Not enough data yet.</Empty> : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={moodByDowData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avg" name="Avg mood" fill={ROSE} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    ),

    'mood-vs-workout': (
      <div className="card card-personal">
        <h3 className="mb-4">Mood vs workout days</h3>
        {workoutMoods.length === 0 && restMoods.length === 0 ? <Empty>Not enough mood/workout data yet.</Empty> : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={moodVsWorkoutData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avg" name="Avg mood" fill={ROSE} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    ),

    'habit-completion': (
      <div className="card card-personal">
        <h3 className="mb-4">Habit completion rate</h3>
        {habits.length === 0 ? <Empty>No habits tracked yet.</Empty> : (
          <ResponsiveContainer width="100%" height={Math.max(180, habits.length * 36)}>
            <BarChart data={habitCompletionData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'var(--text-2)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="rate" name="Completion %" fill={ROSE} radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    ),

    'habit-best-day': (
      <div className="card card-personal">
        <h3 className="mb-4">Best day per habit</h3>
        {habits.length === 0 ? <Empty>No habits tracked yet.</Empty> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {habitBestDayData.map(h => (
              <div key={h.name} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                <span>{h.emoji} {h.name}</span>
                <span className="mono" style={{ color: h.best ? ROSE : 'var(--text-3)' }}>{h.best || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    ),

    'habit-streaks': (
      <div className="card card-personal">
        <h3 className="mb-4">Longest streaks ever</h3>
        {habits.length === 0 ? <Empty>No habits tracked yet.</Empty> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {habitStreakData.map(h => (
              <div key={h.name} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                <span>{h.emoji} {h.name}</span>
                <span className="mono" style={{ color: ROSE, fontWeight: 600 }}>{h.streak} day{h.streak === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    ),

    'habit-mom': (
      <div className="card card-personal">
        <h3 className="mb-4">Month-on-month habit completion</h3>
        {habits.length === 0 ? <Empty>No habits tracked yet.</Empty> : (
          <ResponsiveContainer width="100%" height={Math.max(180, habits.length * 40)}>
            <BarChart data={habitMomData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'var(--text-2)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Last month" fill="var(--bg-3)" radius={[0, 5, 5, 0]} />
              <Bar dataKey="This month" fill={ROSE} radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    ),

    'tasks-weekly': (
      <div className="card card-career">
        <h3 className="mb-4">Tasks created vs completed</h3>
        {tasksWeeklyData.length === 0 ? <Empty>No weekly tasks in this range.</Empty> : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={tasksWeeklyData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Created" stroke="var(--text-3)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Completed" stroke={COBALT} strokeWidth={2.5} dot={{ fill: COBALT, r: 3, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    ),

    'carry-forward': (
      <div className="card card-career">
        <h3 className="mb-4">Carry-forward rate</h3>
        {carryForwardData.length === 0 ? <Empty>No weekly tasks in this range.</Empty> : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={carryForwardData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="rate" name="Carry-forward %" stroke={COBALT} strokeWidth={2.5} dot={{ fill: COBALT, r: 3, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    ),

    'goal-velocity': (
      <div className="card card-career">
        <div className="flex items-center justify-between mb-4">
          <h3>Goal progress velocity</h3>
          <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{currentQuarter} {currentYear} · {Math.round(elapsedPct)}% elapsed</p>
        </div>
        {goalVelocityData.length === 0 ? (
          <Empty>No quarterly goals set for {currentQuarter} {currentYear}. <Link to="/goals" style={{ color: COBALT }}>Add some →</Link></Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {goalVelocityData.map(g => (
              <div key={g.id} className="flex items-center justify-between gap-3">
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</p>
                  <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{g.category} · {g.progressPct}% done</p>
                </div>
                <span className={`badge ${g.status === 'On track' ? 'badge-success' : g.status === 'At risk' ? 'badge-warning' : 'badge-danger'}`}>{g.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    ),

    'productive-area': (
      <div className="card card-career">
        <h3 className="mb-4">Most productive area</h3>
        {areaData.length === 0 ? <Empty>No tasks logged in this range.</Empty> : (
          <>
            <div style={{ marginBottom: 14 }}>
              <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>Top area</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: COBALT, fontFamily: 'var(--font-serif)' }}>{topArea.area}</p>
              <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{topArea.rate}% completion · {topArea.total} tasks</p>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={areaData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="area" tick={{ fill: 'var(--text-3)', fontSize: 9, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="rate" name="Completion %" fill={COBALT} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    ),

    'content-status': (
      <div className="card card-creative">
        <h3 className="mb-4">Ideas by status</h3>
        {contentStatusData.length === 0 ? <Empty>No content ideas yet.</Empty> : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={contentStatusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {contentStatusData.map((entry, i) => <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    ),

    'content-pillar': (
      <div className="card card-creative">
        <h3 className="mb-4">Ideas by pillar</h3>
        {contentPillarData.length === 0 ? <Empty>No content ideas yet.</Empty> : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={contentPillarData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {contentPillarData.map((entry, i) => <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    ),

    'content-batches': (
      <div className="card card-creative">
        <h3 className="mb-4">Batch completion</h3>
        {batchCompletionData.length === 0 ? <Empty>No content batches yet.</Empty> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 14 }}>
            {batchCompletionData.map(b => (
              <div key={b.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <ArcRing value={b.pct} max={100} size={72} strokeWidth={6} color={GOLD} label={`${b.pct}%`} fontSize={12} />
                <p style={{ fontSize: 11, textAlign: 'center', color: 'var(--text-2)' }}>{b.name}</p>
                <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>{b.posted}/{b.total} posted</p>
              </div>
            ))}
          </div>
        )}
      </div>
    ),

    'content-idea-to-post': (
      <div className="card card-creative" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <h3 className="mb-4" style={{ alignSelf: 'flex-start' }}>Idea → posted time</h3>
        {avgDaysToPost === null ? <Empty>No posted ideas with dates yet.</Empty> : (
          <>
            <p style={{ fontSize: '2.4rem', fontWeight: 700, color: GOLD, fontFamily: 'var(--font-serif)' }}>{avgDaysToPost}</p>
            <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>avg days, idea → posted</p>
          </>
        )}
      </div>
    ),

    'content-last-posted': (
      <div className="card card-creative">
        <h3 className="mb-4">Last posted</h3>
        {lastPosted ? (
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{lastPosted.title}</p>
            <p className="mono" style={{ fontSize: 11, color: GOLD }}>Posted {format(parseISO(lastPosted.posted_date), 'd MMM yyyy')}</p>
          </div>
        ) : (
          <Empty>Nothing posted yet. <Link to="/content?tab=Idea Dump" style={{ color: GOLD }}>Go to Idea Dump →</Link></Empty>
        )}
      </div>
    ),

    'finance-spend-category': (
      <div className="card card-finance">
        <h3 className="mb-4">Spend by category</h3>
        {variableExpenses.length === 0 ? <Empty>No variable expenses logged yet.</Empty> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={spendByCategoryData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={v => `£${v}`} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {VARIABLE_CATS.map((cat, i) => (
                <Bar key={cat} dataKey={cat} stackId="spend" fill={PIE_COLORS[i % PIE_COLORS.length]} radius={i === VARIABLE_CATS.length - 1 ? [4, 4, 0, 0] : 0} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    ),

    'finance-income-trend': (
      <div className="card card-finance">
        <h3 className="mb-4">Income trend</h3>
        {totalIncomeMonthly === 0 ? <Empty>Add income sources to see this chart.</Empty> : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={incomeTrendData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={v => `£${v}`} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="income" name="Income/mo" stroke={EMERALD} strokeWidth={2.5} dot={{ fill: EMERALD, r: 3, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    ),

    'finance-tax-pot': (
      <div className="card card-finance">
        <h3 className="mb-4">Tax pot growth</h3>
        {monthlyTaxPot === 0 ? <Empty>No self-employed income set — tax pot doesn't apply.</Empty> : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={taxPotData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={v => `£${v}`} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="taxPot" name="Tax pot" stroke="var(--creative)" strokeWidth={2.5} dot={{ fill: 'var(--creative)', r: 3, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    ),

    'finance-savings-rate': (
      <div className="card card-finance">
        <h3 className="mb-4">Savings rate</h3>
        {totalIncomeMonthly === 0 ? <Empty>Add income sources to see this chart.</Empty> : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={savingsRateData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={v => `${v}%`} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="rate" name="Savings rate" stroke={EMERALD} strokeWidth={2.5} dot={{ fill: EMERALD, r: 3, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    ),

    'finance-budget-adherence': (
      <div className="card card-finance">
        <h3 className="mb-4">Budget adherence</h3>
        {activeView !== 'monthly' ? (
          <Empty>Budget adherence is tracked monthly — switch to Monthly to see this chart.</Empty>
        ) : !hasBudgetAdherenceData ? (
          <Empty>Set category budgets on the Finance page to track adherence over time.</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={budgetAdherenceData}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pct" name="% categories within budget" fill={EMERALD} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    ),
  }

  return (
    <div>
      <div className="page-header header-career mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>Insights</h1>
            <p>Patterns across habits, tasks, mood, content, and finances</p>
          </div>
          <button
            className={`btn btn-sm ${editing ? 'btn-career' : 'btn-ghost'}`}
            style={editing ? { color: '#fff' } : {}}
            onClick={() => setEditing(v => !v)}
          >
            {editing ? <><CheckIcon size={13} /> Done</> : <><Pencil size={13} /> Edit layout</>}
          </button>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--career)' }}><InsightsDecoration /></div>
      </div>

      {/* Period view switcher + navigation */}
      <div className="mb-6">
        <PeriodNav activeView={activeView} onViewChange={setActiveView} refDate={refDate} onRefDateChange={setRefDate} accentColor="var(--career)" />
      </div>

      {editing && (
        <div className="mb-4">
          <AddWidgetMenu available={available} onAdd={addCard} />
        </div>
      )}
      <DraggableCardList cardOrder={order} onReorder={saveCardOrder}>
        {order.map(({ id, size }) => (
          <SortableCard
            key={id}
            id={id}
            size={size}
            editing={editing}
            onResize={s => resizeCard(id, s)}
            onRemove={() => removeCard(id)}
          >
            {CARDS[id] || null}
          </SortableCard>
        ))}
      </DraggableCardList>
    </div>
  )
}
