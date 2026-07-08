import { useState } from 'react'
import { createPortal } from 'react-dom'
import { format, addDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'
import { RefreshCw, Moon } from 'lucide-react'

const REFLECTION_PROMPTS = [
  "How did today go?",
  "What was the most important thing you did today?",
  "What drained your energy today — and what gave it back?",
  "What would you do differently if you could replay today?",
  "What's one thing you're proud of from today, however small?",
  "What felt hard today, and why?",
  "What did you learn or notice today?",
  "Did today match how you wanted to show up? What shifted?",
  "What are you carrying into tomorrow that you'd rather leave behind?",
  "Where did your time actually go today vs where you planned?",
]

const DAY_EMOJIS = ['', '😞', '😕', '😐', '🙂', '✨']

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
  const [skipConfirm, setSkipConfirm] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')
  const [promptIdx, setPromptIdx] = useState(() => dailyPromptIndex(today))
  const prompt = REFLECTION_PROMPTS[promptIdx]
  const dateLabel = format(new Date(), 'EEEE, d MMMM')

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
    <div style={{
      position: 'fixed', inset: 0, width: '100vw', height: '100vh',
      zIndex: 400,
      background: 'linear-gradient(160deg, #0f0c29 0%, #1a1040 40%, #24243e 100%)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Stars background decoration */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {[...Array(28)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : 1.5,
            height: i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : 1.5,
            borderRadius: '50%',
            background: '#fff',
            opacity: 0.15 + (i % 4) * 0.1,
            top: `${(i * 37 + 11) % 90}%`,
            left: `${(i * 53 + 7) % 95}%`,
          }} />
        ))}
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '40px 20px 32px', maxWidth: 520, margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ marginBottom: 12 }}>
            <Moon size={28} color="rgba(180,160,255,0.9)" />
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(180,160,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>{dateLabel}</p>
          <h2 style={{ fontSize: 'clamp(1.4rem, 6vw, 2rem)', fontFamily: 'var(--font-serif)', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            End of day reflection
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(200,185,255,0.6)', marginTop: 8 }}>Take a few minutes to close out today.</p>
        </div>

        {/* Rate your day — prominent, first */}
        <div style={{ width: '100%', marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'rgba(180,160,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' }}>How was your day?</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setDayRating(n)}
                style={{
                  width: 52, height: 52, borderRadius: 12,
                  fontSize: 24,
                  background: dayRating === n ? 'rgba(140,120,255,0.35)' : 'rgba(255,255,255,0.07)',
                  border: `2px solid ${dayRating === n ? 'rgba(160,140,255,0.8)' : 'rgba(255,255,255,0.1)'}`,
                  transform: dayRating === n ? 'scale(1.15)' : 'scale(1)',
                  transition: 'all 0.15s',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {DAY_EMOJIS[n]}
              </button>
            ))}
          </div>
        </div>

        {/* Reflection prompt */}
        <div style={{ width: '100%', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: 13, color: 'rgba(220,210,255,0.85)', fontStyle: 'italic', flex: 1, lineHeight: 1.5 }}>"{prompt}"</p>
            <button onClick={cyclePrompt} title="Different prompt" style={{ background: 'none', color: 'rgba(180,160,255,0.5)', padding: 4, marginLeft: 8, flexShrink: 0 }}>
              <RefreshCw size={12} />
            </button>
          </div>
          <textarea
            value={reflectionText}
            onChange={e => setReflectionText(e.target.value)}
            placeholder="A few thoughts…"
            rows={4}
            autoFocus
            style={{
              width: '100%', fontSize: 14, resize: 'vertical',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, padding: '10px 12px',
              color: '#fff', lineHeight: 1.6,
            }}
          />
        </div>

        {/* Tomorrow's priorities */}
        <div style={{ width: '100%', marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'rgba(180,160,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Top priorities for tomorrow</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {priorities.map((p, i) => (
              <input
                key={i}
                value={p}
                onChange={e => setPriorities(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                placeholder={`Priority ${i + 1}`}
                style={{
                  fontSize: 13, width: '100%',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, padding: '9px 12px',
                  color: '#fff',
                }}
              />
            ))}
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            background: dayRating > 0 || reflectionText.trim()
              ? 'linear-gradient(135deg, #7c5cfc 0%, #a78bfa 100%)'
              : 'rgba(255,255,255,0.12)',
            color: '#fff',
            border: 'none',
            transition: 'all 0.2s',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : '✓ Close out today'}
        </button>

        {/* Skip — very small and low contrast */}
        {!skipConfirm ? (
          <button onClick={() => setSkipConfirm(true)} style={{ marginTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.2)', background: 'none', padding: '4px 8px' }}>
            skip for now
          </button>
        ) : (
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Are you sure? It only takes a minute.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => setSkipConfirm(false)} style={{ fontSize: 12, color: 'rgba(180,160,255,0.7)', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '5px 14px' }}>Go back</button>
              <button onClick={onClose} style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none', padding: '5px 14px' }}>Skip anyway</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
