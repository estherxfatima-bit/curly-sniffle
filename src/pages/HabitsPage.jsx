import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, startOfWeek, addDays, startOfMonth, addMonths, subMonths } from 'date-fns'
import { Plus, X } from 'lucide-react'
import ArcRing from '../components/ui/ArcRing'
import HabitModal from '../components/habits/HabitModal'
import HabitRow from '../components/habits/HabitRow'
import HabitMonthView from '../components/habits/HabitMonthView'
import { simulateHabit } from '../lib/habitUtils'

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

const DISMISS_KEY = 'habitBannerDismissed'

function loadDismissed(todayStr) {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')
    return new Set(raw.filter(k => k.endsWith(todayStr)))
  } catch {
    return new Set()
  }
}

function saveDismissed(set) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...set])) } catch { /* ignore */ }
}

export default function HabitsPage() {
  const { user } = useAuth()
  const [habits, setHabits] = useState([])
  const [logsByHabit, setLogsByHabit] = useState({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [monthHabit, setMonthHabit] = useState(null)
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()))

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const [dismissedBanners, setDismissedBanners] = useState(() => loadDismissed(todayStr))

  useEffect(() => { if (user) loadAll() }, [user])

  async function loadAll() {
    setLoading(true)
    const [habitsRes, logsRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('habit_logs').select('habit_id, log_date').eq('user_id', user.id),
    ])
    const habitsData = habitsRes.data || []
    const logsData = logsRes.data || []

    const logMap = {}
    habitsData.forEach(h => { logMap[h.id] = new Set() })
    logsData.forEach(l => { if (logMap[l.habit_id]) logMap[l.habit_id].add(l.log_date) })

    // Sync banked_freezes / consecutive_days_count from the computed simulation
    const toUpdate = []
    for (const h of habitsData) {
      const sim = simulateHabit(h, logMap[h.id], today)
      if (h.banked_freezes !== sim.banked || h.consecutive_days_count !== sim.streak) {
        toUpdate.push({ id: h.id, banked_freezes: sim.banked, consecutive_days_count: sim.streak })
      }
    }
    if (toUpdate.length) {
      await Promise.all(toUpdate.map(u =>
        supabase.from('habits').update({ banked_freezes: u.banked_freezes, consecutive_days_count: u.consecutive_days_count }).eq('id', u.id)
      ))
    }
    const updateMap = Object.fromEntries(toUpdate.map(u => [u.id, u]))
    const syncedHabits = habitsData.map(h => updateMap[h.id] ? { ...h, ...updateMap[h.id] } : h)

    setHabits(syncedHabits)
    setLogsByHabit(logMap)
    setLoading(false)
  }

  async function saveHabit(form) {
    if (editing?.id) {
      const { data } = await supabase.from('habits').update(form).eq('id', editing.id).select().single()
      if (data) setHabits(prev => prev.map(h => h.id === data.id ? data : h))
    } else {
      const { data } = await supabase.from('habits').insert({ user_id: user.id, ...form }).select().single()
      if (data) {
        setHabits(prev => [...prev, data])
        setLogsByHabit(prev => ({ ...prev, [data.id]: new Set() }))
      }
    }
    setShowModal(false)
    setEditing(null)
  }

  async function deleteHabit(id) {
    if (!confirm('Delete this habit?')) return
    await supabase.from('habits').delete().eq('id', id)
    setHabits(prev => prev.filter(h => h.id !== id))
  }

  async function toggleLog(habit, dateStr) {
    const isDone = logsByHabit[habit.id]?.has(dateStr)
    if (isDone) {
      await supabase.from('habit_logs').delete().eq('user_id', user.id).eq('habit_id', habit.id).eq('log_date', dateStr)
      setLogsByHabit(prev => { const next = new Set(prev[habit.id]); next.delete(dateStr); return { ...prev, [habit.id]: next } })
    } else {
      await supabase.from('habit_logs').insert({ user_id: user.id, habit_id: habit.id, log_date: dateStr })
      setLogsByHabit(prev => { const next = new Set(prev[habit.id]); next.add(dateStr); return { ...prev, [habit.id]: next } })
    }
  }

  function openMonth(habit) {
    setMonthHabit(habit)
    setMonthDate(startOfMonth(new Date()))
  }

  function dismissBanner(habitId, type) {
    const key = `${habitId}:${type}:${todayStr}`
    setDismissedBanners(prev => {
      const next = new Set(prev).add(key)
      saveDismissed(next)
      return next
    })
  }

  const sims = useMemo(() => {
    const map = {}
    for (const h of habits) map[h.id] = simulateHabit(h, logsByHabit[h.id] || new Set(), today)
    return map
  }, [habits, logsByHabit])

  const todayDoneCount = habits.filter(h => logsByHabit[h.id]?.has(todayStr)).length
  const overallPct = habits.length ? Math.round((todayDoneCount / habits.length) * 100) : 0

  // Build reminder banners — one per habit, prioritised: fresh start > freeze used > don't break the chain
  const allBanners = []
  for (const h of habits) {
    const sim = sims[h.id]
    const hasHistory = (logsByHabit[h.id]?.size || 0) > 0
    if (!hasHistory) continue

    let type = null
    if (sim.streak === 0 && sim.lastOccurrence?.status === 'missed') {
      type = 'fresh'
    } else if (sim.lastOccurrence?.status === 'frozen') {
      type = 'frozen'
    } else if (sim.streak > 0 && sim.pending) {
      type = 'chain'
    }
    if (!type) continue

    const key = `${h.id}:${type}:${todayStr}`
    if (dismissedBanners.has(key)) continue

    let message
    if (type === 'fresh') {
      message = <>{h.emoji} <strong>{h.name}</strong> — fresh start. Log it today and begin again.</>
    } else if (type === 'frozen') {
      message = <>{h.emoji} <strong>{h.name}</strong> — yesterday got away from you, but your streak's safe (❄️ used). Back on it today?</>
    } else {
      message = <>{h.emoji} <strong>{h.name}</strong> — don't break the chain. Log it today.</>
    }

    allBanners.push({ key, habitId: h.id, type, message })
  }

  const visibleBanners = allBanners.slice(0, 3)
  const extraCount = allBanners.length - visibleBanners.length

  return (
    <div>
      <div className="page-header header-personal mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>Habit Tracker</h1>
            <p>This week — tap a dot to log</p>
            <div className="flex items-center gap-3 mt-3">
              <span className="badge badge-personal">{todayDoneCount}/{habits.length} today</span>
            </div>
          </div>
          <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
            <ArcRing value={overallPct} max={100} size={64} strokeWidth={6} color="var(--personal)" label={`${overallPct}%`} sublabel="today" />
            <button className="btn btn-personal btn-sm" style={{ color: '#fff' }} onClick={() => { setEditing(null); setShowModal(true) }}>
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--personal)' }}><HabitsDecoration /></div>
      </div>

      {/* Reminder banners */}
      {visibleBanners.length > 0 && (
        <div className="mb-4" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleBanners.map(b => (
            <div key={b.key} className="card card-personal" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 13 }}>{b.message}</p>
              <button className="btn-icon btn" onClick={() => dismissBanner(b.habitId, b.type)}><X size={13} /></button>
            </div>
          ))}
          {extraCount > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>+{extraCount} more</p>
          )}
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading…</p>
      ) : habits.length === 0 ? (
        <div className="empty-state"><p>No habits yet. Add your first habit above to start tracking.</p></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '220px 110px 1fr 56px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', minWidth: 700 }}>
            <span className="mono">Habit</span>
            <span className="mono">Streak</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {weekDays.map(d => (
                <div key={format(d, 'yyyy-MM-dd')} style={{ textAlign: 'center', fontSize: 9, fontFamily: 'var(--font-mono)', color: format(d, 'yyyy-MM-dd') === todayStr ? 'var(--personal)' : 'var(--text-3)', letterSpacing: '0.02em' }}>
                  {format(d, 'EEE').slice(0,1)}<br/>{format(d, 'd')}
                </div>
              ))}
            </div>
            <span />
          </div>

          {habits.map(habit => (
            <HabitRow
              key={habit.id}
              habit={habit}
              weekDays={weekDays}
              logSet={logsByHabit[habit.id] || new Set()}
              frozenSet={sims[habit.id]?.frozenDates || new Set()}
              streak={sims[habit.id]?.streak ?? 0}
              banked={sims[habit.id]?.banked ?? 0}
              onToggleLog={toggleLog}
              onOpenMonth={openMonth}
              onEdit={h => { setEditing(h); setShowModal(true) }}
              onDelete={deleteHabit}
            />
          ))}
        </div>
      )}

      {showModal && (
        <HabitModal habit={editing} onClose={() => { setShowModal(false); setEditing(null) }} onSave={saveHabit} />
      )}

      {monthHabit && (
        <HabitMonthView
          habit={monthHabit}
          logSet={logsByHabit[monthHabit.id] || new Set()}
          frozenSet={sims[monthHabit.id]?.frozenDates || new Set()}
          streak={sims[monthHabit.id]?.streak ?? 0}
          banked={sims[monthHabit.id]?.banked ?? 0}
          monthDate={monthDate}
          onPrevMonth={() => setMonthDate(prev => subMonths(prev, 1))}
          onNextMonth={() => setMonthDate(prev => addMonths(prev, 1))}
          onClose={() => setMonthHabit(null)}
          onToggleLog={ds => toggleLog(monthHabit, ds)}
        />
      )}
    </div>
  )
}
