import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchUserAiUsage } from '../../lib/aiUsageStats'

const TYPE_LABELS = {
  weekly_plan: 'Weekly plan / AI chat',
  finance_summary: 'Finance summary',
  content_analysis: 'Content performance',
  flesh_out_idea: 'Flesh out idea',
}

export default function AiUsageSection({ user }) {
  const [aiEnabled, setAiEnabled] = useState(null)
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) load()
  }, [user])

  async function load() {
    const { data } = await supabase.from('profiles').select('ai_enabled').eq('id', user.id).single()
    const enabled = data?.ai_enabled ?? true
    setAiEnabled(enabled)
    if (!enabled) return
    try {
      setUsage(await fetchUserAiUsage(user.id))
    } catch (e) {
      setError(e.message)
    }
  }

  if (aiEnabled === null || !aiEnabled) return null

  const maxWeek = usage ? Math.max(0.0001, ...usage.weekBuckets.map(b => b.total)) : 0

  return (
    <div className="card mb-4">
      <h3 style={{ fontSize: '0.9rem', marginBottom: 8 }}>My AI usage</h3>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
        Approximate cost of your AI calls, for transparency.
      </p>

      {error && <p style={{ fontSize: 12, color: 'var(--danger)' }}>Error: {error}</p>}

      {usage && (
        <>
          <div className="flex items-center gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-3)' }}>This month</p>
              <p style={{ fontSize: 18, fontWeight: 600 }}>${usage.totalThisMonth.toFixed(2)}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-3)' }}>All-time</p>
              <p style={{ fontSize: 18, fontWeight: 600 }}>${usage.totalAllTime.toFixed(2)}</p>
            </div>
          </div>

          <p className="mono mb-2" style={{ fontSize: 11 }}>Cost per week (last 8 weeks)</p>
          <div className="flex items-end gap-2 mb-4" style={{ height: 70 }}>
            {usage.weekBuckets.map((b, i) => (
              <div key={i} title={`$${b.total.toFixed(2)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{ width: '100%', borderRadius: 2, background: 'var(--career)', minHeight: 2, height: `${Math.max(2, (b.total / maxWeek) * 100)}%` }} />
              </div>
            ))}
          </div>

          {Object.keys(usage.byType).length > 0 && (
            <>
              <p className="mono mb-2" style={{ fontSize: 11 }}>By feature</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(usage.byType).map(([type, cost]) => (
                  <div key={type} className="flex items-center justify-between" style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--text-2)' }}>{TYPE_LABELS[type] || type}</span>
                    <span className="mono">${cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
