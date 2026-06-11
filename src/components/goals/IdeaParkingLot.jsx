import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Plus, Trash2, Check, ExternalLink, RotateCcw } from 'lucide-react'

const CATEGORIES = ['', 'Career', 'Creative', 'Personal', 'Financial', 'Health', 'Other']

export default function IdeaParkingLot() {
  const { user } = useAuth()
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [category, setCategory] = useState('')
  const [link, setLink] = useState('')
  const [showExtra, setShowExtra] = useState(false)
  const [showActedOn, setShowActedOn] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('idea_parking_lot').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setIdeas(data || [])
    setLoading(false)
  }

  async function addIdea() {
    const t = text.trim()
    if (!t) return
    const { data } = await supabase.from('idea_parking_lot').insert({
      user_id: user.id, text: t, category: category || null, link: link.trim() || null, acted_on: false,
    }).select().single()
    if (data) setIdeas(prev => [data, ...prev])
    setText(''); setCategory(''); setLink(''); setShowExtra(false)
  }

  async function toggleActedOn(idea) {
    const acted_on = !idea.acted_on
    await supabase.from('idea_parking_lot').update({ acted_on }).eq('id', idea.id)
    setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, acted_on } : i))
  }

  async function removeIdea(id) {
    await supabase.from('idea_parking_lot').delete().eq('id', id)
    setIdeas(prev => prev.filter(i => i.id !== id))
  }

  const active = ideas.filter(i => !i.acted_on)
  const acted = ideas.filter(i => i.acted_on)

  return (
    <div className="card card-wellness">
      <h3 style={{ marginBottom: 4 }}>Idea parking lot</h3>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>Ideas you don't want to lose but aren't acting on yet.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 7 }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !showExtra && addIdea()}
            placeholder="Capture an idea…"
            style={{ flex: 1, fontSize: 13 }}
          />
          <button className="btn btn-sm btn-ghost" onClick={() => setShowExtra(v => !v)}>{showExtra ? '−' : '+'} details</button>
          <button className="btn btn-sm btn-ghost" onClick={addIdea}><Plus size={12} /></button>
        </div>
        {showExtra && (
          <div style={{ display: 'flex', gap: 7 }}>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: 'auto', fontSize: 12 }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c || 'No category'}</option>)}
            </select>
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="Link (optional)" style={{ flex: 1, fontSize: 12 }} />
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading…</p>
      ) : active.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>Nothing parked right now.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {active.map(idea => <IdeaRow key={idea.id} idea={idea} onToggle={toggleActedOn} onRemove={removeIdea} />)}
        </div>
      )}

      {acted.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-xs btn-ghost" onClick={() => setShowActedOn(v => !v)}>
            {showActedOn ? 'Hide' : 'Show'} acted on ({acted.length})
          </button>
          {showActedOn && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {acted.map(idea => <IdeaRow key={idea.id} idea={idea} onToggle={toggleActedOn} onRemove={removeIdea} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function IdeaRow({ idea, onToggle, onRemove }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 'var(--radius)', borderLeft: '2px solid var(--wellness)', opacity: idea.acted_on ? 0.6 : 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, textDecoration: idea.acted_on ? 'line-through' : 'none' }}>{idea.text}</p>
        <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
          {idea.category && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--wellness)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{idea.category}</span>}
          {idea.link && (
            <a href={idea.link} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <ExternalLink size={9} /> link
            </a>
          )}
        </div>
      </div>
      <button className="btn-icon" style={{ padding: 2 }} title={idea.acted_on ? 'Mark as not acted on' : 'Mark as acted on'} onClick={() => onToggle(idea)}>
        {idea.acted_on ? <RotateCcw size={12} /> : <Check size={12} />}
      </button>
      <button className="btn-icon" style={{ padding: 2 }} onClick={() => onRemove(idea.id)}><Trash2 size={12} /></button>
    </div>
  )
}
