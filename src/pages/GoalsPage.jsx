import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { GOAL_CATEGORIES, QUARTERS, getCurrentQuarter } from '../lib/constants'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'

export default function GoalsPage() {
  const { user } = useAuth()
  const [quarter, setQuarter] = useState(getCurrentQuarter())
  const [year, setYear] = useState(new Date().getFullYear())
  const [goals, setGoals] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    if (user) { loadGoals(); loadTasks() }
  }, [user, quarter, year])

  async function loadGoals() {
    setLoading(true)
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('quarter', quarter)
      .eq('year', year)
      .order('category')
    setGoals(data || [])
    setLoading(false)
  }

  async function loadTasks() {
    const { data } = await supabase.from('weekly_tasks').select('goal_id, complete').eq('user_id', user.id)
    setTasks(data || [])
  }

  function getGoalProgress(goalId) {
    const linked = tasks.filter(t => t.goal_id === goalId)
    if (!linked.length) return null
    const done = linked.filter(t => t.complete).length
    return { done, total: linked.length, pct: Math.round((done / linked.length) * 100) }
  }

  async function deleteGoal(id) {
    if (!confirm('Delete this goal?')) return
    await supabase.from('goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  const grouped = GOAL_CATEGORIES.map(cat => ({
    cat,
    goals: goals.filter(g => g.category === cat),
  }))

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1>Quarterly Goals</h1>
            <p>Set intentions, track progress</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowModal(true) }}>
            <Plus size={14} /> Add goal
          </button>
        </div>
      </div>

      {/* Quarter selector */}
      <div className="flex items-center gap-2 mb-6">
        {QUARTERS.map(q => (
          <button
            key={q}
            onClick={() => setQuarter(q)}
            className={`btn btn-sm ${quarter === q ? 'btn-accent' : 'btn-ghost'}`}
          >
            {q}
          </button>
        ))}
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          style={{ width: 'auto', padding: '4px 10px', fontSize: '13px' }}
        >
          {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-dim" style={{ textAlign: 'center', padding: '40px' }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {grouped.map(({ cat, goals: catGoals }) => (
            <div key={cat} className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>
                  <span className="mono">{cat}</span>
                </h3>
                <button
                  className="btn-icon btn"
                  onClick={() => { setEditing({ category: cat }); setShowModal(true) }}
                >
                  <Plus size={14} />
                </button>
              </div>

              {catGoals.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic' }}>No goals for {quarter} {year}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {catGoals.map(goal => {
                    const prog = getGoalProgress(goal.id)
                    return (
                      <div key={goal.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p style={{ fontSize: '14px', fontWeight: '500', flex: 1 }}>{goal.primary_goal}</p>
                          <div className="flex items-center gap-1">
                            <button className="btn-icon btn btn-sm" onClick={() => { setEditing(goal); setShowModal(true) }}>
                              <Edit2 size={12} />
                            </button>
                            <button className="btn-icon btn btn-sm" onClick={() => deleteGoal(goal.id)}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {goal.key_actions && (
                          <div className="mb-2">
                            <p className="mono mb-1">Key actions</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.6' }}>{goal.key_actions}</p>
                          </div>
                        )}

                        {goal.success_metrics && (
                          <div className="mb-2">
                            <p className="mono mb-1">Success metrics</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.6' }}>{goal.success_metrics}</p>
                          </div>
                        )}

                        {prog && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="mono">Progress</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>{prog.done}/{prog.total} tasks</span>
                            </div>
                            <div className="progress-bar">
                              <div className="progress-fill progress-fill-accent" style={{ width: `${prog.pct}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <GoalModal
          goal={editing}
          quarter={quarter}
          year={year}
          onClose={() => setShowModal(false)}
          onSave={(goal) => {
            setGoals(prev => {
              const idx = prev.findIndex(g => g.id === goal.id)
              if (idx >= 0) { const n = [...prev]; n[idx] = goal; return n }
              return [...prev, goal]
            })
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}

function GoalModal({ goal, quarter, year, onClose, onSave }) {
  const { user } = useAuth()
  const isNew = !goal?.id
  const [form, setForm] = useState({
    category: goal?.category || GOAL_CATEGORIES[0],
    primary_goal: goal?.primary_goal || '',
    key_actions: goal?.key_actions || '',
    success_metrics: goal?.success_metrics || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function save() {
    if (!form.primary_goal.trim()) return
    setSaving(true)
    const payload = { ...form, user_id: user.id, quarter, year }
    const { data, error } = isNew
      ? await supabase.from('goals').insert(payload).select().single()
      : await supabase.from('goals').update(form).eq('id', goal.id).select().single()
    setSaving(false)
    if (!error) onSave(data)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 style={{ fontSize: '1.2rem' }}>{isNew ? 'Add goal' : 'Edit goal'}</h2>
          <button className="btn-icon btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="form-group">
          <label>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}>
            {GOAL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Primary goal</label>
          <input value={form.primary_goal} onChange={e => set('primary_goal', e.target.value)} placeholder="What do you want to achieve this quarter?" />
        </div>

        <div className="form-group">
          <label>Key actions</label>
          <textarea value={form.key_actions} onChange={e => set('key_actions', e.target.value)} placeholder="The 2-3 things you need to do consistently to achieve this…" style={{ minHeight: '70px' }} />
        </div>

        <div className="form-group">
          <label>Success metrics</label>
          <textarea value={form.success_metrics} onChange={e => set('success_metrics', e.target.value)} placeholder="How will you know you've achieved this?" style={{ minHeight: '60px' }} />
        </div>

        <div className="flex gap-2 justify-end">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add goal' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
