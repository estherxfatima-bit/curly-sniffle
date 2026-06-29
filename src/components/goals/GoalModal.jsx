import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { GOAL_CATEGORIES, GOAL_TIMEFRAMES, getCurrentQuarter, PRIORITY_LEVELS, PRIORITY_LABELS } from '../../lib/constants'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'
import { X, Plus, Trash2, Flag, Check } from 'lucide-react'

export default function GoalModal({
  goal, defaults, goals, onClose, onSave,
  milestones = [], onAddMilestone, onToggleMilestone, onDeleteMilestone,
}) {
  useLockBodyScroll()
  const { user } = useAuth()
  const isNew = !goal?.id
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDate, setMilestoneDate] = useState('')

  function submitMilestone() {
    if (!milestoneTitle.trim()) return
    onAddMilestone(milestoneTitle, milestoneDate)
    setMilestoneTitle('')
    setMilestoneDate('')
  }
  const [form, setForm] = useState({
    category: goal?.category || defaults?.category || GOAL_CATEGORIES[0],
    primary_goal: goal?.primary_goal || '',
    key_actions: goal?.key_actions || '',
    success_metrics: goal?.success_metrics || '',
    quarter: goal?.quarter || defaults?.quarter || getCurrentQuarter(),
    year: goal?.year || defaults?.year || new Date().getFullYear(),
    parent_goal_id: goal?.parent_goal_id || '',
    priority_level: goal?.priority_level || '',
    tracking_type: goal?.tracking_type || 'tasks',
    metric_name: goal?.metric_name || '',
    metric_start: goal?.metric_start ?? '',
    metric_target: goal?.metric_target ?? '',
    tasks: goal?.tasks || [],
  })
  const [saving, setSaving] = useState(false)
  const [newTaskText, setNewTaskText] = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function addBucketTask() {
    const text = newTaskText.trim()
    if (!text) return
    set('tasks', [...form.tasks, { id: crypto.randomUUID(), text }])
    setNewTaskText('')
  }

  function removeBucketTask(id) {
    set('tasks', form.tasks.filter(t => t.id !== id))
  }

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
      parent_goal_id: form.quarter !== 'Year' && form.parent_goal_id ? form.parent_goal_id : null,
      priority_level: form.priority_level || null,
      tracking_type: form.tracking_type,
      metric_name: form.tracking_type === 'metric' ? form.metric_name : null,
      metric_start: form.tracking_type === 'metric' && form.metric_start !== '' ? Number(form.metric_start) : null,
      metric_target: form.tracking_type === 'metric' && form.metric_target !== '' ? Number(form.metric_target) : null,
      tasks: form.tasks,
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
            <select value={form.quarter} onChange={e => set('quarter', e.target.value)}>
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
          <label>Key actions</label>
          <textarea value={form.key_actions} onChange={e => set('key_actions', e.target.value)} placeholder="The 2–3 things you need to do consistently…" style={{ minHeight: 70 }} />
        </div>
        <div className="form-group">
          <label>Success metrics</label>
          <textarea value={form.success_metrics} onChange={e => set('success_metrics', e.target.value)} placeholder="How will you know you've achieved this?" style={{ minHeight: 60 }} />
        </div>

        <div className="form-group">
          <label>Task bucket</label>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
            Tasks that lead to this goal's completion — pull them into your weekly plan or daily to-dos when you're ready to work on them.
          </p>
          {form.tasks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {form.tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2">
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)' }}>{t.text}</span>
                  <button className="btn-icon btn btn-sm" onClick={() => removeBucketTask(t.id)}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBucketTask() } }}
              placeholder="Add a task to the bucket…"
              style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
            />
            <button className="btn btn-xs btn-career" style={{ color: '#fff' }} onClick={addBucketTask}><Plus size={12} /></button>
          </div>
        </div>

        <div className="form-group">
          <label>Milestones</label>
          {isNew ? (
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
              Save this goal first, then reopen it to add milestones — they track progress more accurately than task count alone.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
                Checkpoints toward this goal. When a goal has milestones, progress is calculated from them instead of linked tasks.
              </p>
              {milestones.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                  {milestones.map(m => (
                    <div key={m.id} className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleMilestone(m)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                        title={m.complete ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {m.complete ? <Check size={12} color="var(--success)" /> : <Flag size={11} color="var(--text-3)" />}
                      </button>
                      <span style={{ flex: 1, fontSize: 12, color: m.complete ? 'var(--text-3)' : 'var(--text-2)', textDecoration: m.complete ? 'line-through' : 'none' }}>{m.title}</span>
                      {m.target_date && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>{m.target_date}</span>}
                      <button className="btn-icon btn btn-sm" onClick={() => onDeleteMilestone(m.id)}><Trash2 size={12} /></button>
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
    </div>,
    document.body
  )
}
