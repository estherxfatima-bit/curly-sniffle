import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { DEFAULT_PILLARS, PILLAR_COLOR_PALETTE } from '../../lib/constants'
import ArcRing from '../ui/ArcRing'
import { Plus, Trash2 } from 'lucide-react'

export default function PillarsTab() {
  const { user } = useAuth()
  const [ideas, setIdeas] = useState([])
  const [pillars, setPillars] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) load()
  }, [user])

  async function load() {
    setLoading(true)
    const [{ data: ideaData, error: ideaErr }, { data: pillarData, error: pillarErr }] = await Promise.all([
      supabase.from('content_ideas').select('pillar, status').eq('user_id', user.id),
      supabase.from('content_pillars').select('*').eq('user_id', user.id).order('position').order('created_at'),
    ])
    if (ideaErr) setError(ideaErr.message)
    if (pillarErr) setError(pillarErr.message)
    setIdeas(ideaData || [])

    if (!pillarErr && (pillarData || []).length === 0) {
      // First visit — seed the default pillars so there's something to edit
      const seed = DEFAULT_PILLARS.map((p, i) => ({
        user_id: user.id,
        name: p.name,
        description: p.description,
        examples: p.examples,
        color: p.color,
        position: i,
      }))
      const { data: inserted, error: seedErr } = await supabase.from('content_pillars').insert(seed).select()
      if (seedErr) setError(seedErr.message)
      setPillars(inserted || [])
    } else {
      setPillars(pillarData || [])
    }
    setLoading(false)
  }

  async function updatePillar(id, field, value) {
    const { error } = await supabase.from('content_pillars')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { setError(error.message); return }
    setPillars(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  async function addPillar() {
    const color = PILLAR_COLOR_PALETTE[pillars.length % PILLAR_COLOR_PALETTE.length]
    const { data, error } = await supabase.from('content_pillars').insert({
      user_id: user.id,
      name: 'New pillar',
      description: '',
      examples: '',
      color,
      position: pillars.length,
    }).select().single()
    if (error) { setError(error.message); return }
    setPillars(prev => [...prev, data])
  }

  async function removePillar(id) {
    const { error } = await supabase.from('content_pillars').delete().eq('id', id)
    if (error) { setError(error.message); return }
    setPillars(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return <p className="text-dim" style={{ textAlign: 'center', padding: '40px' }}>Loading…</p>

  return (
    <div>
      {error && (
        <div className="card mb-4" style={{ borderLeft: '3px solid var(--personal)' }}>
          <p style={{ fontSize: 12, color: 'var(--personal)' }}>Error: {error}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {pillars.map((pillar, idx) => {
          const color = pillar.color || PILLAR_COLOR_PALETTE[idx % PILLAR_COLOR_PALETTE.length]
          const pillarIdeas = ideas.filter(i => i.pillar === pillar.name)
          const total = pillarIdeas.length
          const posted = pillarIdeas.filter(i => i.status === 'Posted').length
          const pct = total > 0 ? Math.round((posted / total) * 100) : 0

          return (
            <div key={pillar.id} className="card" style={{ borderLeft: `3px solid ${color}` }}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <input
                  value={pillar.name}
                  onChange={e => updatePillar(pillar.id, 'name', e.target.value)}
                  style={{
                    fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.05rem',
                    border: 'none', background: 'transparent', padding: 0, color: 'var(--text)',
                    width: '100%',
                  }}
                />
                <button className="btn-icon btn" onClick={() => removePillar(pillar.id)} title="Remove pillar" style={{ flexShrink: 0 }}>
                  <Trash2 size={13} />
                </button>
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
                    value={pillar.description || ''}
                    onChange={e => updatePillar(pillar.id, 'description', e.target.value)}
                    placeholder="What lives in this pillar?"
                    style={{
                      width: '100%', minHeight: 56, fontSize: 12, color: 'var(--text-2)',
                      border: '1px solid transparent', background: 'transparent', resize: 'vertical',
                      padding: 4, borderRadius: 6, fontFamily: 'var(--font-sans)',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--border-light)'}
                    onBlur={e => e.target.style.borderColor = 'transparent'}
                  />
                  <textarea
                    value={pillar.examples || ''}
                    onChange={e => updatePillar(pillar.id, 'examples', e.target.value)}
                    placeholder="Examples of content (e.g. GRWM, DITL, carousel breakdowns)…"
                    style={{
                      width: '100%', minHeight: 44, fontSize: 11, color: 'var(--text-3)',
                      border: '1px solid transparent', background: 'transparent', resize: 'vertical',
                      padding: 4, borderRadius: 6, fontFamily: 'var(--font-sans)', fontStyle: 'italic',
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

        <button
          className="card flex items-center justify-center gap-2"
          onClick={addPillar}
          style={{
            border: '1px dashed var(--border-light)', background: 'transparent', cursor: 'pointer',
            minHeight: 120, color: 'var(--text-3)', fontSize: 13,
          }}
        >
          <Plus size={16} /> Add pillar
        </button>
      </div>
    </div>
  )
}
