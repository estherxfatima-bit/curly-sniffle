import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, startOfWeek, addDays, subDays, startOfMonth, addMonths, subMonths } from 'date-fns'
import { Plus, X } from 'lucide-react'
import ArcRing from '../components/ui/ArcRing'
import HabitModal from '../components/habits/HabitModal'
import HabitRow from '../components/habits/HabitRow'
import HabitMonthView from '../components/habits/HabitMonthView'
import { isExpectedDay } from '../lib/habitUtils'

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
  const [logsByHabit, setLogsByHabit] = useState({})
  const [freezesByHabit, setFreezesByHabit] = useState({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [monthHabit, setMonthHabit] = useState(null)
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()))
  const [dismissedBanners, setDismissedBanners] = useState(new Set())

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd')

  useEffect(() => { if (user) loadAll() }, [user])

  async function loadAll() {
    setLoading(true)
    const [habitsRes, logsRes, freezesRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('habit_logs').select('habit_id, log_date').eq('user_id', user.id),
      supabase.from('habit_freezes').select('habit_id, freeze_date').eq('user_id', user.id),
    ])
    let habitsData = habitsRes.data || []
    const logsData = logsRes.data || []
    const freezesData = freezesRes.data || []

    // Reset monthly streak freeze if a new month has started
    const firstOfMonth = format(startOfMonth(today), 'yyyy-MM-dd')
    const toReset = habitsData.filter(h => h.streak_freeze_used && h.streak_freeze_reset_date < firstOfMonth)
    if (toReset.length) {
      await Promise.all(toReset.map(h =>
        supabase.from('habits').update({ streak_freeze_used: false, streak_freeze_reset_date: firstOfMonth }).eq('id', h.id)
      ))
      habitsData = habitsData.map(h => toReset.some(r => r.id === h.id) ? { ...h, streak_freeze_used: false, streak_freeze_reset_date: firstOfMonth } : h)
    }

    const logMap = {}
    habitsData.forEach(h => { logMap[h.id] = new Set() })
    logsData.forEach(l => { if (logMap[l.habit_id]) logMap[l.habit_id].add(l.log_date) })

    const freezeMap = {}
    habitsData.forEach(h => { freezeMap[h.id] = new Set() })
    freezesData.forEach(f => { if (freezeMap[f.habit_id]) freezeMap[f.habit_id].add(f.freeze_date) })

    setHabits(habitsData)
    setLogsByHabit(logMap)
    setFreezesByHabit(freezeMap)
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
        setFreezesByHabit(prev => ({ ...prev, [data.id]: new Set() }))
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

  async function freezeDay(habit, dateStr) {
    const { data } = await supabase.from('habit_freezes').insert({ user_id: user.id, habit_id: habit.id, freeze_date: dateStr }).select().single()
    if (!data) return
    setFreezesByHabit(prev => { const next = new Set(prev[habit.id]); next.add(dateStr); return { ...prev, [habit.id]: next } })
    const firstOfMonth = format(startOfMonth(today), 'yyyy-MM-dd')
    await supabase.from('habits').update({ streak_freeze_used: true, streak_freeze_reset_date: firstOfMonth }).eq('id', habit.id)
    setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, streak_freeze_used: true, streak_freeze_reset_date: firstOfMonth } : h))
  }

  function openMonth(habit) {
    setMonthHabit(habit)
    setMonthDate(startOfMonth(new Date()))
  }

  const todayDoneCount = habits.filter(h => logsByHabit[h.id]?.has(todayStr)).length
  const overallPct = habits.length ? Math.round((todayDoneCount / habits.length) * 100) : 0

  // Habits that missed an expected day yesterday (and weren't frozen)
  const missedYesterday = habits.filter(h =>
    !dismissedBanners.has(h.id) &&
    isExpectedDay(h, subDays(today, 1)) &&
    !logsByHabit[h.id]?.has(yesterdayStr) &&
    !freezesByHabit[h.id]?.has(yesterdayStr)
  )

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

      {/* Don't-break-the-chain banners */}
      {missedYesterday.length > 0 && (
        <div className="mb-4" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {missedYesterday.map(h => (
            <div key={h.id} className="card card-personal" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 13 }}>{h.emoji} <strong>{h.name}</strong> — don't break the chain. Log it today.</p>
              <button className="btn-icon btn" onClick={() => setDismissedBanners(prev => new Set(prev).add(h.id))}><X size={13} /></button>
            </div>
          ))}
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
              freezeSet={freezesByHabit[habit.id] || new Set()}
              freezeAvailable={!habit.streak_freeze_used}
              onToggleLog={toggleLog}
              onFreeze={freezeDay}
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
          freezeSet={freezesByHabit[monthHabit.id] || new Set()}
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
