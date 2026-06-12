import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { GOAL_CATEGORIES, QUARTERS, getCurrentQuarter } from '../../lib/constants'
import { X } from 'lucide-react'

export default function GoalModal({ goal, defaults, onClose, onSave }) {
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
