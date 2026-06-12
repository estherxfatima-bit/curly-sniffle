import { useState } from 'react'
import { format, startOfWeek, endOfWeek, subWeeks, subDays, parseISO } from 'date-fns'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { Plus, Trash2, Check, Pencil, X as XIcon, Calendar } from 'lucide-react'
import ArcRing from '../ui/ArcRing'
import AddWidgetMenu from '../dashboard/AddWidgetMenu'

const WORKOUT_TYPES = ['Gym', 'Run', 'Yoga', 'Swim', 'Cycle', 'Walk', 'HIIT', 'Other']
const HYDRATION_GOAL = 2500
const WIDGET_KEY = 'wellnessDashboardWidgets'

const ALL_WIDGETS = [
  { id: 'overview',      label: 'Overview' },
  { id: 'scheduled',     label: 'Scheduled workouts' },
  { id: 'workoutChart',  label: 'Workout history' },
  { id: 'hydrationChart', label: 'Hydration trend' },
  { id: 'goals',         label: 'Goals progress' },
]
const DEFAULT_WIDGETS = ALL_WIDGETS.map(w => w.id)

function loadWidgets() {
  try {
    const raw = JSON.parse(localStorage.getItem(WIDGET_KEY) || 'null')
    return Array.isArray(raw) && raw.length ? raw : DEFAULT_WIDGETS
  } catch {
    return DEFAULT_WIDGETS
  }
}
function saveWidgets(list) {
  try { localStorage.setItem(WIDGET_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export default function WellnessDashboard({
  streak, sessionsThisWeek, hydrationToday, hydrationHistory,
  mealPlan, wellnessGoals, goalProgress, linkedTasksFor, workouts,
  scheduledWorkouts, today, onAddScheduled, onCompleteScheduled, onDeleteScheduled,
}) {
  const [widgets, setWidgets] = useState(loadWidgets)
  const [editing, setEditing] = useState(false)
  const [newScheduled, setNewScheduled] = useState({ type: 'Gym', log_date: format(subDays(new Date(), -1), 'yyyy-MM-dd'), notes: '' })

  function removeWidget(id) {
    const next = widgets.filter(w => w !== id)
    setWidgets(next)
    saveWidgets(next)
  }
  function addWidget(id) {
    const next = [...widgets, id]
    setWidgets(next)
    saveWidgets(next)
  }

  const available = ALL_WIDGETS.filter(w => !widgets.includes(w.id))

  function handleAddScheduled() {
    if (!newScheduled.type || !newScheduled.log_date) return
    onAddScheduled({ ...newScheduled, notes: newScheduled.notes || null })
    setNewScheduled({ type: 'Gym', log_date: newScheduled.log_date, notes: '' })
  }

  // Workout history: weekly session counts, last 8 weeks
  const workoutChartData = []
  for (let i = 7; i >= 0; i--) {
    const ws = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 })
    const we = endOfWeek(ws, { weekStartsOn: 1 })
    const wsStr = format(ws, 'yyyy-MM-dd')
    const weStr = format(we, 'yyyy-MM-dd')
    const count = workouts.filter(w => !w.planned && w.log_date >= wsStr && w.log_date <= weStr).length
    workoutChartData.push({ week: format(ws, 'd MMM'), sessions: count })
  }

  // Hydration trend: last 7 days vs goal
  const hydrationChartData = []
  for (let i = 6; i >= 0; i--) {
    const ds = format(subDays(new Date(), i), 'yyyy-MM-dd')
    const entry = hydrationHistory.find(h => h.log_date === ds)
    hydrationChartData.push({ day: format(parseISO(ds), 'EEE'), ml: entry?.hydration_ml || 0 })
  }

  const avgGoalPct = wellnessGoals.length
    ? Math.round(wellnessGoals.reduce((s, g) => s + goalProgress(g), 0) / wellnessGoals.length)
    : 0

  const hasPlan = (mealPlan.plan_text || '').trim().length > 0

  const widgetCard = (id, content) => (
    <div key={id} className="card" style={{ position: 'relative' }}>
      {editing && (
        <button className="btn-icon btn" onClick={() => removeWidget(id)} style={{ position: 'absolute', top: 10, right: 10, zIndex: 1 }} title="Remove widget">
          <XIcon size={12} />
        </button>
      )}
      {content}
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4 wrap" style={{ gap: 8 }}>
        <AddWidgetMenu available={available} onAdd={addWidget} />
        <button
          className={`btn btn-sm ${editing ? 'btn-wellness' : 'btn-ghost'}`}
          style={editing ? { color: '#fff' } : {}}
          onClick={() => setEditing(v => !v)}
        >
          {editing ? <><Check size={13} /> Done</> : <><Pencil size={13} /> Edit widgets</>}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {widgets.includes('overview') && widgetCard('overview', (
          <>
            <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              <div className="card" style={{ background: 'var(--bg-2)', padding: '12px 14px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Workout streak</p>
                <p style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{streak}{streak >= 3 ? ' 🔥' : ''}</p>
              </div>
              <div className="card" style={{ background: 'var(--bg-2)', padding: '12px 14px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Sessions this week</p>
                <p style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{sessionsThisWeek}</p>
              </div>
              <div className="card" style={{ background: 'var(--bg-2)', padding: '12px 14px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Hydration today</p>
                <p style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{hydrationToday}<span style={{ fontSize: 11, color: 'var(--text-3)' }}>/{HYDRATION_GOAL}ml</span></p>
              </div>
              <div className="card" style={{ background: 'var(--bg-2)', padding: '12px 14px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Goals progress</p>
                <p style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{wellnessGoals.length ? `${avgGoalPct}%` : '—'}</p>
              </div>
              <div className="card" style={{ background: 'var(--bg-2)', padding: '12px 14px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>This week's plan</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: hasPlan ? 'var(--wellness)' : 'var(--text-3)' }}>{hasPlan ? 'Planned' : 'Not started'}</p>
              </div>
            </div>
          </>
        ))}

        {widgets.includes('scheduled') && widgetCard('scheduled', (
          <>
            <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>
              <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--wellness)' }} />
              Scheduled workouts
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <select value={newScheduled.type} onChange={e => setNewScheduled(p => ({ ...p, type: e.target.value }))} style={{ fontSize: 12 }}>
                {WORKOUT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <input type="date" value={newScheduled.log_date} min={today} onChange={e => setNewScheduled(p => ({ ...p, log_date: e.target.value }))} style={{ fontSize: 12 }} />
              <input placeholder="Notes (optional)" value={newScheduled.notes} onChange={e => setNewScheduled(p => ({ ...p, notes: e.target.value }))} style={{ fontSize: 12, flex: 1, minWidth: 120 }} />
              <button className="btn btn-sm btn-wellness" style={{ color: '#fff' }} onClick={handleAddScheduled}><Plus size={12} /> Schedule</button>
            </div>
            {scheduledWorkouts.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No workouts scheduled.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {scheduledWorkouts.map(w => (
                  <div key={w.id} className="flex items-center justify-between gap-3" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{w.type}{w.duration_min ? ` · ${w.duration_min}min` : ''}</p>
                      {w.notes && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{w.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{w.log_date}</span>
                      <button className="btn-icon btn" title="Mark done" onClick={() => onCompleteScheduled(w.id)}><Check size={12} /></button>
                      <button className="btn-icon btn" title="Delete" onClick={() => onDeleteScheduled(w.id)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ))}

        {widgets.includes('workoutChart') && widgetCard('workoutChart', (
          <>
            <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>Workout history</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={workoutChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="week" tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-3)' }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-3)' }} width={20} />
                <Tooltip
                  contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                  labelStyle={{ color: 'var(--text-3)' }}
                  itemStyle={{ color: 'var(--wellness)' }}
                />
                <Bar dataKey="sessions" fill="var(--wellness)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        ))}

        {widgets.includes('hydrationChart') && widgetCard('hydrationChart', (
          <>
            <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>Hydration trend</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={hydrationChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-3)' }} />
                <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-3)' }} width={30} />
                <Tooltip
                  contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                  labelStyle={{ color: 'var(--text-3)' }}
                  itemStyle={{ color: 'var(--wellness)' }}
                />
                <Line type="monotone" dataKey="ml" stroke="var(--wellness)" strokeWidth={2} dot />
                <ReferenceLine y={HYDRATION_GOAL} stroke="var(--text-3)" strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </>
        ))}

        {widgets.includes('goals') && widgetCard('goals', (
          <>
            <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>Goals progress</h3>
            {wellnessGoals.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No wellness goals yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {wellnessGoals.map(goal => {
                  const pct = goalProgress(goal)
                  const linkedCount = linkedTasksFor(goal.id).length
                  return (
                    <div key={goal.id} className="flex items-center gap-3" style={{ padding: '8px 0' }}>
                      <ArcRing value={pct} max={100} size={40} strokeWidth={4} color="var(--wellness)" label={`${pct}%`} fontSize={9} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.primary_goal}</p>
                        <p style={{ fontSize: 10, color: 'var(--text-3)' }}>{linkedCount} task{linkedCount === 1 ? '' : 's'} linked</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ))}
      </div>
    </div>
  )
}
