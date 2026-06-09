import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { generateWeeklyReviewSummary } from '../../lib/aiLog'
import { X } from 'lucide-react'

export default function WeeklyReviewModal({ weekStart, incompleteTasks, onClose, onComplete }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ shipped: '', didnt_ship: '', energy_level: 3, one_win: '', one_to_drop: '' })
  const [saving, setSaving] = useState(false)
  const [summary, setSummary] = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function submit() {
    setSaving(true)
    try {
      const aiSummary = await generateWeeklyReviewSummary(user.id, {
        shipped: form.shipped,
        didntShip: form.didnt_ship,
        energyLevel: form.energy_level,
        oneWin: form.one_win,
        oneToDrop: form.one_to_drop,
      }).catch(() => 'Summary unavailable — Claude API key not configured.')

      await supabase.from('weekly_reviews').insert({
        user_id: user.id,
        week_start: weekStart,
        shipped: form.shipped,
        didnt_ship: form.didnt_ship,
        energy_level: form.energy_level,
        one_win: form.one_win,
        one_to_drop: form.one_to_drop,
        ai_summary: aiSummary,
      })
      setSummary(aiSummary)
      if (onComplete) onComplete()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.2rem' }}>End-of-week review</h2>
          <button className="btn-icon btn" onClick={onClose}><X size={16} /></button>
        </div>

        {summary ? (
          <div>
            <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '20px', borderLeft: '3px solid var(--accent)' }}>
              <p className="mono mb-2" style={{ color: 'var(--accent)' }}>AI summary</p>
              <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text-2)' }}>{summary}</p>
            </div>
            {incompleteTasks.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <p className="mono mb-2">{incompleteTasks.length} incomplete tasks have been carried forward</p>
              </div>
            )}
            <button className="btn btn-primary w-full" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label>What shipped this week?</label>
              <textarea value={form.shipped} onChange={e => set('shipped', e.target.value)} placeholder="What you actually completed and shipped…" />
            </div>

            <div className="form-group">
              <label>What didn't ship, and why?</label>
              <textarea value={form.didnt_ship} onChange={e => set('didnt_ship', e.target.value)} placeholder="What got stuck, what you avoided, what blocked you…" />
            </div>

            <div className="form-group">
              <label>Energy level — {form.energy_level}/5</label>
              <input type="range" min={1} max={5} value={form.energy_level} onChange={e => set('energy_level', Number(e.target.value))} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                <span>Depleted</span><span>Energised</span>
              </div>
            </div>

            <div className="form-group">
              <label>One win</label>
              <input value={form.one_win} onChange={e => set('one_win', e.target.value)} placeholder="The thing you're most proud of this week" />
            </div>

            <div className="form-group">
              <label>One thing to drop</label>
              <input value={form.one_to_drop} onChange={e => set('one_to_drop', e.target.value)} placeholder="Something to stop doing, or let go of" />
            </div>

            {incompleteTasks.length > 0 && (
              <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: '16px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                  {incompleteTasks.length} incomplete tasks will be carried to next week automatically on submit.
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-accent" onClick={submit} disabled={saving}>
                {saving ? 'Saving…' : 'Submit review'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
