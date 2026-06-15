import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Edit2, Check, X } from 'lucide-react'
import { AFFIRMATIONS } from '../../lib/affirmations'

function getRotation(dateStr) {
  // Pick a consistent affirmation per day based on day number
  const d = new Date(dateStr)
  const dayNum = Math.floor(d.getTime() / (24 * 60 * 60 * 1000))
  return AFFIRMATIONS[dayNum % AFFIRMATIONS.length]
}

export default function DailyQuote({ userId, date, savedQuote, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const displayQuote = savedQuote || getRotation(date)
  const isCustom = !!savedQuote

  async function save() {
    const text = draft.trim()
    if (!text) return
    await supabase.from('daily_quotes').upsert(
      { user_id: userId, log_date: date, quote: text },
      { onConflict: 'user_id,log_date' }
    )
    onSave(text)
    setEditing(false)
  }

  async function clearCustom() {
    await supabase.from('daily_quotes').delete()
      .eq('user_id', userId).eq('log_date', date)
    onSave(null)
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Your intention or quote for today…"
          style={{ minHeight: 80, fontSize: 15, fontStyle: 'italic', lineHeight: 1.6 }}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) save() }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm btn-career" style={{ color: '#fff' }} onClick={save}>
            <Check size={12} /> Save
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
            <X size={12} /> Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', textAlign: 'center', padding: '8px 32px' }}>
      <p style={{
        fontFamily: "'Lora', Georgia, serif",
        fontStyle: 'italic',
        fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
        fontWeight: 400,
        lineHeight: 1.65,
        color: 'var(--text-2)',
        letterSpacing: '0.005em',
      }}>
        "{displayQuote}"
      </p>
      {!isCustom && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', marginTop: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Daily rotation · set your own below
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
        <button
          className="btn btn-xs btn-ghost"
          onClick={() => { setDraft(savedQuote || ''); setEditing(true) }}
        >
          <Edit2 size={10} /> {isCustom ? 'Edit' : 'Set my own'}
        </button>
        {isCustom && (
          <button className="btn btn-xs btn-ghost" onClick={clearCustom} style={{ color: 'var(--text-3)' }}>
            Reset to rotation
          </button>
        )}
      </div>
    </div>
  )
}
