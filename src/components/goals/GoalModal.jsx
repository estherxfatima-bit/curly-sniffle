import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { GOAL_CATEGORIES, GOAL_TIMEFRAMES, getCurrentQuarter, PRIORITY_LEVELS, PRIORITY_LABELS, QUARTERLY_TRACKING_TYPES, YEARLY_TRACKING_TYPES, TRACKING_TYPE_LABELS } from '../../lib/constants'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'
import { X, Plus, Trash2, Check, Circle } from 'lucide-react'

export default function GoalModal({
  goal, defaults, goals, onClose, onSave,
  milestones = [], onAddMilestone, onToggleMilestone, onDeleteMilestone,
  onAddMilestoneTask, onToggleMilestoneTask, onDeleteMilestoneTask,
}) {
  useLockBodyScroll()
  const { user } = useAuth()
  const isNew = !goal?.id
  const isYearly = (goal?.quarter || defaults?.quarter || getCurrentQuarter()) === 'Year'
  const trackingOptions = isYearly ? YEARLY_TRACKING_TYPES : QUARTERLY_TRACKING_TYPES

  const [form, setForm] = useState({
    category: goal?.category || defaults?.category || GOAL_CATEGORIES[0],
    primary_goal: goal?.primary_goal || '',
    description: goal?.description || '',
    key_actions: goal?.key_actions || '',
    success_metrics: goal?.success_metrics || '',
    quarter: goal?.quarter || defaults?.quarter || getCurrentQuarter(),
    year: goal?.year || defaults?.year || new Date().getFullYear(),
    parent_goal_id: goal?.parent_goal_id || '',
    priority_level: goal?.priority_level || '',
    tracking_type: goal?.tracking_type || (isYearly ? 'theme' : 'milestone'),
    metric_current: goal?.metric_current ?? '',
    metric_target: goal?.metric_target ?? '',
    metric_unit: goal?.metric_unit || '',
  })
  const [saving, setSaving] = useState(false)
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDate, setMilestoneDate] = useState('')
  const [taskText, setTaskText] = useState({}) // milestoneId -> draft text
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function submitMilestone() {
    if (!milestoneTitle.trim()) return
    onAddMilestone(milestoneTitle, milestoneDate)
    setMilestoneTitle('')
    setMilestoneDate('')
  }

  function submitTask(milestoneId) {
    const text = (taskText[milestoneId] || '').trim()
    if (!text) return
    onAddMilestoneTask(milestoneId, text)
    setTaskText(p => ({ ...p, [milestoneId]: '' }))
  }

  async function save() {
    if (!form.primary_goal.trim()) return
    setSaving(true)
    const level = form.quarter === 'Year' ? 'yearly' : 'quarterly'
    const payload = {
      category: form.category,
      primary_goal: form.primary_goal,
      description: form.description || null,
      key_actions: form.key_actions,
      success_metrics: form.success_metrics,
      quarter: form.quarter,
      year: Number(form.year),
      level,
      parent_goal_id: form.quarter !== 'Year' && form.parent_goal_id ? form.parent_goal_id : null,
      priority_level: form.priority_level || null,
      tracking_type: form.tracking_type,
      metric_current: form.tracking_type === 'metric' && form.metric_current !== '' ? Number(form.metric_current) : null,
      metric_target: form.tracking_type === 'metric' && form.metric_target !== '' ? Number(form.metric_target) : null,
      metric_unit: form.tracking_type === 'metric' ? form.metric_unit : null,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = isNew
      ? await supabase.from('goals').insert({ ...payload, user_id: user.id }).select().single()
      : await supabase.from('goals').update(payload).eq('id', goal.id).select().single()
    setSaving(false)
    if (!error) onSave(data)
  }

  return createPortal(
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
            <label>Timeframe</label>
            <select
              value={form.quarter}
              onChange={e => {
                const q = e.target.value
                const nowYearly = q === 'Year'
                set('quarter', q)
                set('tracking_type', nowYearly ? 'theme' : 'milestone')
              }}
            >
              {GOAL_TIMEFRAMES.map(q => <option key={q} value={q}>{q === 'Year' ? 'Year (whole year)' : q}</option>)}
            </select>
          </div>
        </div>

        {form.quarter !== 'Year' && (
          <div className="form-group">
            <label>Break down from yearly goal</label>
            <select value={form.parent_goal_id} onChange={e => set('parent_goal_id', e.target.value)}>
              <option value="">None</option>
              {(goals || [])
                .filter(g => g.quarter === 'Year' && g.year === Number(form.year) && g.id !== goal?.id)
                .map(g => <option key={g.id} value={g.id}>{g.primary_goal}</option>)}
            </select>
          </div>
        )}

        <div className="form-group">
          <label>Priority</label>
          <select value={form.priority_level} onChange={e => set('priority_level', e.target.value)}>
            <option value="">No priority</option>
            {PRIORITY_LEVELS.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
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
          <label>Description <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: 11 }}>(optional — context, motivation, or notes)</span></label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Why does this goal matter? Any extra context…" style={{ minHeight: 60 }} />
        </div>
        <div className="form-group">
          <label>Key actions <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: 11 }}>(shown on the goal card)</span></label>
          <textarea value={form.key_actions} onChange={e => set('key_actions', e.target.value)} placeholder="The 2–3 things you need to do consistently…" style={{ minHeight: 70 }} />
        </div>
        <div className="form-group">
          <label>Done when</label>
          <textarea value={form.success_metrics} onChange={e => set('success_metrics', e.target.value)} placeholder="How will you know you've achieved this? (descriptive only — doesn't drive progress)" style={{ minHeight: 50 }} />
        </div>

        <div className="form-group">
          <label>Tracking</label>
          <div className="flex gap-2">
            {trackingOptions.map(t => (
              <button
                key={t}
                type="button"
                className={`btn btn-sm ${form.tracking_type === t ? '' : 'btn-ghost'}`}
                style={form.tracking_type === t ? { background: 'var(--career)', color: '#fff', border: 'none' } : {}}
                onClick={() => set('tracking_type', t)}
              >
                {TRACKING_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {form.tracking_type === 'metric' && (
          <>
            <div className="flex gap-2">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Current value</label>
                <input type="number" value={form.metric_current} onChange={e => set('metric_current', e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Target value</label>
                <input type="number" value={form.metric_target} onChange={e => set('metric_target', e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Unit</label>
                <input value={form.metric_unit} onChange={e => set('metric_unit', e.target.value)} placeholder="£" />
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: -8, marginBottom: 12 }}>
              Going over target is fine — progress can exceed 100%.
            </p>
          </>
        )}

        {form.tracking_type === 'milestone' && (
          <div className="form-group">
            <label>Milestones</label>
            {isNew ? (
              <p style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
                Save this goal first, then reopen it to add milestones.
              </p>
            ) : (
              <>
                {milestones.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
                    {milestones.map(m => (
                      <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onToggleMilestone(m)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                          >
                            {m.complete ? <Check size={12} color="var(--success)" /> : <Circle size={11} color="var(--text-3)" />}
                          </button>
                          <span style={{ flex: 1, fontSize: 12, color: m.complete ? 'var(--text-3)' : 'var(--text-2)', textDecoration: m.complete ? 'line-through' : 'none' }}>{m.title}</span>
                          <button className="btn-icon btn btn-sm" onClick={() => onDeleteMilestone(m.id)}><Trash2 size={12} /></button>
                        </div>
                        {(m.tasks || []).length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, paddingLeft: 18 }}>
                            {m.tasks.map(t => (
                              <div key={t.id} className="flex items-center gap-2">
                                <button
                                  onClick={() => onToggleMilestoneTask(t)}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                                >
                                  {t.complete ? <Check size={10} color="var(--success)" /> : <Circle size={9} color="var(--text-3)" />}
                                </button>
                                <span style={{ flex: 1, fontSize: 11, color: t.complete ? 'var(--text-3)' : 'var(--text-2)', textDecoration: t.complete ? 'line-through' : 'none' }}>{t.text}</span>
                                <button className="btn-icon btn btn-xs" onClick={() => onDeleteMilestoneTask(t.id)}><Trash2 size={10} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2" style={{ marginTop: 6, paddingLeft: 18 }}>
                          <input
                            value={taskText[m.id] || ''}
                            onChange={e => setTaskText(p => ({ ...p, [m.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitTask(m.id) } }}
                            placeholder="Add a task…"
                            style={{ flex: 1, fontSize: 11, padding: '3px 6px' }}
                          />
                          <button className="btn btn-xs btn-ghost" onClick={() => submitTask(m.id)}><Plus size={11} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 wrap">
                  <input
                    value={milestoneTitle}
                    onChange={e => setMilestoneTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitMilestone() } }}
                    placeholder="Add a milestone…"
                    style={{ flex: 1, fontSize: 12, padding: '4px 8px', minWidth: 120 }}
                  />
                  <input
                    type="date"
                    value={milestoneDate}
                    onChange={e => setMilestoneDate(e.target.value)}
                    style={{ fontSize: 12, padding: '4px 8px' }}
                  />
                  <button className="btn btn-xs btn-career" style={{ color: '#fff' }} onClick={submitMilestone}><Plus size={12} /></button>
                </div>
              </>
            )}
          </div>
        )}

        {form.tracking_type === 'theme' && (
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>
            Theme goals have no fixed percentage — progress is "X of Y" quarterly goals completed, linked via their own "Break down from yearly goal" field. Link them from the quarterly goal's edit modal.
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-career" style={{ color: '#fff' }} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add goal' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
