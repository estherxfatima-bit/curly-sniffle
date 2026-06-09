import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, startOfWeek, addDays, subDays, parseISO } from 'date-fns'
import { Plus, Trash2, Check, Droplets, Moon, Dumbbell, ShoppingCart } from 'lucide-react'

const WORKOUT_TYPES = ['Gym', 'Run', 'Yoga', 'Swim', 'Cycle', 'Walk', 'HIIT', 'Other']
const SLOTS = ['breakfast', 'lunch', 'dinner']
const HYDRATION_GOAL = 2500

function WellnessDecoration() {
  return (
    <svg width="100" height="70" viewBox="0 0 100 70" fill="none">
      <path d="M20 55 Q20 35 30 30 Q40 25 40 45 Q40 60 30 62 Q20 64 20 55Z" stroke="currentColor" strokeWidth="1.5" opacity="0.2" fill="none"/>
      <circle cx="65" cy="28" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
      <path d="M57 28 L63 34 L73 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" fill="none"/>
      <rect x="55" y="50" width="24" height="14" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.15"/>
      <path d="M59 57 L67 57 M59 53 L71 53" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
    </svg>
  )
}

function HydrationRing({ ml, goal }) {
  const pct  = Math.min(1, ml / goal)
  const size = 100
  const sw   = 10
  const r    = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const dashOffset = circ * (1 - pct * 0.75) // 270° arc
  const startAngle = 135
  const rot = `rotate(${startAngle}, ${size/2}, ${size/2})`

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={sw}
        strokeDasharray={`${circ * 0.75} ${circ}`} strokeDashoffset={0}
        strokeLinecap="round" transform={rot} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--wellness)" strokeWidth={sw}
        strokeDasharray={`${circ * 0.75} ${circ}`} strokeDashoffset={circ * 0.75 * (1 - pct)}
        strokeLinecap="round" transform={rot}
        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)' }} />
      <text x={size/2} y={size/2 - 4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="14" fontWeight="600" fill="var(--text)">{ml}</text>
      <text x={size/2} y={size/2 + 12} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-3)">ml</text>
    </svg>
  )
}

