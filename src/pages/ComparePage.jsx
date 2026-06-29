import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { format, startOfWeek, addWeeks, addDays } from 'date-fns'
import { ArrowLeft, MessageSquare, Send, Flame, Target, CheckSquare, ListTodo, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import ArcRing from '../components/ui/ArcRing'
import GoalCard from '../components/goals/GoalCard'
import { getCurrentQuarter, AREA_COLORS, QUARTERS } from '../lib/constants'
import { simulateHabit } from '../lib/habitUtils'

const today = format(new Date(), 'yyyy-MM-dd')
const currentQuarter = getCurrentQuarter()
const currentYear = new Date().getFullYear()

function momentumScore(habits, habitLogs, weekTasks, moodLogs) {
  const logSet = new Map()
  habitLogs.forEach(l => {
    if (!logSet.has(l.habit_id)) logSet.set(l.habit_id, new Set())
    logSet.get(l.habit_id).add(l.log_date)
  })
  const totalHabits = habits.length
  const doneHabits = habits.filter(h => {
    const s = logSet.get(h.id) || new Set()
    const { pending } = simulateHabit(h, s, today)
    return !pending
  }).length
  const habitScore = totalHabits ? (doneHabits / totalHabits) * 40 : 0

  const totalTasks = weekTasks.length
  const doneTasks = weekTasks.filter(t => t.complete).length
  const taskScore = totalTasks ? (doneTasks / totalTasks) * 40 : 0

  const moodAvg = moodLogs.length ? moodLogs.reduce((s, m) => s + m.mood_score, 0) / moodLogs.length : null
  const moodScore = moodAvg ? (moodAvg / 5) * 20 : 0

  return Math.round(habitScore + taskScore + moodScore)
}

function NudgeButton({ onSend, label = 'Nudge' }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    if (!text.trim()) return
    setSending(true)
    await onSend(text.trim())
    setText('')
    setOpen(false)
    setSending(false)
  }

  if (!open) {
    return (
      <button
        className="btn btn-ghost btn-xs"
        onClick={() => setOpen(true)}
        title="Send a nudge to your partner"
        style={{ fontSize: 10, padding: '2px 6px' }}
      >
        <MessageSquare size={11} /> {label}
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1" style={{ marginTop: 4 }}>
      <input
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') send(); if (e.key === 'Escape') setOpen(false) }}
        placeholder="Write a nudge…"
        style={{ fontSize: 11, flex: 1, padding: '3px 6px' }}
      />
      <button className="btn btn-xs btn-career" style={{ color: '#fff' }} onClick={send} disabled={sending} title="Send nudge">
        <Send size={11} />
      </button>
      <button className="btn btn-xs btn-ghost" onClick={() => setOpen(false)} title="Cancel">✕</button>
    </div>
  )
}

function MiniNav({ label, onPrev, onNext, onToday, isCurrent }) {
  return (
    <div className="flex items-center gap-2">
      <button className="btn-icon btn btn-sm" onClick={onPrev} title="Previous"><ChevronLeft size={13} /></button>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', minWidth: 90, textAlign: 'center' }}>{label}</span>
      <button className="btn-icon btn btn-sm" onClick={onNext} title="Next"><ChevronRight size={13} /></button>
      {!isCurrent && onToday && (
        <button className="btn btn-xs btn-ghost" onClick={onToday}>Now</button>
      )}
    </div>
  )
}

function milestoneCredit(m, milestoneTasks) {
  if (m.complete) return 1
  const tasks = milestoneTasks.filter(t => t.milestone_id === m.id)
  return tasks.length ? tasks.filter(t => t.complete).length / tasks.length : 0
}

function computeProgress(goal, goals, milestones, milestoneTasks) {
  if (goal.tracking_type === 'metric') {
    const target = Number(goal.metric_target ?? 0)
    const current = Number(goal.metric_current ?? 0)
    const pct = target > 0 ? Math.round((current / target) * 100) : 0
    return { pct, done: 0, total: 0 }
  }
  if (goal.tracking_type === 'theme') {
    const subGoals = goals.filter(g => g.parent_goal_id === goal.id)
    const done = subGoals.filter(g => computeProgress(g, goals, milestones, milestoneTasks).pct >= 100).length
    return { pct: 0, done, total: subGoals.length }
  }
  const ms = milestones.filter(m => m.goal_id === goal.id)
  const done = ms.filter(m => m.complete).length
  const pct = ms.length ? Math.round((ms.reduce((s, m) => s + milestoneCredit(m, milestoneTasks), 0) / ms.length) * 100) : 0
  return { pct, done, total: ms.length }
}

function milestonesFor(goalId, milestones, milestoneTasks) {
  return milestones.filter(m => m.goal_id === goalId).map(m => ({
    ...m,
    tasks: milestoneTasks.filter(t => t.milestone_id === m.id),
  }))
}

function CompareColumn({
  name, data, onNudge, isSelf,
  weekStart, onWeekShift, onWeekToday, isCurrentWeek,
  todoDate, onTodoShift, onTodoToday, isCurrentTodoDate,
  goalQuarter, goalYear, onGoalPeriodShift, onGoalPeriodToday, isCurrentGoalPeriod,
}) {
  if (!data) return <div className="card" style={{ flex: 1 }}><p className="text-dim" style={{ fontSize: 12 }}>Loading…</p></div>

  const { goals, weekTasks, habits, habitLogs, moodLogs, todos, milestones, milestoneTasks } = data
  const periodGoals = goals.filter(g => g.quarter === goalQuarter && g.year === goalYear)
  const weekDone = weekTasks.filter(t => t.complete).length
  const weekPct = weekTasks.length ? Math.round((weekDone / weekTasks.length) * 100) : 0
  const momentum = momentumScore(habits, habitLogs, weekTasks, moodLogs)

  const logSetMap = new Map()
  habitLogs.forEach(l => {
    if (!logSetMap.has(l.habit_id)) logSetMap.set(l.habit_id, new Set())
    logSetMap.get(l.habit_id).add(l.log_date)
  })

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div className="card" style={{ textAlign: 'center', paddingTop: 20, paddingBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{name}</p>
        <p style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{isSelf ? 'You' : 'Partner'}</p>
        <div style={{ marginTop: 12 }}>
          <ArcRing value={momentum} max={100} size={64} strokeWidth={6} color="var(--career)" label={`${momentum}`} sublabel="momentum" fontSize={11} />
        </div>
      </div>

      {/* Weekly Tasks */}
      <div className="card">
        <div className="flex items-center justify-between mb-3 wrap" style={{ gap: 8 }}>
          <div className="flex items-center gap-2">
            <CheckSquare size={14} color="var(--career)" />
            <p style={{ fontSize: 12, fontWeight: 600 }}>Weekly tasks</p>
          </div>
          <MiniNav label={format(new Date(weekStart), 'd MMM')} onPrev={() => onWeekShift(-1)} onNext={() => onWeekShift(1)} onToday={onWeekToday} isCurrent={isCurrentWeek} />
        </div>
        <div className="flex items-center gap-3 mb-3">
          <ArcRing value={weekPct} max={100} size={52} strokeWidth={5} color="var(--career)" label={`${weekPct}%`} fontSize={10} />
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{weekDone} of {weekTasks.length} done that week</p>
        </div>
        {weekTasks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
            {weekTasks.map(t => (
              <div key={t.id}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 11, flex: 1, color: t.complete ? 'var(--text-3)' : 'var(--text-2)', textDecoration: t.complete ? 'line-through' : 'none' }}>
                    {t.specific_task}
                  </span>
                  {t.complete && <span className="badge badge-success" style={{ fontSize: 9 }}>✓</span>}
                </div>
                {!isSelf && <NudgeButton onSend={msg => onNudge(msg, t.id)} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily Todos */}
      <div className="card">
        <div className="flex items-center justify-between mb-3 wrap" style={{ gap: 8 }}>
          <div className="flex items-center gap-2">
            <ListTodo size={14} color="var(--personal)" />
            <p style={{ fontSize: 12, fontWeight: 600 }}>To-dos</p>
          </div>
          <MiniNav label={format(new Date(todoDate), 'd MMM')} onPrev={() => onTodoShift(-1)} onNext={() => onTodoShift(1)} onToday={onTodoToday} isCurrent={isCurrentTodoDate} />
        </div>
        {todos.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>No to-dos for this day.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
            {todos.map(t => (
              <div key={t.id}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 13 }}>{t.complete ? '✅' : '⬜'}</span>
                  <span style={{ fontSize: 11, flex: 1, color: t.complete ? 'var(--text-3)' : 'var(--text-2)', textDecoration: t.complete ? 'line-through' : 'none' }}>
                    {t.text}
                  </span>
                </div>
                {!isSelf && <NudgeButton onSend={msg => onNudge(msg, null)} label="Nudge on to-do" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Goals */}
      <div className="card">
        <div className="flex items-center justify-between mb-3 wrap" style={{ gap: 8 }}>
          <div className="flex items-center gap-2">
            <Target size={14} color="var(--creative)" />
            <p style={{ fontSize: 12, fontWeight: 600 }}>{goalQuarter} {goalYear} goals</p>
          </div>
          <MiniNav label={`${goalQuarter} ${goalYear}`} onPrev={() => onGoalPeriodShift(-1)} onNext={() => onGoalPeriodShift(1)} onToday={onGoalPeriodToday} isCurrent={isCurrentGoalPeriod} />
        </div>
        {periodGoals.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>No goals this period.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {periodGoals.map(g => {
              const color = AREA_COLORS[g.category] || 'var(--career)'
              return (
                <div key={g.id}>
                  <GoalCard
                    goal={g}
                    color={color}
                    progress={computeProgress(g, goals, milestones, milestoneTasks)}
                    milestones={milestonesFor(g.id, milestones, milestoneTasks)}
                    subGoals={g.tracking_type === 'theme' ? goals.filter(sg => sg.parent_goal_id === g.id).map(sg => ({ ...sg, pct: computeProgress(sg, goals, milestones, milestoneTasks).pct })) : []}
                    parentGoal={goals.find(p => p.id === g.parent_goal_id)}
                    readOnly
                  />
                  {!isSelf && <NudgeButton onSend={msg => onNudge(msg, null)} label="Nudge on goal" />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Habits */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Flame size={14} color="var(--wellness)" />
          <p style={{ fontSize: 12, fontWeight: 600 }}>Habits</p>
        </div>
        {habits.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>No habits tracked.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {habits.map(h => {
              const logSet = logSetMap.get(h.id) || new Set()
              const { streak } = simulateHabit(h, logSet, today)
              return (
                <div key={h.id}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 18 }}>{streak > 0 ? '🔥' : '○'}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12 }}>{h.name}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{streak} day streak</p>
                    </div>
                  </div>
                  {!isSelf && <NudgeButton onSend={msg => onNudge(msg, null)} label="Nudge on habit" />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ComparePage() {
  const { partnerId } = useParams()
  const { user } = useAuth()
  const [selfData, setSelfData] = useState(null)
  const [partnerData, setPartnerData] = useState(null)
  const [partnerName, setPartnerName] = useState('Partner')
  const [loading, setLoading] = useState(true)
  const [nudgeSent, setNudgeSent] = useState(false)

  // Shared navigation state — applies to both columns so the comparison stays apples-to-apples.
  const [weekRef, setWeekRef] = useState(new Date())
  const [todoDate, setTodoDate] = useState(new Date())
  const [goalQuarter, setGoalQuarter] = useState(currentQuarter)
  const [goalYear, setGoalYear] = useState(currentYear)

  const weekStartStr = format(startOfWeek(weekRef, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const todoDateStr = format(todoDate, 'yyyy-MM-dd')
  const isCurrentWeek = weekStartStr === format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const isCurrentTodoDate = todoDateStr === today
  const isCurrentGoalPeriod = goalQuarter === currentQuarter && goalYear === currentYear

  function shiftWeek(dir) { setWeekRef(d => addWeeks(d, dir)) }
  function shiftTodoDate(dir) { setTodoDate(d => addDays(d, dir)) }
  function shiftGoalPeriod(dir) {
    const idx = QUARTERS.indexOf(goalQuarter)
    let newIdx = idx + dir
    let newYear = goalYear
    if (newIdx < 0) { newIdx = QUARTERS.length - 1; newYear -= 1 }
    if (newIdx >= QUARTERS.length) { newIdx = 0; newYear += 1 }
    setGoalQuarter(QUARTERS[newIdx])
    setGoalYear(newYear)
  }

  async function loadForUser(uid) {
    const [goalsRes, weekTasksRes, habitsRes, habitLogsRes, moodRes, todosRes, milestonesRes, milestoneTasksRes] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', uid),
      supabase.from('weekly_tasks').select('*').eq('user_id', uid).eq('week_start', weekStartStr),
      supabase.from('habits').select('*').eq('user_id', uid),
      supabase.from('habit_logs').select('*').eq('user_id', uid),
      supabase.from('mood_logs').select('*').eq('user_id', uid).gte('date', weekStartStr),
      supabase.from('daily_todos').select('*').eq('user_id', uid).eq('date', todoDateStr).eq('archived', false).order('sort_order'),
      supabase.from('milestones').select('*').eq('user_id', uid),
      supabase.from('milestone_tasks').select('*').eq('user_id', uid),
    ])
    return {
      goals: goalsRes.data || [],
      weekTasks: weekTasksRes.data || [],
      habits: habitsRes.data || [],
      habitLogs: habitLogsRes.data || [],
      moodLogs: moodRes.data || [],
      todos: todosRes.data || [],
      milestones: milestonesRes.data || [],
      milestoneTasks: milestoneTasksRes.data || [],
    }
  }

  async function loadAll() {
    setLoading(true)
    const [selfResult, partnerResult, profileResult] = await Promise.all([
      loadForUser(user.id),
      loadForUser(partnerId),
      supabase.from('profiles').select('display_name, email').eq('id', partnerId).maybeSingle(),
    ])
    setSelfData(selfResult)
    setPartnerData(partnerResult)
    const p = profileResult.data
    if (p) setPartnerName(p.display_name || p.email?.split('@')[0] || 'Partner')
    setLoading(false)
  }

  useEffect(() => {
    if (user && partnerId) loadAll() // eslint-disable-line react-hooks/set-state-in-effect
  }, [user, partnerId, weekStartStr, todoDateStr]) // eslint-disable-line react-hooks/exhaustive-deps

  async function sendNudge(content, taskId) {
    await supabase.from('comments').insert({
      user_id: user.id,
      task_id: taskId || null,
      partner_id: partnerId,
      content,
    })
    setNudgeSent(true)
    setTimeout(() => setNudgeSent(false), 2000)
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3 mb-1">
          <Link to="/partners" style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <ArrowLeft size={14} /> Partners
          </Link>
        </div>
        <h1>Compare</h1>
        <p>You vs {partnerName} — navigate weeks, days and quarters independently of "now"</p>
        {nudgeSent && (
          <span style={{ fontSize: 11, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>Nudge sent!</span>
        )}
      </div>

      {loading ? (
        <p className="text-dim" style={{ padding: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <CompareColumn
            name="You"
            data={selfData}
            onNudge={() => {}}
            isSelf={true}
            weekStart={weekStartStr} onWeekShift={shiftWeek} onWeekToday={() => setWeekRef(new Date())} isCurrentWeek={isCurrentWeek}
            todoDate={todoDateStr} onTodoShift={shiftTodoDate} onTodoToday={() => setTodoDate(new Date())} isCurrentTodoDate={isCurrentTodoDate}
            goalQuarter={goalQuarter} goalYear={goalYear} onGoalPeriodShift={shiftGoalPeriod} onGoalPeriodToday={() => { setGoalQuarter(currentQuarter); setGoalYear(currentYear) }} isCurrentGoalPeriod={isCurrentGoalPeriod}
          />
          <CompareColumn
            name={partnerName}
            data={partnerData}
            onNudge={sendNudge}
            isSelf={false}
            weekStart={weekStartStr} onWeekShift={shiftWeek} onWeekToday={() => setWeekRef(new Date())} isCurrentWeek={isCurrentWeek}
            todoDate={todoDateStr} onTodoShift={shiftTodoDate} onTodoToday={() => setTodoDate(new Date())} isCurrentTodoDate={isCurrentTodoDate}
            goalQuarter={goalQuarter} goalYear={goalYear} onGoalPeriodShift={shiftGoalPeriod} onGoalPeriodToday={() => { setGoalQuarter(currentQuarter); setGoalYear(currentYear) }} isCurrentGoalPeriod={isCurrentGoalPeriod}
          />
        </div>
      )}
    </div>
  )
}
