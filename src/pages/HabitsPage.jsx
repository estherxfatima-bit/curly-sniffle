import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { Plus, Trash2, X, AlertTriangle, Check } from 'lucide-react'
import ArcRing from '../components/ui/ArcRing'

const EMOJI_OPTIONS = ['💪','📚','🧘','🏃','✍️','🎯','💧','🌿','🎨','🧠','😴','🥗','💊','🎵','🌅','🛁','🧴','🫧']

function HabitsDecoration() {
  return (
    <svg width="100" height="70" viewBox="0 0 100 70" fill="none">
      {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
        <circle key={i} cx={8 + (i % 7) * 13} cy={15 + Math.floor(i / 7) * 16} r="4.5"
          fill="currentColor" opacity={0.1 + (i % 4) * 0.06} />
      ))}
    </svg>
  )
}

export default function HabitsPage() {
  const { user } = useAuth()
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState({})
  const [streaks, setStreaks] = useState({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newHabit, setNewHabit] = useState({ name: '', emoji: '💪' })

  const today = format(new Date(), 'yyyy-MM-dd')
  const days = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() })
  const dayStrs = days.map(d => format(d, 'yyyy-MM-dd'))

  useEffect(() => { if (user) loadAll() }, [user])

  async function loadAll() {
    setLoading(true)
    const [habitsRes, logsRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('habit_logs').select('habit_id, log_date').eq('user_id', user.id).gte('log_date', dayStrs[0]),
    ])
    const habitsData = habitsRes.data || []
    const logsData   = logsRes.data || []
    const logMap = {}
    habitsData.forEach(h => { logMap[h.id] = new Set() })
    logsData.forEach(l => { if (logMap[l.habit_id]) logMap[l.habit_id].add(l.log_date) })

    // Calculate streaks
    const streakMap = {}
    habitsData.forEach(h => {
      let streak = 0
      for (let i = dayStrs.length - 1; i >= 0; i--) {
        if (logMap[h.id]?.has(dayStrs[i])) streak++
        else break
      }
      streakMap[h.id] = streak
    })

    setHabits(habitsData)
    setLogs(logMap)
    setStreaks(streakMap)
    setLoading(false)
  }

  async function addHabit() {
    if (!newHabit.name.trim()) return
    const { data } = await supabase.from('habits').insert({ user_id: user.id, name: newHabit.name, emoji: newHabit.emoji }).select().single()
    if (data) { setHabits(prev => [...prev, data]); setLogs(prev => ({ ...prev, [data.id]: new Set() })); setStreaks(prev => ({ ...prev, [data.id]: 0 })) }
    setNewHabit({ name: '', emoji: '💪' })
    setShowAdd(false)
  }

  async function deleteHabit(id) {
    if (!confirm('Delete this habit?')) return
    await supabase.from('habits').delete().eq('id', id)
    setHabits(prev => prev.filter(h => h.id !== id))
  }

  async function toggleLog(habitId, dateStr) {
    const isDone = logs[habitId]?.has(dateStr)
    if (isDone) {
      await supabase.from('habit_logs').delete().eq('user_id', user.id).eq('habit_id', habitId).eq('log_date', dateStr)
      setLogs(prev => { const next = new Set(prev[habitId]); next.delete(dateStr); return { ...prev, [habitId]: next } })
    } else {
      await supabase.from('habit_logs').insert({ user_id: user.id, habit_id: habitId, log_date: dateStr })
      setLogs(prev => { const next = new Set(prev[habitId]); next.add(dateStr); return { ...prev, [habitId]: next } })
    }
    // Recalculate streak for this habit
    setStreaks(prev => {
      const logSet = new Set(logs[habitId])
      if (!isDone) logSet.add(dateStr); else logSet.delete(dateStr)
      let streak = 0
      for (let i = dayStrs.length - 1; i >= 0; i--) {
        if (logSet.has(dayStrs[i])) streak++; else break
      }
      return { ...prev, [habitId]: streak }
    })
  }

  const todayDoneCount = habits.filter(h => logs[h.id]?.has(today)).length
  const overallPct = habits.length ? Math.round((todayDoneCount / habits.length) * 100) : 0

  return (
    <div>
      <div className="page-header header-personal mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>Habit Tracker</h1>
            <p>14-day history — click a dot to log</p>
            <div className="flex items-center gap-3 mt-3">
              <span className="badge badge-personal">{todayDoneCount}/{habits.length} today</span>
            </div>
          </div>
          <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
            <ArcRing value={overallPct} max={100} size={64} strokeWidth={6} color="var(--personal)" label={`${overallPct}%`} sublabel="today" />
            <button className="btn btn-personal btn-sm" style={{ color: '#fff' }} onClick={() => setShowAdd(v => !v)}>
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--personal)' }}><HabitsDecoration /></div>
      </div>

      {showAdd && (
        <div className="card mb-4 card-personal" style={{ padding: '16px 20px' }}>
          <div className="flex items-center gap-3">
            <select value={newHabit.emoji} onChange={e => setNewHabit(p => ({ ...p, emoji: e.target.value }))} style={{ padding: '7px 10px', width: 'auto', fontSize: 18 }}>
              {EMOJI_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <input value={newHabit.name} onChange={e => setNewHabit(p => ({ ...p, name: e.target.value }))} placeholder="Habit name…" style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && addHabit()} autoFocus />
            <button className="btn btn-personal btn-sm" style={{ color: '#fff' }} onClick={addHabit}>Add</button>
            <button className="btn-icon btn" onClick={() => setShowAdd(false)}><X size={14} /></button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading…</p>
      ) : habits.length === 0 ? (
        <div className="empty-state"><p>No habits yet. Add your first habit above to start tracking.</p></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 100px 1fr 52px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', minWidth: 700 }}>
            <span className="mono">Habit</span>
            <span className="mono">Streak</span>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(14, 1fr)`, gap: 4 }}>
              {days.map(d => (
                <div key={format(d, 'yyyy-MM-dd')} style={{ textAlign: 'center', fontSize: 9, fontFamily: 'var(--font-mono)', color: format(d, 'yyyy-MM-dd') === today ? 'var(--personal)' : 'var(--text-3)', letterSpacing: '0.02em' }}>
                  {format(d, 'EEE').slice(0,1)}<br/>{format(d, 'd')}
                </div>
              ))}
            </div>
            <span />
          </div>

          {habits.map(habit => {
            const streak = streaks[habit.id] || 0
            const warn = dayStrs.slice(-2).every(d => !logs[habit.id]?.has(d))
            return (
              <div key={habit.id} style={{ display: 'grid', gridTemplateColumns: '200px 100px 1fr 52px', padding: '13px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center', minWidth: 700 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {warn && <AlertTriangle size={13} color="var(--warning)" title="2-day rule: haven't logged in 2 days" />}
                  <span style={{ fontSize: 16 }}>{habit.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{habit.name}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 22, fontFamily: 'var(--font-serif)', fontWeight: 700, color: streak > 0 ? 'var(--personal)' : 'var(--text-3)' }}>{streak}</span>
                  <span className="mono">days</span>
                  {streak >= 3 && <span style={{ fontSize: 14 }}>🔥</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: `repeat(14, 1fr)`, gap: 4 }}>
                  {dayStrs.map(dateStr => {
                    const done = logs[habit.id]?.has(dateStr)
                    const isToday = dateStr === today
                    return (
                      <div key={dateStr} onClick={() => toggleLog(habit.id, dateStr)} style={{
                        width: 20, height: 20, borderRadius: '50%', margin: '0 auto',
                        background: done ? 'var(--personal)' : 'var(--bg-3)',
                        border: `2px solid ${isToday ? 'var(--personal)' : 'transparent'}`,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s', boxShadow: done ? '0 0 0 2px var(--personal-tint)' : 'none',
                      }}>
                        {done && <Check size={10} color="white" strokeWidth={3} />}
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-icon btn" onClick={() => deleteHabit(habit.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
