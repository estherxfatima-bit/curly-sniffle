import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Sparkles, Copy, Check } from 'lucide-react'
import { fleshOutIdea } from '../../lib/claude'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

function CopyableBlock({ label, text }) {
  const [copied, setCopied] = useState(false)
  if (!text) return null
  return (
    <div className="card card-sm" style={{ marginBottom: 10 }}>
      <div className="flex items-center justify-between mb-1">
        <p className="mono">{label}</p>
        <button
          className="btn-icon btn"
          onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200) }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{text}</p>
    </div>
  )
}

export default function FleshOutModal({ idea, pillarDefs, onClose }) {
  useLockBodyScroll()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => { run() }, [])

  async function run() {
    setLoading(true)
    setError(null)
    try {
      setResult(await fleshOutIdea(idea, pillarDefs))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
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

          {loading && <p className="text-dim" style={{ textAlign: 'center', padding: '30px' }}>Thinking…</p>}
          {error && <p style={{ fontSize: 13, color: 'var(--danger)' }}>Error: {error}</p>}

          {result && (
            <div>
              <CopyableBlock label="Sharper hook" text={result.sharperHook} />
              <CopyableBlock label="Caption angle" text={result.captionAngle} />
              {result.repurposing?.length > 0 && (
                <CopyableBlock label="Repurposing ideas" text={result.repurposing.join('\n')} />
              )}
              {result.structureBeats?.length > 0 && (
                <CopyableBlock label="Structure beats" text={result.structureBeats.map((b, i) => `${i + 1}. ${b}`).join('\n')} />
              )}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
