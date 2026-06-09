import { useState, useEffect, useRef } from 'react'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getCurrentQuarter, getQuarterYear } from '../lib/constants'
import MoodWidget from '../components/dashboard/MoodWidget'
import ArcRing from '../components/ui/ArcRing'
import Confetti from '../components/ui/Confetti'
import { Check, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

function greeting(name, momentum) {
  const h = new Date().getHours()
  const timeGreet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  if (momentum >= 70 && name) {
    // Personalised momentum greeting
    const habitCount = Math.round(momentum * 0.004 * 10) // approximate
    return `Strong week, ${name.split(' ')[0]}`
  }
  return name ? `${timeGreet}, ${name.split(' ')[0]}` : timeGreet
}

// Decorative SVG for career section
function CareerDecoration() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
      <circle cx="80" cy="40" r="36" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
      <circle cx="80" cy="40" r="22" stroke="currentColor" strokeWidth="1" opacity="0.25"/>
      <line x1="20" y1="40" x2="50" y2="40" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
      <line x1="10" y1="28" x2="40" y2="28" stroke="currentColor" strokeWidth="1" opacity="0.25"/>
      <line x1="14" y1="52" x2="44" y2="52" stroke="currentColor" strokeWidth="1" opacity="0.25"/>
    </svg>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [habits, setHabits] = useState([])
  const [weekTasks, setWeekTasks] = useState([])
  const [goals, setGoals] = useState([])
  const [moodAvg, setMoodAvg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confetti, setConfetti] = useState(false)
  const prevMomentum = useRef(0)

  const isFriday = new Date().getDay() === 5
  const today = format(new Date(), 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  useEffect(() => {
    if (user) loadDashboard()
  }, [user])

  async function loadDashboard() {
    setLoading(true)
    const [habitsRes, logsRes, tasksRes, goalsRes, moodRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id),
      supabase.from('habit_logs').select('habit_id').eq('user_id', user.id).eq('log_date', today),
      supabase.from('weekly_tasks').select('*').eq('user_id', user.id).eq('week_start', weekStart),
      supabase.from('goals').select('*').eq('user_id', user.id),
      supabase.from('mood_logs').select('mood_score').eq('user_id', user.id).gte('log_date', weekStart),
    ])

    const habitsData = habitsRes.data || []
    const loggedIds = new Set((logsRes.data || []).map(l => l.habit_id))
    const habitsWithStatus = habitsData.map(h => ({ ...h, done: loggedIds.has(h.id) }))

    const tasks = tasksRes.data || []
    const goalsData = goalsRes.data || []
    const moods = moodRes.data || []
    const avgMood = moods.length ? moods.reduce((s, m) => s + m.mood_score, 0) / moods.length : null

    setHabits(habitsWithStatus)
    setWeekTasks(tasks)
    setGoals(goalsData)
    setMoodAvg(avgMood)
    setLoading(false)
  }

  async function toggleHabit(habit) {
    if (habit.done) return
    await supabase.from('habit_logs').insert({ user_id: user.id, habit_id: habit.id, log_date: today })
    setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, done: true } : h))
  }

  async function toggleTask(task) {
    const newVal = !task.complete
    await supabase.from('weekly_tasks').update({ complete: newVal }).eq('id', task.id)
    setWeekTasks(prev => prev.map(t => t.id === task.id ? { ...t, complete: newVal } : t))
  }

  // Momentum: habits 40% + tasks 40% + mood 20%
  const habitScore  = habits.length  ? (habits.filter(h => h.done).length / habits.length) * 40 : 0
  const taskScore   = weekTasks.length ? (weekTasks.filter(t => t.complete).length / weekTasks.length) * 40 : 0
  const moodScore   = moodAvg ? (moodAvg / 5) * 20 : 0
  const momentum    = Math.round(habitScore + taskScore + moodScore)

  // Trigger confetti once when crossing 80
  useEffect(() => {
    if (!loading && momentum >= 80 && prevMomentum.current < 80) {
      setConfetti(true)
      setTimeout(() => setConfetti(false), 100)
    }
    prevMomentum.current = momentum
  }, [momentum, loading])

  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const habitsDone = habits.filter(h => h.done).length
  const tasksDone  = weekTasks.filter(t => t.complete).length
  const carriedFwd = weekTasks.filter(t => t.carried_forward).length
  const activeGoals = goals.filter(g => g.quarter === getCurrentQuarter()).length

  const greetingText = !loading && momentum >= 70 && name
    ? `Strong week, ${name.split(' ')[0]} — ${habitsDone} habit${habitsDone !== 1 ? 's' : ''}, ${tasksDone} task${tasksDone !== 1 ? 's' : ''}.`
    : greeting(name, momentum)

  return (
    <div>
      <Confetti active={confetti} />

      {/* Friday review banner */}
      {isFriday && (
        <div style={{
          background: 'linear-gradient(135deg, var(--career-tint) 0%, var(--bg) 100%)',
          border: '1.5px solid var(--career)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 22px',
          marginBottom: '28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <p style={{ color: 'var(--career)', fontWeight: 600, fontSize: 14 }}>It's Friday — time for your end-of-week review</p>
            <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 3 }}>Reflect, carry forward, set intentions for next week.</p>
          </div>
          <Link to="/weekly?review=1" className="btn btn-career btn-sm" style={{ flexShrink: 0, color: '#fff' }}>
            Start review
          </Link>
        </div>
      )}

      {/* Page header */}
      <div className="page-header header-career" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ marginBottom: 6 }}>{loading ? `Good day` : greetingText}</h1>
            <p>{format(new Date(), 'EEEE, d MMMM yyyy')} · {getQuarterYear()}</p>
          </div>
          <div className="page-header-decoration" style={{ color: 'var(--career)' }}>
            <CareerDecoration />
          </div>
        </div>
      </div>

      {/* Top row: momentum + stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, marginBottom: 24, alignItems: 'start' }}>
        {/* Momentum ring */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 28px', minWidth: 160 }}>
          <ArcRing
            value={momentum}
            max={100}
            size={120}
            strokeWidth={9}
            color={momentum >= 70 ? 'var(--finance)' : momentum >= 40 ? 'var(--creative)' : 'var(--personal)'}
            label={momentum}
            sublabel="momentum"
          />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)' }}>This week</p>
            {momentum >= 80 && <p style={{ fontSize: 11, color: 'var(--finance)', marginTop: 4, fontWeight: 500 }}>🔥 On fire</p>}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid-2" style={{ alignContent: 'start' }}>
          <div className="stat-card card-career">
            <span className="stat-value" style={{ color: 'var(--career)' }}>{habitsDone}</span>
            <span className="stat-label">Habits done today</span>
            <span className="stat-sub">of {habits.length} total</span>
          </div>
          <div className="stat-card card-career">
            <span className="stat-value" style={{ color: 'var(--career)' }}>{weekTasks.filter(t => !t.complete).length}</span>
            <span className="stat-label">Tasks remaining</span>
            <span className="stat-sub">this week</span>
          </div>
          <div className="stat-card card-personal">
            <span className="stat-value" style={{ color: 'var(--personal)' }}>{activeGoals}</span>
            <span className="stat-label">Active goals</span>
            <span className="stat-sub">{getCurrentQuarter()}</span>
          </div>
          <div className="stat-card" style={{ borderLeft: `3px solid ${carriedFwd > 0 ? 'var(--creative)' : 'var(--border)'}` }}>
            <span className="stat-value" style={{ color: carriedFwd > 0 ? 'var(--creative)' : 'var(--text-3)' }}>{carriedFwd}</span>
            <span className="stat-label">Carried forward</span>
            <span className="stat-sub">from last week</span>
          </div>
        </div>
      </div>

      {/* Habits + Tasks row */}
      <div className="grid-2 mb-4">
        {/* Today's habits */}
        <div className="card card-personal">
          <div className="flex items-center justify-between mb-4">
            <h3>Today's habits</h3>
            <Link to="/habits" style={{ color: 'var(--personal)', fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              All <ArrowRight size={12} />
            </Link>
          </div>
          {habits.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No habits yet — <Link to="/habits" style={{ color: 'var(--personal)' }}>add some</Link></p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {habits.map(habit => {
                const streak = habit.streak || 0
                return (
                  <div key={habit.id} onClick={() => toggleHabit(habit)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: habit.done ? 'default' : 'pointer' }}>
                    <div className={`toggle-dot ${habit.done ? 'done' : ''}`}>
                      {habit.done && <Check size={11} color="white" strokeWidth={3} />}
                    </div>
                    <span style={{
                      fontSize: 13,
                      color: habit.done ? 'var(--text-3)' : 'var(--text)',
                      textDecoration: habit.done ? 'line-through' : 'none',
                      flex: 1,
                      transition: 'all 0.2s',
                    }}>
                      {habit.emoji} {habit.name}
                    </span>
                    {habit.done && habit.streak >= 3 && (
                      <span style={{ fontSize: 12 }}>🔥 {habit.streak}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* This week's tasks */}
        <div className="card card-career">
          <div className="flex items-center justify-between mb-4">
            <h3>This week</h3>
            <Link to="/weekly" style={{ color: 'var(--career)', fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {weekTasks.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No tasks this week — <Link to="/weekly" style={{ color: 'var(--career)' }}>plan your week</Link></p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {weekTasks.slice(0, 7).map(task => (
                <div key={task.id} onClick={() => toggleTask(task)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <div className={`toggle-dot ${task.complete ? 'done' : ''}`} style={{ marginTop: 2 }}>
                    {task.complete && <Check size={11} color="white" strokeWidth={3} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: task.complete ? 'var(--text-3)' : 'var(--text)', textDecoration: task.complete ? 'line-through' : 'none', transition: 'all 0.2s', display: 'block' }}>
                      {task.specific_task}
                    </span>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
                      <span className="mono">{task.area}</span>
                      {task.carried_forward && <span className="badge badge-warning" style={{ fontSize: 9 }}>carried</span>}
                    </div>
                  </div>
                </div>
              ))}
              {weekTasks.length > 7 && (
                <p style={{ fontSize: 12, color: 'var(--text-3)', paddingTop: 4 }}>+{weekTasks.length - 7} more</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Goals progress */}
      <div className="card card-career mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3>{getCurrentQuarter()} Goals</h3>
          <Link to="/goals" style={{ color: 'var(--career)', fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            Manage <ArrowRight size={12} />
          </Link>
        </div>
        {goals.filter(g => g.quarter === getCurrentQuarter()).length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No goals set for {getCurrentQuarter()} — <Link to="/goals" style={{ color: 'var(--career)' }}>add some</Link></p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {goals.filter(g => g.quarter === getCurrentQuarter()).map(goal => {
              const linked = weekTasks.filter(t => t.goal_id === goal.id)
              const done   = linked.filter(t => t.complete).length
              const pct    = linked.length > 0 ? Math.round((done / linked.length) * 100) : 0
              return (
                <div key={goal.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                  <ArcRing value={pct} max={100} size={52} strokeWidth={5} color="var(--career)" label={`${pct}%`} fontSize={10} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, color: 'var(--career)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{goal.category}</p>
                    <p style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }} className="truncate">{goal.primary_goal}</p>
                    {linked.length > 0 && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{done}/{linked.length} tasks</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Mood */}
      <div style={{ maxWidth: 360 }}>
        <MoodWidget />
      </div>
    </div>
  )
}
