import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { Plus, Trash2, X, AlertTriangle, Check } from 'lucide-react'

const EMOJI_OPTIONS = ['💪', '📚', '🧘', '🏃', '✍️', '🎯', '💧', '🌿', '🎨', '🧠', '😴', '🥗', '💊', '🎵', '🌅']

export default function HabitsPage() {
  const { user } = useAuth()
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState({}) // { habitId: Set of date strings }
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newHabit, setNewHabit] = useState({ name: '', emoji: '💪' })

  const today = format(new Date(), 'yyyy-MM-dd')
  const days = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() })
  const dayStrs = days.map(d => format(d, 'yyyy-MM-dd'))

  useEffect(() => {
    if (user) loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)
    const [habitsRes, logsRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('habit_logs').select('habit_id, log_date').eq('user_id', user.id).gte('log_date', dayStrs[0]),
    ])
    const habitsData = habitsRes.data || []
    const logsData = logsRes.data || []

    // Build { habitId: Set<date> }
    const logMap = {}
    habitsData.forEach(h => { logMap[h.id] = new Set() })
    logsData.forEach(l => { if (logMap[l.habit_id]) logMap[l.habit_id].add(l.log_date) })

    setHabits(habitsData)
    setLogs(logMap)
    setLoading(false)
  }

  async function addHabit() {
    if (!newHabit.name.trim()) return
    const { data } = await supabase.from('habits').insert({
      user_id: user.id,
      name: newHabit.name,
      emoji: newHabit.emoji,
    }).select().single()
    if (data) {
      setHabits(prev => [...prev, data])
      setLogs(prev => ({ ...prev, [data.id]: new Set() }))
    }
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
      setLogs(prev => {
        const next = new Set(prev[habitId])
        next.delete(dateStr)
        return { ...prev, [habitId]: next }
      })
    } else {
      await supabase.from('habit_logs').insert({ user_id: user.id, habit_id: habitId, log_date: dateStr })
      setLogs(prev => {
        const next = new Set(prev[habitId])
        next.add(dateStr)
        return { ...prev, [habitId]: next }
      })
    }
  }

  function getStreak(habitId) {
    let streak = 0
    for (let i = dayStrs.length - 1; i >= 0; i--) {
      if (logs[habitId]?.has(dayStrs[i])) streak++
      else break
    }
    return streak
  }

  function isTwoDayWarning(habitId) {
    // Last 2 days not logged
    const last2 = dayStrs.slice(-2)
    return last2.every(d => !logs[habitId]?.has(d))
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>Habit Tracker</h1>
            <p>14-day history — click a dot to log</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(v => !v)}>
            <Plus size={14} /> Add habit
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="card mb-4" style={{ padding: '16px 20px' }}>
          <div className="flex items-center gap-3">
            <div style={{ position: 'relative' }}>
              <select
                value={newHabit.emoji}
                onChange={e => setNewHabit(p => ({ ...p, emoji: e.target.value }))}
                style={{ padding: '6px 10px', width: 'auto', fontSize: '18px', background: 'var(--bg-3)' }}
              >
                {EMOJI_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <input
              value={newHabit.name}
              onChange={e => setNewHabit(p => ({ ...p, name: e.target.value }))}
              placeholder="Habit name…"
              style={{ flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && addHabit()}
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={addHabit}>Add</button>
            <button className="btn-icon btn" onClick={() => setShowAdd(false)}><X size={14} /></button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-dim" style={{ textAlign: 'center', padding: '40px' }}>Loading…</p>
      ) : habits.length === 0 ? (
        <div className="empty-state">
          <p>No habits yet. Add your first habit to start tracking.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Day headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '200px 80px 1fr 60px',
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span className="mono">Habit</span>
            <span className="mono">Streak</span>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(14, 1fr)`, gap: '4px' }}>
              {days.map(d => (
                <div key={format(d, 'yyyy-MM-dd')} style={{
                  textAlign: 'center',
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  color: format(d, 'yyyy-MM-dd') === today ? 'var(--accent)' : 'var(--text-3)',
                  letterSpacing: '0.02em',
                }}>
                  {format(d, 'EEE').slice(0, 1)}
                  <br />
                  {format(d, 'd')}
                </div>
              ))}
            </div>
            <span></span>
          </div>

          {habits.map(habit => {
            const streak = getStreak(habit.id)
            const warn = isTwoDayWarning(habit.id)
            return (
              <div
                key={habit.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '200px 80px 1fr 60px',
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {warn && <AlertTriangle size={13} color="var(--warning)" title="2-day rule: you haven't logged in 2 days" />}
                  <span style={{ fontSize: '16px' }}>{habit.emoji}</span>
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>{habit.name}</span>
                </div>

                <div>
                  <span style={{ fontSize: '18px', fontFamily: 'var(--font-serif)', color: streak > 0 ? 'var(--accent)' : 'var(--text-3)' }}>
                    {streak}
                  </span>
                  <span className="mono" style={{ marginLeft: '4px' }}>days</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: `repeat(14, 1fr)`, gap: '4px' }}>
                  {dayStrs.map(dateStr => {
                    const done = logs[habit.id]?.has(dateStr)
                    const isToday = dateStr === today
                    return (
                      <div
                        key={dateStr}
                        onClick={() => toggleLog(habit.id, dateStr)}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: done ? 'var(--success)' : 'var(--bg-4)',
                          border: isToday ? '2px solid var(--accent)' : '2px solid transparent',
                          cursor: 'pointer',
                          margin: '0 auto',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.12s',
                        }}
                      >
                        {done && <Check size={10} color="white" strokeWidth={3} />}
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-icon btn" onClick={() => deleteHabit(habit.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
