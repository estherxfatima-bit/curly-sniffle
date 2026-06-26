import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Sparkles, Plus, Check } from 'lucide-react'
import { generateContentIdeas } from '../../lib/claude'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

export default function IdeaGeneratorModal({ pillars, pillarDefs, performanceSummary, onSave, onClose }) {
  useLockBodyScroll()
  const [prompt, setPrompt] = useState('')
  const [pillar, setPillar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ideas, setIdeas] = useState([])
  const [savedIdx, setSavedIdx] = useState(new Set())

  async function generate() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setError(null)
    setIdeas([])
    setSavedIdx(new Set())
    try {
      setIdeas(await generateContentIdeas(prompt.trim(), pillar || null, pillarDefs, performanceSummary))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function save(idea, i) {
    onSave(idea)
    setSavedIdx(prev => new Set(prev).add(i))
  }

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(13,8,5,0.45)', zIndex: 1100, backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }} onClick={onClose} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1200, width: 520, maxWidth: '92vw', maxHeight: '82vh' }}>
        <div className="card" style={{ padding: 22, maxHeight: '82vh', overflow: 'auto' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={15} color="var(--creative)" />
              <h3 style={{ fontSize: '0.95rem' }}>Generate ideas</h3>
            </div>
            <button className="btn-icon" onClick={onClose}><X size={15} /></button>
          </div>

          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="What's on your mind? e.g. 'something about how I actually plan my week' or 'a GRWM but for a work pitch'"
            style={{ minHeight: 70, fontSize: 13, marginBottom: 10 }}
            autoFocus
          />
          <select value={pillar} onChange={e => setPillar(e.target.value)} style={{ fontSize: 12, padding: '6px 8px', marginBottom: 12 }}>
            <option value="">No specific pillar</option>
            {pillars.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <button className="btn btn-accent w-full" style={{ justifyContent: 'center' }} onClick={generate} disabled={loading || !prompt.trim()}>
            <Sparkles size={14} /> {loading ? 'Generating…' : 'Generate'}
          </button>

          {error && <p style={{ fontSize: 13, color: 'var(--danger)', marginTop: 12 }}>Error: {error}</p>}

          {ideas.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              {ideas.map((idea, i) => (
                <div key={i} className="card card-sm">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{idea.title}</p>
                    <button
                      className={`btn btn-xs ${savedIdx.has(i) ? 'btn-ghost' : 'btn-accent'}`}
                      onClick={() => save(idea, i)}
                      disabled={savedIdx.has(i)}
                    >
                      {savedIdx.has(i) ? <><Check size={12} /> Added</> : <><Plus size={12} /> Add</>}
                    </button>
                  </div>
                  <div className="flex gap-2 mb-1" style={{ flexWrap: 'wrap' }}>
                    {idea.pillar && <span className="badge badge-accent" style={{ fontSize: 9 }}>{idea.pillar}</span>}
                    {idea.format && <span className="badge badge-muted" style={{ fontSize: 9 }}>{idea.format}</span>}
                  </div>
                  {idea.hook && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>"{idea.hook}"</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
