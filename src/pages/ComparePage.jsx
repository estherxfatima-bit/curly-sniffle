import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { format, startOfWeek } from 'date-fns'
import { ArrowLeft, MessageSquare, Send, Flame, Target, CheckSquare, ListTodo } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import ArcRing from '../components/ui/ArcRing'
import { getCurrentQuarter, AREA_COLORS } from '../lib/constants'
import { simulateHabit } from '../lib/habitUtils'

const today = format(new Date(), 'yyyy-MM-dd')
const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
const currentQuarter = getCurrentQuarter()
const currentYear = new Date().getFullYear()

function goalProgress(goal, metrics, weeklyTasks) {
  if (goal.tracking_type === 'metric') {
    const history = metrics.filter(m => m.goal_id === goal.id)
    const start = Number(goal.metric_start ?? 0)
    const target = Number(goal.metric_target ?? 0)
    const current = history.length ? Number(history[history.length - 1].value) : start
    const span = target - start
    const pct = span !== 0 ? Math.round(Math.min(Math.max((current - start) / span, 0), 1) * 100) : 0
    return { pct, label: `${current}/${target}` }
  }
  const linked = weeklyTasks.filter(t => t.goal_id === goal.id)
  const done = linked.filter(t => t.complete).length
  const pct = linked.length ? Math.round((done / linked.length) * 100) : 0
  return { pct, label: `${done}/${linked.length} tasks` }
}

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

function CompareColumn({ name, data, onNudge, isSelf }) {
  if (!data) return <div className="card" style={{ flex: 1 }}><p className="text-dim" style={{ fontSize: 12 }}>Loading…</p></div>

  const { goals, metrics, weekTasks, habits, habitLogs, moodLogs, todos } = data
  const currentGoals = goals.filter(g => g.quarter === currentQuarter && g.year === currentYear)
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
        <div className="flex items-center gap-2 mb-3">
          <CheckSquare size={14} color="var(--career)" />
          <p style={{ fontSize: 12, fontWeight: 600 }}>Weekly tasks</p>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <ArcRing value={weekPct} max={100} size={52} strokeWidth={5} color="var(--career)" label={`${weekPct}%`} fontSize={10} />
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{weekDone} of {weekTasks.length} done this week</p>
        </div>
        {weekTasks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {weekTasks.slice(0, 8).map(t => (
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
        <div className="flex items-center gap-2 mb-3">
          <ListTodo size={14} color="var(--personal)" />
          <p style={{ fontSize: 12, fontWeight: 600 }}>Today's to-dos</p>
        </div>
        {todos.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>No to-dos for today.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} color="var(--creative)" />
          <p style={{ fontSize: 12, fontWeight: 600 }}>{currentQuarter} {currentYear} goals</p>
        </div>
        {currentGoals.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>No goals this quarter.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {currentGoals.map(g => {
              const { pct, label } = goalProgress(g, metrics, weekTasks)
              const color = AREA_COLORS[g.category] || 'var(--career)'
              return (
                <div key={g.id}>
                  <div className="flex items-center gap-3">
                    <ArcRing value={pct} max={100} size={40} strokeWidth={4} color={color} label={`${pct}%`} fontSize={9} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>{g.primary_goal}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{label}</p>
                    </div>
                  </div>
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

  async function loadForUser(uid) {
    const [goalsRes, metricsRes, weekTasksRes, habitsRes, habitLogsRes, moodRes, todosRes] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', uid),
      supabase.from('goal_metrics').select('*').eq('user_id', uid).order('recorded_at'),
      supabase.from('weekly_tasks').select('*').eq('user_id', uid).eq('week_start', weekStart),
      supabase.from('habits').select('*').eq('user_id', uid),
      supabase.from('habit_logs').select('*').eq('user_id', uid),
      supabase.from('mood_logs').select('*').eq('user_id', uid).gte('date', weekStart),
      supabase.from('daily_todos').select('*').eq('user_id', uid).eq('date', today).eq('archived', false).order('sort_order'),
    ])
    return {
      goals: goalsRes.data || [],
      metrics: metricsRes.data || [],
      weekTasks: weekTasksRes.data || [],
      habits: habitsRes.data || [],
      habitLogs: habitLogsRes.data || [],
      moodLogs: moodRes.data || [],
      todos: todosRes.data || [],
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
  }, [user, partnerId]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <p>You vs {partnerName} — {currentQuarter} {currentYear}</p>
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
          />
          <CompareColumn
            name={partnerName}
            data={partnerData}
            onNudge={sendNudge}
            isSelf={false}
          />
        </div>
      )}
    </div>
  )
}