export default function WellnessPage() {
  const { user } = useAuth()
  const today = format(new Date(), 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [tab, setTab]                 = useState('workouts')
  const [workouts, setWorkouts]       = useState([])
  const [mealPlan, setMealPlan]       = useState({}) // key: `${dayIndex}-${slot}`
  const [groceries, setGroceries]     = useState([])
  const [wellnessLog, setWellnessLog] = useState(null)
  const [loading, setLoading]         = useState(true)

  // Forms
  const [newWorkout, setNewWorkout] = useState({ type: 'Gym', duration_min: '', notes: '', log_date: today })
  const [newGrocery, setNewGrocery] = useState('')
  const [hydrationInput, setHydrationInput] = useState(250)
  const [sleepHours, setSleepHours]         = useState('')
  const [sleepQuality, setSleepQuality]     = useState(3)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const [wRes, mpRes, grRes, wlRes] = await Promise.all([
      supabase.from('workout_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: false }).limit(30),
      supabase.from('meal_plans').select('*').eq('user_id', user.id).eq('week_start', weekStart),
      supabase.from('grocery_items').select('*').eq('user_id', user.id).eq('archived', false).order('created_at'),
      supabase.from('wellness_logs').select('*').eq('user_id', user.id).eq('log_date', today).maybeSingle(),
    ])
    setWorkouts(wRes.data || [])
    const mp = {}
    ;(mpRes.data || []).forEach(r => { mp[`${r.day_index}-${r.slot}`] = r })
    setMealPlan(mp)
    setGroceries(grRes.data || [])
    setWellnessLog(wlRes.data)
    setLoading(false)
  }

  // Workout streak
  const workoutDates = [...new Set(workouts.map(w => w.log_date))].sort().reverse()
  let streak = 0
  let check = new Date(today)
  for (const d of workoutDates) {
    if (d === format(check, 'yyyy-MM-dd')) { streak++; check = subDays(check, 1) }
    else if (d === format(subDays(check, 1), 'yyyy-MM-dd')) { check = subDays(check, 1); streak++; check = subDays(check, 1) }
    else break
  }

  async function addWorkout() {
    if (!newWorkout.type) return
    const { data } = await supabase.from('workout_logs').insert({
      user_id: user.id, log_date: newWorkout.log_date, type: newWorkout.type,
      duration_min: newWorkout.duration_min ? parseInt(newWorkout.duration_min) : null,
      notes: newWorkout.notes || null,
    }).select().single()
    setWorkouts(prev => [data, ...prev])
    setNewWorkout({ type: 'Gym', duration_min: '', notes: '', log_date: today })
  }

  async function deleteWorkout(id) {
    await supabase.from('workout_logs').delete().eq('id', id)
    setWorkouts(prev => prev.filter(w => w.id !== id))
  }

  async function setMeal(dayIndex, slot, meal) {
    const key = `${dayIndex}-${slot}`
    const existing = mealPlan[key]
    if (existing) {
      await supabase.from('meal_plans').update({ meal }).eq('id', existing.id)
      setMealPlan(prev => ({ ...prev, [key]: { ...existing, meal } }))
    } else {
      const { data } = await supabase.from('meal_plans').insert({
        user_id: user.id, week_start: weekStart, day_index: dayIndex, slot, meal,
      }).select().single()
      setMealPlan(prev => ({ ...prev, [key]: data }))
    }
  }

  async function addGrocery() {
    if (!newGrocery.trim()) return
    const { data } = await supabase.from('grocery_items').insert({ user_id: user.id, text: newGrocery.trim() }).select().single()
    setGroceries(prev => [...prev, data])
    setNewGrocery('')
  }

  async function toggleGrocery(id, checked) {
    await supabase.from('grocery_items').update({ checked: !checked }).eq('id', id)
    setGroceries(prev => prev.map(g => g.id === id ? { ...g, checked: !checked } : g))
  }

  async function archiveChecked() {
    const ids = groceries.filter(g => g.checked).map(g => g.id)
    if (!ids.length) return
    await supabase.from('grocery_items').update({ archived: true }).in('id', ids)
    setGroceries(prev => prev.filter(g => !ids.includes(g.id)))
  }

  async function logHydration() {
    const existing = wellnessLog
    const current = existing?.hydration_ml || 0
    const updated = current + hydrationInput
    if (existing) {
      await supabase.from('wellness_logs').update({ hydration_ml: updated }).eq('id', existing.id)
      setWellnessLog(prev => ({ ...prev, hydration_ml: updated }))
    } else {
      const { data } = await supabase.from('wellness_logs').insert({ user_id: user.id, log_date: today, hydration_ml: updated }).select().single()
      setWellnessLog(data)
    }
  }

  async function logSleep() {
    const existing = wellnessLog
    const payload = { sleep_hours: sleepHours ? parseFloat(sleepHours) : null, sleep_quality: sleepQuality }
    if (existing) {
      await supabase.from('wellness_logs').update(payload).eq('id', existing.id)
      setWellnessLog(prev => ({ ...prev, ...payload }))
    } else {
      const { data } = await supabase.from('wellness_logs').insert({ user_id: user.id, log_date: today, hydration_ml: 0, ...payload }).select().single()
      setWellnessLog(data)
    }
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(parseISO(weekStart), i)
    return { label: format(d, 'EEE'), sub: format(d, 'd'), index: i }
  })

  if (loading) return <p style={{ padding: 40, color: 'var(--text-3)', textAlign: 'center' }}>Loading…</p>

  return (
    <div>
      <div className="page-header header-wellness mb-6">
        <div>
          <h1>Wellness</h1>
          <p>Workouts, meals, hydration, and sleep in one place</p>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--wellness)' }}><WellnessDecoration /></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5" style={{ '--section-tab-color': 'var(--wellness)' }}>
        {['workouts', 'meals', 'grocery', 'sleep'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`btn btn-sm tab-item ${tab === t ? 'active' : 'btn-ghost'}`}
            style={tab === t ? { color: '#fff', background: 'var(--wellness)' } : {}}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Workouts tab */}
      {tab === 'workouts' && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="card" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
              <Dumbbell size={16} color="var(--wellness)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                {streak > 0 ? `${streak} day streak ${streak >= 3 ? '🔥' : ''}` : 'No current streak'}
              </span>
            </div>
            <div className="card" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{workouts.filter(w => w.log_date >= weekStart).length} sessions this week</span>
            </div>
          </div>

          <div className="card mb-4">
            <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>Log workout</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <select value={newWorkout.type} onChange={e => setNewWorkout(p => ({ ...p, type: e.target.value }))} style={{ fontSize: 12 }}>
                {WORKOUT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <input type="number" placeholder="Duration (min)" value={newWorkout.duration_min} onChange={e => setNewWorkout(p => ({ ...p, duration_min: e.target.value }))} style={{ fontSize: 12, width: 130 }} />
              <input type="date" value={newWorkout.log_date} onChange={e => setNewWorkout(p => ({ ...p, log_date: e.target.value }))} style={{ fontSize: 12 }} />
            </div>
            <input placeholder="Notes (optional)" value={newWorkout.notes} onChange={e => setNewWorkout(p => ({ ...p, notes: e.target.value }))} style={{ fontSize: 12, marginBottom: 8 }} />
            <button className="btn btn-sm btn-wellness" style={{ color: '#fff' }} onClick={addWorkout}><Plus size={12} /> Log</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {workouts.map(w => (
              <div key={w.id} className="card flex items-center justify-between gap-3" style={{ padding: '10px 14px' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{w.type}{w.duration_min ? ` · ${w.duration_min}min` : ''}</p>
                  {w.notes && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{w.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{w.log_date}</span>
                  <button className="btn-icon btn" onClick={() => deleteWorkout(w.id)}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meals tab */}
      {tab === 'meals' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '6px', minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textAlign: 'left', paddingLeft: 4, width: 80 }}>Day</th>
                {SLOTS.map(s => <th key={s} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textAlign: 'left', paddingLeft: 8 }}>{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {weekDays.map(({ label, sub, index }) => (
                <tr key={index}>
                  <td style={{ padding: '4px 0', verticalAlign: 'middle' }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 500 }}>{label}</p>
                      <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{sub}</p>
                    </div>
                  </td>
                  {SLOTS.map(slot => {
                    const key = `${index}-${slot}`
                    const entry = mealPlan[key]
                    return (
                      <td key={slot} style={{ verticalAlign: 'top' }}>
                        <input
                          value={entry?.meal || ''}
                          placeholder={`${slot}…`}
                          onChange={e => setMeal(index, slot, e.target.value)}
                          style={{ fontSize: 12, padding: '6px 8px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, width: '100%' }}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grocery tab */}
      {tab === 'grocery' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              placeholder="Add item…"
              value={newGrocery}
              onChange={e => setNewGrocery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addGrocery()}
              style={{ flex: 1, fontSize: 13 }}
            />
            <button className="btn btn-sm btn-wellness" style={{ color: '#fff' }} onClick={addGrocery}><Plus size={12} /> Add</button>
            {groceries.some(g => g.checked) && (
              <button className="btn btn-sm btn-ghost" onClick={archiveChecked}>Archive checked</button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {groceries.map(g => (
              <div key={g.id} className="flex items-center gap-3" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <button
                  onClick={() => toggleGrocery(g.id, g.checked)}
                  style={{
                    width: 20, height: 20, borderRadius: 4, border: `2px solid ${g.checked ? 'var(--wellness)' : 'var(--border)'}`,
                    background: g.checked ? 'var(--wellness)' : 'transparent', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                  }}
                >
                  {g.checked && <Check size={12} color="#fff" />}
                </button>
                <span style={{ fontSize: 13, flex: 1, textDecoration: g.checked ? 'line-through' : 'none', color: g.checked ? 'var(--text-3)' : 'var(--text)' }}>
                  {g.text}
                </span>
              </div>
            ))}
            {groceries.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>List is empty.</p>}
          </div>
        </div>
      )}

      {/* Sleep + hydration tab */}
      {tab === 'sleep' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Hydration */}
          <div className="card">
            <h3 style={{ fontSize: '0.9rem', marginBottom: 16 }}>
              <Droplets size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--wellness)' }} />
              Hydration today
            </h3>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <HydrationRing ml={wellnessLog?.hydration_ml || 0} goal={HYDRATION_GOAL} />
            </div>
            <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginBottom: 14 }}>
              Goal: {HYDRATION_GOAL}ml
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={hydrationInput} onChange={e => setHydrationInput(parseInt(e.target.value))} style={{ fontSize: 12, flex: 1 }}>
                {[150, 200, 250, 330, 500, 750, 1000].map(ml => <option key={ml} value={ml}>{ml}ml</option>)}
              </select>
              <button className="btn btn-sm btn-wellness" style={{ color: '#fff' }} onClick={logHydration}>+ Log</button>
            </div>
          </div>

          {/* Sleep */}
          <div className="card">
            <h3 style={{ fontSize: '0.9rem', marginBottom: 16 }}>
              <Moon size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--wellness)' }} />
              Sleep log — last night
            </h3>
            {wellnessLog?.sleep_hours && (
              <div style={{ background: 'var(--wellness-tint)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                <p style={{ fontSize: 13 }}>{wellnessLog.sleep_hours}h · quality {wellnessLog.sleep_quality}/5</p>
              </div>
            )}
            <div className="form-group">
              <label>Hours slept</label>
              <input type="number" step="0.5" min="0" max="24" placeholder="e.g. 7.5" value={sleepHours} onChange={e => setSleepHours(e.target.value)} style={{ fontSize: 12 }} />
            </div>
            <div className="form-group">
              <label>Sleep quality — {sleepQuality}/5</label>
              <input type="range" min={1} max={5} value={sleepQuality} onChange={e => setSleepQuality(Number(e.target.value))} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                <span>Poor</span><span>Great</span>
              </div>
            </div>
            <button className="btn btn-sm btn-wellness w-full" style={{ color: '#fff', justifyContent: 'center' }} onClick={logSleep}>Save sleep log</button>
          </div>
        </div>
      )}
    </div>
  )
}
