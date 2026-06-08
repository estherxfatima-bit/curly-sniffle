import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { analyseInspiration } from '../../lib/claude'
import { Sparkles, Plus } from 'lucide-react'

export default function AIAnalysisTab({ onSaveIdea }) {
  const { user } = useAuth()
  const [inspirationCount, setInspirationCount] = useState(0)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.from('content_inspiration').select('id', { count: 'exact' }).eq('user_id', user.id)
      .then(({ count }) => setInspirationCount(count || 0))
  }, [user])

  async function runAnalysis() {
    setLoading(true)
    setError(null)
    try {
      const { data } = await supabase.from('content_inspiration').select('*').eq('user_id', user.id).limit(50)
      if (!data?.length) throw new Error('No saved inspiration to analyse.')
      const analysis = await analyseInspiration(data)
      setResult(analysis)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function saveIdeaFromAnalysis(idea) {
    const { data } = await supabase.from('content_ideas').insert({
      user_id: user.id,
      title: idea.title,
      pillar: idea.pillar,
      format: idea.format,
      hook: idea.hook,
      status: 'Idea',
      production_stage: 'Idea',
    }).select().single()
    if (data && onSaveIdea) onSaveIdea(data)
    alert(`"${idea.title}" saved to Idea Dump`)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 style={{ marginBottom: '6px' }}>Analyse my inspiration</h3>
          <p className="text-dim" style={{ fontSize: '13px', lineHeight: '1.6' }}>
            Claude reads all {inspirationCount} saved URLs and notes, identifies your dominant themes, tone patterns, and content gaps, then generates 5 specific content ideas tailored to your pillars.
          </p>
        </div>
        <button
          className="btn btn-accent"
          onClick={runAnalysis}
          disabled={loading || inspirationCount === 0}
          style={{ flexShrink: 0 }}
        >
          <Sparkles size={14} />
          {loading ? 'Analysing…' : 'Analyse'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(192,70,74,0.1)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '16px', color: 'var(--danger)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {inspirationCount === 0 && (
        <div className="empty-state">
          <p>Add some saved inspiration first — then come back here to analyse the patterns.</p>
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Dominant themes */}
          <div className="card">
            <h3 className="mb-3" style={{ fontSize: '1rem' }}>Dominant themes</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {result.dominantThemes?.map(t => (
                <span key={t} className="badge badge-accent" style={{ fontSize: '12px', padding: '4px 10px' }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Tone & sentiment */}
          <div className="card">
            <h3 className="mb-3" style={{ fontSize: '1rem' }}>Tone & sentiment</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.7' }}>{result.toneAndSentiment}</p>
          </div>

          {/* Content gaps */}
          <div className="card">
            <h3 className="mb-3" style={{ fontSize: '1rem' }}>Content gaps</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.7' }}>{result.contentGaps}</p>
          </div>

          {/* Content ideas */}
          <div>
            <h3 className="mb-3" style={{ fontSize: '1rem' }}>5 generated content ideas</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {result.contentIdeas?.map((idea, i) => (
                <div key={i} className="card card-sm">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '500', fontSize: '14px', marginBottom: '4px' }}>{idea.title}</p>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span className="badge badge-accent">{idea.pillar}</span>
                        <span className="badge badge-muted">{idea.format}</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => saveIdeaFromAnalysis(idea)}
                      style={{ flexShrink: 0 }}
                    >
                      <Plus size={13} /> Save to ideas
                    </button>
                  </div>
                  {idea.hook && (
                    <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: '10px', marginBottom: '8px' }}>
                      <p className="mono mb-1">Hook</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-2)', fontStyle: 'italic' }}>"{idea.hook}"</p>
                    </div>
                  )}
                  {idea.rationale && (
                    <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.6' }}>{idea.rationale}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
