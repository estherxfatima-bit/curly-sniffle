import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { DAY_NAMES } from '../../lib/habitUtils'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

const EMOJI_OPTIONS = ['💪','📚','🧘','🏃','✍️','🎯','💧','🌿','🎨','🧠','😴','🥗','💊','🎵','🌅','🛁','🧴','🫧']

const COLOR_OPTIONS = [
  { name: 'Rose',   value: '#d4506a' },
  { name: 'Blue',   value: '#4a7bd4' },
  { name: 'Pink',   value: '#d4509e' },
  { name: 'Purple', value: '#8a5cd4' },
  { name: 'Orange', value: '#d48a40' },
  { name: 'Green',  value: '#4ba87a' },
]

const TIME_OF_DAY_OPTIONS = [
  { value: 'am', label: 'AM' },
  { value: 'anytime', label: 'Anytime' },
  { value: 'pm', label: 'PM' },
]

export default function HabitModal({ habit, onClose, onSave }) {
  useLockBodyScroll()
  const isNew = !habit?.id
  const [form, setForm] = useState({
    name: habit?.name || '',
    emoji: habit?.emoji || '💪',
    frequency_type: habit?.frequency_type || 'daily',
    frequency_days: habit?.frequency_days || [],
    frequency_count: habit?.frequency_count || 3,
    color: habit?.color || '',
    time_of_day: habit?.time_of_day || 'anytime',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function toggleDay(day) {
    setForm(p => ({
      ...p,
      frequency_days: p.frequency_days.includes(day) ? p.frequency_days.filter(d => d !== day) : [...p.frequency_days, day],
    }))
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    await onSave({
      name: form.name.trim(),
      emoji: form.emoji,
      frequency_type: form.frequency_type,
      frequency_days: form.frequency_type === 'specific_days' ? form.frequency_days : [],
      frequency_count: form.frequency_type === 'times_per_week' ? Number(form.frequency_count) : null,
      color: form.color || null,
      time_of_day: form.time_of_day,
    })
    setSaving(false)
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal scale-in" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.3rem' }}>{isNew ? 'Add habit' : 'Edit habit'}</h2>
          <button className="btn-icon btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <select value={form.emoji} onChange={e => set('emoji', e.target.value)} style={{ padding: '7px 10px', width: 'auto', fontSize: 18 }}>
            {EMOJI_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Habit name…" style={{ flex: 1 }} autoFocus onKeyDown={e => e.key === 'Enter' && save()} />
        </div>

        <div className="form-group">
          <label>Frequency</label>
          <select value={form.frequency_type} onChange={e => set('frequency_type', e.target.value)}>
            <option value="daily">Daily</option>
            <option value="specific_days">Specific days</option>
            <option value="times_per_week">X times per week</option>
          </select>
        </div>

        {form.frequency_type === 'specific_days' && (
          <div className="form-group">
            <label>Days</label>
            <div className="flex items-center gap-2 wrap">
              {DAY_NAMES.map(day => (
                <button
                  key={day}
                  type="button"
                  className={`btn btn-xs ${form.frequency_days.includes(day) ? 'btn-personal' : 'btn-ghost'}`}
                  style={form.frequency_days.includes(day) ? { color: '#fff' } : {}}
                  onClick={() => toggleDay(day)}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}

        {form.frequency_type === 'times_per_week' && (
          <div className="form-group">
            <label>Times per week</label>
            <select value={form.frequency_count} onChange={e => set('frequency_count', e.target.value)}>
              {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}

        <div className="form-group">
          <label>When</label>
          <div className="flex items-center gap-2 wrap">
            {TIME_OF_DAY_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                className={`btn btn-xs ${form.time_of_day === o.value ? 'btn-accent' : 'btn-ghost'}`}
                onClick={() => set('time_of_day', o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Colour</label>
          <div className="flex items-center gap-2 wrap">
            {COLOR_OPTIONS.map(c => (
              <button
                key={c.value}
                type="button"
                title={c.name}
                onClick={() => set('color', c.value)}
                style={{
                  width: 24, height: 24, borderRadius: '50%', background: c.value,
                  border: form.color === c.value ? '2px solid var(--text)' : '2px solid transparent',
                  cursor: 'pointer', padding: 0,
                }}
              />
            ))}
            <button
              type="button"
              title="Default"
              onClick={() => set('color', '')}
              style={{
                width: 24, height: 24, borderRadius: '50%', background: 'var(--personal)',
                border: !form.color ? '2px solid var(--text)' : '2px solid transparent',
                cursor: 'pointer', padding: 0,
              }}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-personal" style={{ color: '#fff' }} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add habit' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
