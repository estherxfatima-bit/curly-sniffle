import { useState, useEffect } from 'react'
import { format, isThisWeek, startOfWeek, endOfWeek } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getCurrentQuarter, getQuarterYear } from '../lib/constants'
import MoodWidget from '../components/dashboard/MoodWidget'
import { Check } from 'lucide-react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ habitsDone: 0, tasksDue: 0, activeGoals: 0, carriedForward: 0 })
  const [todayHabits, setTodayHabits] = useState([])
  const [weekTasks, setWeekTasks] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const isFriday = new Date().getDay() === 5
  const today = format(new Date(), 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  useEffect(() => {
    if (!user) return
    loadDashboard()
  }, [user])

  async function loadDashboard() {
    setLoading(true)

    const [habitsRes, logsRes, tasksRes, goalsRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id),
      supabase.from('habit_logs').select('habit_id').eq('user_id', user.id).eq('log_date', today),
      supabase.from('weekly_tasks').select('*').eq('user_id', user.id).gte('week_start', weekStart).lte('week_start', weekEnd),
      supabase.from('goals').select('*').eq('user_id', user.id),
    ])

    const habits = habitsRes.data || []
    const logs = logsRes.data || []
    const tasks = tasksRes.data || []
    const goalsData = goalsRes.data || []

    const loggedIds = new Set(logs.map(l => l.habit_id))
    const habitsWithStatus = habits.map(h => ({ ...h, done: loggedIds.has(h.id) }))

    const carriedCount = tasks.filter(t => t.carried_forward).length
    const activeGoals = goalsData.filter(g => g.quarter === `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`).length

    setTodayHabits(habitsWithStatus)
    setWeekTasks(tasks)
    setGoals(goalsData)
    setStats({
      habitsDone: logs.length,
      tasksDue: tasks.filter(t => !t.complete).length,
      activeGoals,
      carriedForward: carriedCount,
    })
    setLoading(false)
  }

  async function toggleHabit(habit) {
    if (habit.done) return
    await supabase.from('habit_logs').insert({ user_id: user.id, habit_id: habit.id, log_date: today })
    setTodayHabits(prev => prev.map(h => h.id === habit.id ? { ...h, done: true } : h))
    setStats(prev => ({ ...prev, habitsDone: prev.habitsDone + 1 }))
  }

  async function toggleTask(task) {
    const newVal = !task.complete
    await supabase.from('weekly_tasks').update({ complete: newVal }).eq('id', task.id)
    setWeekTasks(prev => prev.map(t => t.id === task.id ? { ...t, complete: newVal } : t))
  }

  const name = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || ''

  return (
    <div>
      {/* Friday review banner */}
      {isFriday && (
        <div style={{
          background: 'rgba(200, 169, 126, 0.08)',
          border: '1px solid rgba(200, 169, 126, 0.25)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <div>
            <p style={{ color: 'var(--accent)', fontWeight: '500', fontSize: '14px' }}>It's Friday — time for your end-of-week review</p>
            <p style={{ color: 'var(--text-3)', fontSize: '12px', marginTop: '2px' }}>Reflect on the week, carry forward tasks, and set intentions.</p>
          </div>
          <a href="/weekly?review=1" className="btn btn-accent btn-sm" style={{ flexShrink: 0 }}>
            Start review
          </a>
        </div>
      )}

      {/* Greeting */}
      <div className="page-header">
        <h1>{greeting()}, {name}</h1>
        <p style={{ marginTop: '6px', color: 'var(--text-2)' }}>
          {format(new Date(), 'EEEE, d MMMM yyyy')} · {getQuarterYear()}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid-4 mb-4">
        <div className="stat-card">
          <span className="stat-value">{stats.habitsDone}</span>
          <span className="stat-label">Habits done today</span>
          <span className="stat-sub">of {todayHabits.length} total</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.tasksDue}</span>
          <span className="stat-label">Tasks remaining</span>
          <span className="stat-sub">this week</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.activeGoals}</span>
          <span className="stat-label">Active goals</span>
          <span className="stat-sub">{getCurrentQuarter()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value" style={{ color: stats.carriedForward > 0 ? 'var(--warning)' : undefined }}>
            {stats.carriedForward}
          </span>
          <span className="stat-label">Carried forward</span>
          <span className="stat-sub">from last week</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Today's habits */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 style={{ fontSize: '1rem' }}>Today's habits</h3>
            <span className="mono">{format(new Date(), 'EEE d')}</span>
          </div>
          {todayHabits.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <p>No habits yet — <a href="/habits" style={{ color: 'var(--cobalt)' }}>add some</a></p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {todayHabits.map(habit => (
                <div
                  key={habit.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: habit.done ? 'default' : 'pointer' }}
                  onClick={() => toggleHabit(habit)}
                >
                  <div className={`toggle-dot ${habit.done ? 'done' : ''}`}>
                    {habit.done && <Check size={11} color="white" strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: '13px', color: habit.done ? 'var(--text-3)' : 'var(--text)', textDecoration: habit.done ? 'line-through' : 'none' }}>
                    {habit.emoji} {habit.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* This week's tasks */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 style={{ fontSize: '1rem' }}>This week's tasks</h3>
            <a href="/weekly" style={{ fontSize: '12px', color: 'var(--cobalt)', textDecoration: 'none' }}>View all →</a>
          </div>
          {weekTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <p>No tasks this week — <a href="/weekly" style={{ color: 'var(--cobalt)' }}>plan your week</a></p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {weekTasks.slice(0, 8).map(task => (
                <div
                  key={task.id}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}
                  onClick={() => toggleTask(task)}
                >
                  <div className={`toggle-dot ${task.complete ? 'done' : ''}`} style={{ marginTop: '2px' }}>
                    {task.complete && <Check size={11} color="white" strokeWidth={3} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '13px', color: task.complete ? 'var(--text-3)' : 'var(--text)', textDecoration: task.complete ? 'line-through' : 'none' }}>
                      {task.specific_task}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span className="mono" style={{ color: 'var(--text-3)' }}>{task.area}</span>
                      {task.carried_forward && <span className="badge badge-warning">carried</span>}
                    </div>
                  </div>
                </div>
              ))}
              {weekTasks.length > 8 && (
                <p style={{ fontSize: '12px', color: 'var(--text-3)', paddingTop: '4px' }}>+{weekTasks.length - 8} more</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Goals progress */}
      <div className="card mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: '1rem' }}>{getCurrentQuarter()} Goals</h3>
          <a href="/goals" style={{ fontSize: '12px', color: 'var(--cobalt)', textDecoration: 'none' }}>Manage →</a>
        </div>
        {goals.filter(g => g.quarter === getCurrentQuarter()).length === 0 ? (
          <div className="empty-state" style={{ padding: '24px' }}>
            <p>No goals for {getCurrentQuarter()} — <a href="/goals" style={{ color: 'var(--cobalt)' }}>set some</a></p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {goals.filter(g => g.quarter === getCurrentQuarter()).map(goal => {
              const linkedTasks = weekTasks.filter(t => t.goal_id === goal.id)
              const completedTasks = linkedTasks.filter(t => t.complete).length
              const pct = linkedTasks.length > 0 ? Math.round((completedTasks / linkedTasks.length) * 100) : 0
              return (
                <div key={goal.id} style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="mono" style={{ color: 'var(--accent)' }}>{goal.category}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{pct}%</span>
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>{goal.primary_goal}</p>
                  <div className="progress-bar">
                    <div className="progress-fill progress-fill-accent" style={{ width: `${pct}%` }} />
                  </div>
                  {linkedTasks.length > 0 && (
                    <p className="mono mt-2">{completedTasks}/{linkedTasks.length} tasks done</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Mood widget */}
      <div className="mt-4" style={{ maxWidth: '340px' }}>
        <MoodWidget />
      </div>
    </div>
  )
}
