import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { GOAL_CATEGORIES, QUARTERS, getCurrentQuarter } from '../lib/constants'
import { Plus, X, ChevronDown, ChevronRight } from 'lucide-react'
import QuarterlyWins from '../components/goals/QuarterlyWins'
import IdeaParkingLot from '../components/goals/IdeaParkingLot'
import GoalCard from '../components/goals/GoalCard'

const CATEGORY_COLORS = {
  Career:    'var(--career)',
  Creative:  'var(--creative)',
  Financial: 'var(--finance)',
  Personal:  'var(--personal)',
  Wellness:  'var(--wellness)',
}
const CATEGORY_CLASSES = {
  Career:    'card-career',
  Creative:  'card-creative',
  Financial: 'card-finance',
  Personal:  'card-personal',
  Wellness:  'card-wellness',
}

function GoalsDecoration() {
  return (
    <svg width="100" height="70" viewBox="0 0 100 70" fill="none">
      <circle cx="70" cy="35" r="28" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
      <circle cx="70" cy="35" r="18" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <circle cx="70" cy="35" r="6" fill="currentColor" opacity="0.15"/>
      <line x1="10" y1="35" x2="42" y2="35" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
      <circle cx="10" cy="35" r="3" fill="currentColor" opacity="0.3"/>
    </svg>
  )
}

