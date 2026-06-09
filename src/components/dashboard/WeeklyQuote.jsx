import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Edit2, Check, X } from 'lucide-react'

// Considered, specific affirmations — not motivational-poster energy
const AFFIRMATIONS = [
  "The gap between where you are and where you want to be is just time and iteration.",
  "Done is infinitely more useful than perfect. Finish the thing, then make it better.",
  "Your best work comes from building habits, not waiting for inspiration.",
  "Constraints are a creative gift. Work within them before trying to escape them.",
  "The people you most admire also had weeks where nothing went to plan.",
  "Rest is part of the work. Protecting your energy is not laziness.",
  "One good decision made consistently beats ten perfect plans made once.",
  "You don't need permission to start, only the willingness to begin badly.",
  "Your future self will thank you for the 20-minute version you actually did.",
  "What you repeatedly do is what you become. Small actions compound.",
  "Clarity comes from action, not from more planning.",
  "The work that matters most is often the work that feels hardest to start.",
  "A slow week is not a failed week. Pace is part of the process.",
  "Say no to the good things so you have space for the right things.",
  "You are not behind. You are exactly where your choices have brought you — and you can choose again.",
  "Progress compounds in ways you cannot see day to day. Keep going.",
  "The version of you that shipped something imperfect is more useful than the one still planning.",
  "Focus is a skill, not a personality trait. You can train it.",
  "Deadlines are a kindness — they force you to decide what matters.",
  "The work is never done. The question is whether you showed up for it today.",
]

function getRotation(weekStart) {
  // Pick a consistent affirmation per week based on week number
  const d = new Date(weekStart)
  const weekNum = Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000))
  return AFFIRMATIONS[weekNum % AFFIRMATIONS.length]
}

export default function WeeklyQuote({ userId, weekStart, savedQuote, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const displayQuote = savedQuote || getRotation(weekStart)
  const isCustom = !!savedQuote

  async function save() {
    const text = draft.trim()
    if (!text) return
    await supabase.from('weekly_quotes').upsert(
      { user_id: userId, week_start: weekStart, quote: text },
      { onConflict: 'user_id,week_start' }
    )
    onSave(text)
    setEditing(false)
  }

  async function clearCustom() {
    await supabase.from('weekly_quotes').delete()
      .eq('user_id', userId).eq('week_start', weekStart)
    onSave(null)
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Your intention or quote for this week…"
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
          Weekly rotation · set your own below
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
