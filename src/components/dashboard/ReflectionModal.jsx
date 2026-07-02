import { useState } from 'react'
import { createPortal } from 'react-dom'
import { format, addDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'
import { X, RefreshCw } from 'lucide-react'

const REFLECTION_PROMPTS = [
  'How did today go?',
  'What was the most important thing you did today?',
  'What drained your energy today — and what gave it back?',
  'What would you do differently if you could replay today?',
  'What's one thing you're proud of from today, however small?',
  'What felt hard today, and why?',
  'What did you learn or notice today?',
  'Did today match how you wanted to show up? What shifted?',
  'What are you carrying into tomorrow that you'd rather leave behind?',
  'Where did your time actually go today vs where you planned?',
]

function dailyPromptIndex(dateStr) {
  const n = parseInt(dateStr.replace(/-/g, ''), 10)
  return n % REFLECTION_PROMPTS.length
}

export default function ReflectionModal({ onClose }) {
  useLockBodyScroll()
  const { user } = useAuth()
  const [reflectionText, setReflectionText] = useState('')
  const [priorities, setPriorities] = useState(['', '', ''])
  const [dayRating, setDayRating] = useState(0)
  const [saving, setSaving] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')
  const [promptIdx, setPromptIdx] = useState(() => dailyPromptIndex(format(new Date(), 'yyyy-MM-dd')))
  const prompt = REFLECTION_PROMPTS[promptIdx]

  function cyclePrompt(e) {
    e.stopPropagation()
    setPromptIdx(i => (i + 1) % REFLECTION_PROMPTS.length)
  }

  async function handleSave() {
    setSaving(true)
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const cleanPriorities = priorities.map(p => p.trim()).filter(Boolean)

    await supabase.from('daily_reflections').upsert({
      user_id: user.id,
      date: today,
      reflection_text: reflectionText.trim() || null,
      tomorrow_priorities: cleanPriorities,
      day_rating: dayRating || null,
    }, { onConflict: 'user_id,date' })

    if (cleanPriorities.length) {
      await supabase.from('daily_todos').insert(
        cleanPriorities.map(text => ({
          user_id: user.id, text, date: tomorrow, complete: false, category: 'Personal', pinned: true,
        }))
      )
    }

    setSaving(false)
    onClose()
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: 440, maxHeight: '85vh', overflow: 'auto', padding: 18 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: '0.95rem' }}>Daily reflection</h3>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="mono" style={{ flex: 1 }}>{prompt}</p>
              <button className="btn-icon btn" onClick={cyclePrompt} title="Try a different prompt" style={{ flexShrink: 0 }}>
                <RefreshCw size={12} />
              </button>
            </div>
            <textarea
              value={reflectionText}
              onChange={e => setReflectionText(e.target.value)}
              placeholder="A few thoughts on today…"
              rows={4}
              style={{ fontSize: 13, width: '100%', resize: 'vertical' }}
              autoFocus
            />
          </div>

          <div>
            <p className="mono mb-2">Top 3 priorities for tomorrow</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {priorities.map((p, i) => (
                <input
                  key={i}
                  value={p}
                  onChange={e => setPriorities(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                  placeholder={`Priority ${i + 1}`}
                  style={{ fontSize: 13, width: '100%' }}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mono mb-2">Rate your day</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setDayRating(n)}
                  className={`btn btn-sm ${dayRating === n ? 'btn-career' : 'btn-ghost'}`}
                  style={dayRating === n ? { color: '#fff' } : {}}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-career w-full" style={{ color: '#fff' }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save reflection'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