export default function GoalsPage() {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [weeklyTasks, setWeeklyTasks] = useState([])
  const [dailyTodos, setDailyTodos] = useState([])
  const [metrics, setMetrics] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [createCtx, setCreateCtx] = useState(null) // { year, quarter, category }

  const currentYear = new Date().getFullYear()
  const currentQuarter = getCurrentQuarter()

  const [expandedYears, setExpandedYears] = useState(() => new Set([currentYear]))
  const [expandedQuarters, setExpandedQuarters] = useState(() => new Set([`${currentYear}-${currentQuarter}`]))

  useEffect(() => { if (user) loadAll() }, [user])

  async function loadAll() {
    setLoading(true)
    const [goalsRes, weeklyRes, dailyRes, metricsRes] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', user.id).order('year', { ascending: false }).order('quarter').order('category'),
      supabase.from('weekly_tasks').select('id, goal_id, area, specific_task, complete').eq('user_id', user.id).not('goal_id', 'is', null),
      supabase.from('daily_todos').select('id, goal_id, category, text, complete').eq('user_id', user.id).not('goal_id', 'is', null),
      supabase.from('goal_metrics').select('*').eq('user_id', user.id).order('recorded_at'),
    ])
    setGoals(goalsRes.data || [])
    setWeeklyTasks(weeklyRes.data || [])
    setDailyTodos(dailyRes.data || [])
    setMetrics(metricsRes.data || [])
    setLoading(false)
  }

  function toggleYear(year) {
    setExpandedYears(prev => {
      const next = new Set(prev)
      next.has(year) ? next.delete(year) : next.add(year)
      return next
    })
  }

  function toggleQuarter(key) {
    setExpandedQuarters(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function deleteGoal(id) {
    if (!confirm('Delete this goal?')) return
    await supabase.from('goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
    setMetrics(prev => prev.filter(m => m.goal_id !== id))
  }

  async function addMetric(goal, value) {
    const { data } = await supabase.from('goal_metrics').insert({
      goal_id: goal.id, user_id: user.id, value,
    }).select().single()
    if (data) setMetrics(prev => [...prev, data])
    await supabase.from('goals').update({ updated_at: new Date().toISOString() }).eq('id', goal.id)
    setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, updated_at: new Date().toISOString() } : g))
  }

  function linkedTasksFor(goalId) {
    return [
      ...weeklyTasks.filter(t => t.goal_id === goalId).map(t => ({ text: t.specific_task, complete: t.complete, area: t.area })),
      ...dailyTodos.filter(t => t.goal_id === goalId).map(t => ({ text: t.text, complete: t.complete, area: t.category })),
    ]
  }

  // Group goals: year -> quarter -> category
  const years = [...new Set(goals.map(g => g.year))].sort((a, b) => b - a)
  if (!years.includes(currentYear)) years.unshift(currentYear)
  years.sort((a, b) => b - a)

  return (
    <div>
      <div className="page-header header-career mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>Goals</h1>
            <p>Year → quarter → progress, all in one place</p>
          </div>
          <button className="btn btn-career btn-sm" style={{ color: '#fff', flexShrink: 0 }} onClick={() => { setEditing(null); setCreateCtx({ year: currentYear, quarter: currentQuarter, category: GOAL_CATEGORIES[0] }); setShowModal(true) }}>
            <Plus size={14} /> Add goal
          </button>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--career)' }}><GoalsDecoration /></div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {years.map(year => {
            const yearGoals = goals.filter(g => g.year === year)
            const isOpen = expandedYears.has(year)
            return (
              <div key={year} className="card">
                <button
                  onClick={() => toggleYear(year)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <h2 style={{ fontSize: '1.2rem' }}>{year}</h2>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{yearGoals.length} goal{yearGoals.length === 1 ? '' : 's'}</span>
                </button>

                {isOpen && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {QUARTERS.map(q => {
                      const qGoals = yearGoals.filter(g => g.quarter === q)
                      const key = `${year}-${q}`
                      const qOpen = expandedQuarters.has(key)
                      return (
                        <div key={q} style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                          <button
                            onClick={() => toggleQuarter(key)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                          >
                            <div className="flex items-center gap-2">
                              {qOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              <h3 style={{ fontSize: '0.95rem' }}>{q} {year}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>{qGoals.length} goal{qGoals.length === 1 ? '' : 's'}</span>
                              <button
                                className="btn-icon btn btn-sm"
                                onClick={e => { e.stopPropagation(); setEditing(null); setCreateCtx({ year, quarter: q, category: GOAL_CATEGORIES[0] }); setShowModal(true) }}
                                title={`Add goal for ${q} ${year}`}
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </button>

                          {qOpen && (
                            qGoals.length === 0 ? (
                              <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', marginTop: 12 }}>No goals for {q} {year}.</p>
                            ) : (
                              <div className="grid-2 mt-3">
                                {GOAL_CATEGORIES.map(cat => {
                                  const catGoals = qGoals.filter(g => g.category === cat)
                                  if (catGoals.length === 0) return null
                                  const color = CATEGORY_COLORS[cat]
                                  const cardClass = CATEGORY_CLASSES[cat]
                                  return (
                                    <div key={cat} className={`card ${cardClass}`}>
                                      <h3 className="mb-4" style={{ color }}>{cat}</h3>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                        {catGoals.map(goal => (
                                          <GoalCard
                                            key={goal.id}
                                            goal={goal}
                                            color={color}
                                            linkedTasks={linkedTasksFor(goal.id)}
                                            metricHistory={metrics.filter(m => m.goal_id === goal.id)}
                                            onEdit={g => { setEditing(g); setCreateCtx(null); setShowModal(true) }}
                                            onDelete={deleteGoal}
                                            onAddMetric={addMetric}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="grid-2 mt-6">
        <QuarterlyWins quarter={`${currentQuarter} ${currentYear}`} />
        <IdeaParkingLot />
      </div>

      {showModal && (
        <GoalModal
          goal={editing}
          defaults={createCtx}
          onClose={() => setShowModal(false)}
          onSave={goal => {
            setGoals(prev => { const idx = prev.findIndex(g => g.id === goal.id); if (idx >= 0) { const n = [...prev]; n[idx] = goal; return n } return [...prev, goal] })
            setExpandedYears(prev => new Set(prev).add(goal.year))
            setExpandedQuarters(prev => new Set(prev).add(`${goal.year}-${goal.quarter}`))
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}

function GoalModal({ goal, defaults, onClose, onSave }) {
  const { user } = useAuth()
  const isNew = !goal?.id
  const [form, setForm] = useState({
    category: goal?.category || defaults?.category || GOAL_CATEGORIES[0],
    primary_goal: goal?.primary_goal || '',
    key_actions: goal?.key_actions || '',
    success_metrics: goal?.success_metrics || '',
    quarter: goal?.quarter || defaults?.quarter || getCurrentQuarter(),
    year: goal?.year || defaults?.year || new Date().getFullYear(),
    tracking_type: goal?.tracking_type || 'tasks',
    metric_name: goal?.metric_name || '',
    metric_start: goal?.metric_start ?? '',
    metric_target: goal?.metric_target ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function save() {
    if (!form.primary_goal.trim()) return
    setSaving(true)
    const payload = {
      category: form.category,
      primary_goal: form.primary_goal,
      key_actions: form.key_actions,
      success_metrics: form.success_metrics,
      quarter: form.quarter,
      year: Number(form.year),
      tracking_type: form.tracking_type,
      metric_name: form.tracking_type === 'metric' ? form.metric_name : null,
      metric_start: form.tracking_type === 'metric' && form.metric_start !== '' ? Number(form.metric_start) : null,
      metric_target: form.tracking_type === 'metric' && form.metric_target !== '' ? Number(form.metric_target) : null,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = isNew
      ? await supabase.from('goals').insert({ ...payload, user_id: user.id }).select().single()
      : await supabase.from('goals').update(payload).eq('id', goal.id).select().single()
    setSaving(false)
    if (!error) onSave(data)
  }

  return (
    <div className="modal-overlay">
      <div className="modal scale-in">
        <div className="modal-header">
          <h2 style={{ fontSize: '1.3rem' }}>{isNew ? 'Add goal' : 'Edit goal'}</h2>
          <button className="btn-icon btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="flex gap-2 mb-1">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Year</label>
            <input type="number" value={form.year} onChange={e => set('year', e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Quarter</label>
            <select value={form.quarter} onChange={e => set('quarter', e.target.value)}>
              {QUARTERS.map(q => <option key={q}>{q}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}>
            {GOAL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Primary goal</label>
          <input value={form.primary_goal} onChange={e => set('primary_goal', e.target.value)} placeholder="What do you want to achieve?" />
        </div>
        <div className="form-group">
          <label>Key actions</label>
          <textarea value={form.key_actions} onChange={e => set('key_actions', e.target.value)} placeholder="The 2–3 things you need to do consistently…" style={{ minHeight: 70 }} />
        </div>
        <div className="form-group">
          <label>Success metrics</label>
          <textarea value={form.success_metrics} onChange={e => set('success_metrics', e.target.value)} placeholder="How will you know you've achieved this?" style={{ minHeight: 60 }} />
        </div>

        <div className="form-group">
          <label>Tracking</label>
          <select value={form.tracking_type} onChange={e => set('tracking_type', e.target.value)}>
            <option value="tasks">Task completion — link weekly tasks / to-dos</option>
            <option value="metric">Manual metric — track a number over time</option>
          </select>
        </div>

        {form.tracking_type === 'metric' && (
          <>
            <div className="form-group">
              <label>Metric name</label>
              <input value={form.metric_name} onChange={e => set('metric_name', e.target.value)} placeholder="e.g. TikTok followers, Self-employed income £" />
            </div>
            <div className="flex gap-2">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Start value</label>
                <input type="number" value={form.metric_start} onChange={e => set('metric_start', e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Target value</label>
                <input type="number" value={form.metric_target} onChange={e => set('metric_target', e.target.value)} />
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2 justify-end">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-career" style={{ color: '#fff' }} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add goal' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
