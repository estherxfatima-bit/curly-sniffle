import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { GOAL_CATEGORIES, QUARTERS, getCurrentQuarter } from '../lib/constants'
import { Plus, Edit2, Trash2, X } from 'lucide-react'
import ArcRing from '../components/ui/ArcRing'
import QuarterlyWins from '../components/goals/QuarterlyWins'
import IdeaParkingLot from '../components/goals/IdeaParkingLot'

const CATEGORY_COLORS = {
  Career:    'var(--career)',
  Creative:  'var(--creative)',
  Financial: 'var(--finance)',
  Personal:  'var(--personal)',
}
const CATEGORY_CLASSES = {
  Career:    'card-career',
  Creative:  'card-creative',
  Financial: 'card-finance',
  Personal:  'card-personal',
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
  const [quarter, setQuarter] = useState(getCurrentQuarter())
  const [year, setYear] = useState(new Date().getFullYear())
  const [goals, setGoals] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => { if (user) { loadGoals(); loadTasks() } }, [user, quarter, year])

  async function loadGoals() {
    setLoading(true)
    const { data } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('quarter', quarter).eq('year', year).order('category')
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

  return (
    <div>
      <div className="page-header header-career mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>Quarterly Goals</h1>
            <p>Set intentions, track progress</p>
          </div>
          <button className="btn btn-career btn-sm" style={{ color: '#fff', flexShrink: 0 }} onClick={() => { setEditing(null); setShowModal(true) }}>
            <Plus size={14} /> Add goal
          </button>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--career)' }}><GoalsDecoration /></div>
      </div>

      {/* Quarter selector */}
      <div className="flex items-center gap-2 mb-6 wrap">
        {QUARTERS.map(q => (
          <button key={q} onClick={() => setQuarter(q)} className={`btn btn-sm ${quarter === q ? 'btn-career' : 'btn-ghost'}`} style={quarter === q ? { color: '#fff' } : {}}>
            {q}
          </button>
        ))}
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 'auto', padding: '5px 12px', fontSize: 13 }}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading…</p>
      ) : (
        <div className="grid-2">
          {GOAL_CATEGORIES.map(cat => {
            const catGoals = goals.filter(g => g.category === cat)
            const color = CATEGORY_COLORS[cat]
            const cardClass = CATEGORY_CLASSES[cat]
            return (
              <div key={cat} className={`card ${cardClass}`}>
                <div className="flex items-center justify-between mb-5">
                  <h3 style={{ color }}>{cat}</h3>
                  <button className="btn-icon btn" onClick={() => { setEditing({ category: cat }); setShowModal(true) }} style={{ color }}>
                    <Plus size={15} />
                  </button>
                </div>

                {catGoals.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No {cat.toLowerCase()} goals for {quarter} {year}</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {catGoals.map(goal => {
                      const prog = getGoalProgress(goal.id)
                      return (
                        <div key={goal.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <p style={{ fontSize: 14, fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{goal.primary_goal}</p>
                            <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                              {prog && <ArcRing value={prog.pct} max={100} size={44} strokeWidth={4} color={color} label={`${prog.pct}%`} fontSize={9} />}
                              <button className="btn-icon btn btn-sm" onClick={() => { setEditing(goal); setShowModal(true) }}><Edit2 size={12} /></button>
                              <button className="btn-icon btn btn-sm" onClick={() => deleteGoal(goal.id)}><Trash2 size={12} /></button>
                            </div>
                          </div>
                          {goal.key_actions && (
                            <div className="mb-2">
                              <p className="mono mb-1">Key actions</p>
                              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{goal.key_actions}</p>
                            </div>
                          )}
                          {goal.success_metrics && (
                            <div>
                              <p className="mono mb-1">Success metrics</p>
                              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{goal.success_metrics}</p>
                            </div>
                          )}
                          {prog && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>{prog.done}/{prog.total} linked tasks complete</p>}
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
        <QuarterlyWins quarter={`${quarter} ${year}`} />
        <IdeaParkingLot />
      </div>

      {showModal && (
        <GoalModal goal={editing} quarter={quarter} year={year} onClose={() => setShowModal(false)}
          onSave={goal => {
            setGoals(prev => { const idx = prev.findIndex(g => g.id === goal.id); if (idx >= 0) { const n = [...prev]; n[idx] = goal; return n } return [...prev, goal] })
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
  const [form, setForm] = useState({ category: goal?.category || GOAL_CATEGORIES[0], primary_goal: goal?.primary_goal || '', key_actions: goal?.key_actions || '', success_metrics: goal?.success_metrics || '' })
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
      <div className="modal scale-in">
        <div className="modal-header">
          <h2 style={{ fontSize: '1.3rem' }}>{isNew ? 'Add goal' : 'Edit goal'}</h2>
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
          <textarea value={form.key_actions} onChange={e => set('key_actions', e.target.value)} placeholder="The 2–3 things you need to do consistently…" style={{ minHeight: 70 }} />
        </div>
        <div className="form-group">
          <label>Success metrics</label>
          <textarea value={form.success_metrics} onChange={e => set('success_metrics', e.target.value)} placeholder="How will you know you've achieved this?" style={{ minHeight: 60 }} />
        </div>
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
