import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Sparkles, Copy, Check } from 'lucide-react'
import { fleshOutIdea } from '../../lib/claude'
import { saveAndReturn } from '../../lib/aiLog'
import { supabase } from '../../lib/supabase'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  if (!text) return null
  return (
    <button
      className="btn-icon btn"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200) }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

function Section({ label, children, copyText, extra }) {
  return (
    <div className="card card-sm" style={{ marginBottom: 10 }}>
      <div className="flex items-center justify-between mb-1">
        <p className="mono">{label}</p>
        <div className="flex items-center gap-1">
          {extra}
          <CopyButton text={copyText} />
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

export default function FleshOutModal({ idea, pillarDefs, userId, savedLog, onClose, onSaved }) {
  useLockBodyScroll()
  const [stage, setStage] = useState(savedLog ? 'result' : 'confirm')
  const [error, setError] = useState(null)
  const [result, setResult] = useState(savedLog ? JSON.parse(savedLog.response) : null)
  const [hookView, setHookView] = useState('visual')

  const summaryParts = [idea.pillar, idea.format, idea.notes ? 'notes' : null].filter(Boolean)

  async function generate() {
    setStage('loading')
    setError(null)
    try {
      const analysis = await fleshOutIdea(idea, pillarDefs)
      const usage = analysis._usage
      const record = await saveAndReturn(userId, 'flesh_out_idea', `Flesh out: ${idea.title}`, JSON.stringify(analysis), usage)
      await supabase.from('content_ideas').update({ last_flesh_out_id: record.id }).eq('id', idea.id)
      onSaved?.(record.id)
      setResult(analysis)
      setStage('result')
    } catch (e) {
      setError(e.message)
      setStage('confirm')
    }
  }

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(13,8,5,0.45)', zIndex: 1100, backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }} onClick={onClose} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1200, width: 480, maxWidth: '92vw', maxHeight: '80vh' }}>
        <div className="card" style={{ padding: 22, maxHeight: '80vh', overflow: 'auto' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles size={15} color="var(--creative)" />
              <h3 style={{ fontSize: '0.95rem' }}>Flesh this out</h3>
            </div>
            <button className="btn-icon" onClick={onClose}><X size={15} /></button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>{idea.title}</p>

          {error && <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 10 }}>Error: {error}</p>}

          {stage === 'confirm' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 18 }}>
                This will send Claude the idea's title{summaryParts.length ? `, ${summaryParts.join(', ')}` : ''} to generate hook options, captions, a shot list, and repurposing ideas.
              </p>
              <div className="flex items-center gap-2 justify-end">
                <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
                <button className="btn btn-accent btn-sm" onClick={generate}>Generate</button>
              </div>
            </div>
          )}

          {stage === 'loading' && (
            <p className="text-dim" style={{ textAlign: 'center', padding: '30px' }}>Thinking…</p>
          )}

          {stage === 'result' && result && (
            <div>
              <Section
                label="Hook"
                copyText={hookView === 'visual' ? result.visualHook : result.textHook}
                extra={
                  <div className="flex items-center gap-1" style={{ marginRight: 4 }}>
                    <button className={`btn btn-sm ${hookView === 'visual' ? 'btn-accent' : 'btn-ghost'}`} onClick={() => setHookView('visual')}>Visual</button>
                    <button className={`btn btn-sm ${hookView === 'text' ? 'btn-accent' : 'btn-ghost'}`} onClick={() => setHookView('text')}>Text</button>
                  </div>
                }
              >
                {hookView === 'visual' ? (result.visualHook || '—') : (result.textHook || '—')}
              </Section>

              <Section label="Caption 1" copyText={result.caption1}>
                {result.caption1 || '—'}
              </Section>

              <Section label="Caption 2" copyText={result.caption2}>
                {result.caption2 || '—'}
              </Section>

              {result.shotList?.length > 0 && (
                <Section label="Shot list" copyText={result.shotList.map((s, i) => `${i + 1}. ${s}`).join('\n')}>
                  <ol style={{ paddingLeft: 18, margin: 0 }}>
                    {result.shotList.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
                  </ol>
                </Section>
              )}

              {result.repurposing?.length > 0 && (
                <Section label="Repurposing" copyText={result.repurposing.join('\n')}>
                  <ul style={{ paddingLeft: 18, margin: 0 }}>
                    {result.repurposing.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
                  </ul>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
