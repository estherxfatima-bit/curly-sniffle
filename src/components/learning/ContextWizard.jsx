import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, Check, Loader } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { callClaudeRaw } from '../../lib/learningClaude'

const STEPS = [
  {
    key: 'ai_context_current_work',
    title: 'What do you do?',
    description: 'Describe your current work in a few sentences — job title, industry, what you actually spend your time on.',
    placeholder: 'e.g. Marketing manager at a fashion brand, running campaigns across EU markets…',
    type: 'textarea',
  },
  {
    key: 'ai_context_background',
    title: 'What\'s your background?',
    description: 'What have you done before? Past roles, industries, skills you\'ve built up.',
    placeholder: 'e.g. Started in music industry PR, moved into brand strategy…',
    type: 'textarea',
  },
  {
    key: 'ai_context_building',
    title: 'What are you building?',
    description: 'What are you working toward right now?',
    placeholder: 'e.g. Building a consultancy alongside a property portfolio…',
    type: 'textarea',
  },
  {
    key: 'ai_context_creative_skills',
    title: 'What are your creative skills?',
    description: 'Any creative work you do or have done.',
    placeholder: 'e.g. Film direction, photography, content strategy…',
    type: 'textarea',
  },
  {
    key: 'ai_context_level',
    title: 'What level are you at?',
    description: 'This helps the AI pitch advice at the right level.',
    type: 'select',
    options: ['Just starting out', 'Building momentum', 'Established but evolving', 'Experienced professional'],
  },
  {
    key: 'ai_context_avoid',
    title: 'What should the AI never assume about you?',
    description: 'Things to avoid, things you already know well, preferences.',
    placeholder: 'e.g. Don\'t give beginner advice. I already know the basics of…',
    type: 'textarea',
  },
]

export default function ContextWizard({ onClose, onComplete }) {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [synthesising, setSynthesising] = useState(false)
  const [error, setError] = useState(null)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const answer = answers[current.key] || ''

  function set(val) { setAnswers(p => ({ ...p, [current.key]: val })) }

  async function finish() {
    setSynthesising(true)
    setError(null)
    try {
      const filledAnswers = STEPS.map(s => ({ label: s.title, value: answers[s.key] || '' })).filter(a => a.value)
      const prompt = filledAnswers.map(a => `${a.label}: ${a.value}`).join('\n\n')
      const system = `You synthesise a person's professional profile into a single dense paragraph that an AI assistant can use as context. Be specific — include names, industries, skills, and level. Do not use generic phrases. Do not bullet-point. Return only the paragraph, nothing else.`

      const summary = await callClaudeRaw(prompt, system, 400)

      const update = {
        ai_context_summary: summary,
        personal_context: summary,
        ...Object.fromEntries(STEPS.map(s => [s.key, answers[s.key] || null])),
      }
      await supabase.from('profiles').upsert({ id: user.id, email: user.email, ...update }, { onConflict: 'id' })
      onComplete(summary)
    } catch (e) {
      setError(e.message)
    } finally {
      setSynthesising(false)
    }
  }

  async function skip() {
    // Save whatever's been filled so far
    const update = Object.fromEntries(STEPS.map(s => [s.key, answers[s.key] || null]))
    await supabase.from('profiles').upsert({ id: user.id, email: user.email, ...update }, { onConflict: 'id' })
    onClose()
  }

  return createPortal(
    <div className="modal-overlay">
      <div className="modal scale-in" style={{ maxWidth: 560 }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--learning)', textTransform: 'uppercase', marginBottom: 4 }}>
              AI context wizard — step {step + 1} of {STEPS.length}
            </p>
            <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden', width: '100%', marginBottom: 2 }}>
              <div style={{ height: '100%', width: `${((step + 1) / STEPS.length) * 100}%`, background: 'var(--learning)', transition: 'width 0.3s ease', borderRadius: 2 }} />
            </div>
          </div>
          <button className="btn-icon btn" onClick={skip} title="Skip wizard"><X size={16} /></button>
        </div>

        <div style={{ padding: '4px 0 20px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
            {current.title}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5 }}>
            {current.description}
          </p>

          {current.type === 'textarea' ? (
            <textarea
              autoFocus
              value={answer}
              onChange={e => set(e.target.value)}
              placeholder={current.placeholder}
              style={{ width: '100%', minHeight: 110, fontSize: 13, lineHeight: 1.6 }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {current.options.map(opt => (
                <button
                  key={opt}
                  onClick={() => set(opt)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius)',
                    border: `2px solid ${answer === opt ? 'var(--learning)' : 'var(--border)'}`,
                    background: answer === opt ? 'var(--learning-tint)' : 'var(--bg-2)',
                    color: answer === opt ? 'var(--learning)' : 'var(--text-2)',
                    textAlign: 'left',
                    fontSize: 14,
                    fontWeight: answer === opt ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  {opt}
                  {answer === opt && <Check size={16} color="var(--learning)" />}
                </button>
              ))}
            </div>
          )}

          {error && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 12 }}>{error}</p>}
        </div>

        <div className="flex items-center justify-between">
          <button
            className="btn btn-ghost btn-sm flex items-center gap-1"
            onClick={() => step > 0 ? setStep(s => s - 1) : skip()}
          >
            <ChevronLeft size={14} />
            {step > 0 ? 'Back' : 'Skip wizard'}
          </button>

          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm" onClick={skip}>Skip</button>
            {isLast ? (
              <button
                className="btn btn-sm flex items-center gap-2"
                style={{ background: 'var(--learning)', color: '#fff', border: 'none' }}
                onClick={finish}
                disabled={synthesising}
              >
                {synthesising ? <><Loader size={13} className="spin" /> Building your profile…</> : <><Check size={13} /> Done</>}
              </button>
            ) : (
              <button
                className="btn btn-sm flex items-center gap-2"
                style={{ background: 'var(--learning)', color: '#fff', border: 'none' }}
                onClick={() => setStep(s => s + 1)}
              >
                Next <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
