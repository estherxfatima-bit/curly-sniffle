import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { saveAndReturn } from '../../lib/aiLog'
import { analysePerformance } from '../../lib/claude'
import { Sparkles } from 'lucide-react'

const MIN_POSTED_WITH_METRICS = 5

export default function PerformanceTab() {
  const { user } = useAuth()
  const [postedIdeas, setPostedIdeas] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (user) load()
  }, [user])

  async function load() {
    const { data } = await supabase.from('content_ideas').select('*')
      .eq('user_id', user.id).eq('status', 'Posted').not('views', 'is', null)
    setPostedIdeas(data || [])
  }

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const analysis = await analysePerformance(postedIdeas)
      setResult(analysis)
      const title = `What's working — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
      await saveAndReturn(user.id, 'content_analysis', title, JSON.stringify(analysis), analysis._usage)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (postedIdeas === null) return null

  if (postedIdeas.length < MIN_POSTED_WITH_METRICS) {
    return (
      <div className="empty-state">
        <p>You need at least {MIN_POSTED_WITH_METRICS} posted ideas with metrics logged before this unlocks — you have {postedIdeas.length}.</p>
        <p style={{ fontSize: 12, marginTop: 6 }}>Set an idea's status to "Posted" and log its metrics from the Idea Dump to build this up.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 style={{ marginBottom: '6px' }}>What's working</h3>
          <p className="text-dim" style={{ fontSize: '13px', lineHeight: '1.6' }}>
            Claude looks at all {postedIdeas.length} posted ideas with metrics and surfaces what's actually performing — not theory.
          </p>
        </div>
        <button className="btn btn-accent" onClick={run} disabled={loading} style={{ flexShrink: 0 }}>
          <Sparkles size={14} /> {loading ? 'Analysing…' : 'Analyse'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(192,70,74,0.1)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '16px', color: 'var(--danger)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card">
            <h3 className="mb-2" style={{ fontSize: '1rem' }}>Best pillar</h3>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{result.bestPillar}</p>
          </div>
          <div className="card">
            <h3 className="mb-2" style={{ fontSize: '1rem' }}>Best format</h3>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{result.bestFormat}</p>
          </div>
          <div className="card">
            <h3 className="mb-2" style={{ fontSize: '1rem' }}>Patterns</h3>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{result.patterns}</p>
          </div>
          <div className="card" style={{ borderLeft: '3px solid var(--creative)' }}>
            <h3 className="mb-2" style={{ fontSize: '1rem' }}>Recommendation</h3>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{result.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  )
}
