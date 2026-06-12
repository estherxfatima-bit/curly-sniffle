import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { CONTENT_PILLARS, PILLAR_COLORS, PILLAR_DESCRIPTIONS } from '../../lib/constants'
import ArcRing from '../ui/ArcRing'

export default function PillarsTab() {
  const { user } = useAuth()
  const [ideas, setIdeas] = useState([])
  const [pillars, setPillars] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) load()
  }, [user])

  async function load() {
    setLoading(true)
    const [{ data: ideaData, error: ideaErr }, { data: pillarData, error: pillarErr }] = await Promise.all([
      supabase.from('content_ideas').select('pillar, status').eq('user_id', user.id),
      supabase.from('content_pillars').select('*').eq('user_id', user.id),
    ])
    if (ideaErr) setError(ideaErr.message)
    if (pillarErr) setError(pillarErr.message)
    setIdeas(ideaData || [])

    const map = {}
    for (const p of pillarData || []) map[p.key] = p
    setPillars(map)
    setLoading(false)
  }

  async function saveField(key, field, value) {
    const existing = pillars[key]
    if (existing) {
      const { error } = await supabase.from('content_pillars')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) { setError(error.message); return }
      setPillars(prev => ({ ...prev, [key]: { ...existing, [field]: value } }))
    } else {
      const { data, error } = await supabase.from('content_pillars')
        .insert({ user_id: user.id, key, name: key, description: PILLAR_DESCRIPTIONS[key] || '', [field]: value })
        .select().single()
      if (error) { setError(error.message); return }
      setPillars(prev => ({ ...prev, [key]: data }))
    }
  }

  if (loading) return <p className="text-dim" style={{ textAlign: 'center', padding: '40px' }}>Loading…</p>

  return (
    <div>
      {error && (
        <div className="card mb-4" style={{ borderLeft: '3px solid var(--personal)' }}>
          <p style={{ fontSize: 12, color: 'var(--personal)' }}>Error: {error}</p>
        </div>
      )}
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {CONTENT_PILLARS.map(key => {
          const pillar = pillars[key]
          const name = pillar?.name ?? key
          const description = pillar?.description ?? (PILLAR_DESCRIPTIONS[key] || '')
          const color = PILLAR_COLORS[key] || 'var(--creative)'
          const pillarIdeas = ideas.filter(i => i.pillar === key)
          const total = pillarIdeas.length
          const posted = pillarIdeas.filter(i => i.status === 'Posted').length
          const pct = total > 0 ? Math.round((posted / total) * 100) : 0

          return (
            <div key={key} className="card" style={{ borderLeft: `3px solid ${color}` }}>
              <div className="flex items-center justify-between gap-4 mb-3">
                <input
                  value={name}
                  onChange={e => saveField(key, 'name', e.target.value)}
                  style={{
                    fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.05rem',
                    border: 'none', background: 'transparent', padding: 0, color: 'var(--text)',
                    width: '100%',
                  }}
                />
              </div>

              <div className="flex items-start gap-4">
                <ArcRing
                  value={pct}
                  max={100}
                  size={72}
                  strokeWidth={7}
                  color={color}
                  label={`${pct}%`}
                  sublabel="posted"
                  fontSize={14}
                />
                <div style={{ flex: 1 }}>
                  <textarea
                    value={description}
                    onChange={e => saveField(key, 'description', e.target.value)}
                    placeholder="What lives in this pillar?"
                    style={{
                      width: '100%', minHeight: 64, fontSize: 12, color: 'var(--text-2)',
                      border: '1px solid transparent', background: 'transparent', resize: 'vertical',
                      padding: 4, borderRadius: 6, fontFamily: 'var(--font-sans)',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--border-light)'}
                    onBlur={e => e.target.style.borderColor = 'transparent'}
                  />
                  <div className="flex items-center gap-4 mt-2" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
                    <span>{total} idea{total === 1 ? '' : 's'}</span>
                    <span>{posted} posted</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
