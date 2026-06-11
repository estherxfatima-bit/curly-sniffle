import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Plus, Trash2, Check } from 'lucide-react'
import ArcRing from '../components/ui/ArcRing'

const CATEGORIES = ['Travel', 'Experience', 'Career', 'Personal', 'Health', 'Creative', 'Financial', 'Other']
const FILTERS = ['All', 'To Do', 'Done']

const CATEGORY_COLORS = {
  Travel:    'var(--wellness)',
  Experience:'var(--creative)',
  Career:    'var(--career)',
  Personal:  'var(--personal)',
  Health:    'var(--wellness)',
  Creative:  'var(--creative)',
  Financial: 'var(--finance)',
  Other:     'var(--text-3)',
}

function BucketDecoration() {
  return (
    <svg width="100" height="70" viewBox="0 0 100 70" fill="none">
      <path d="M30 60 L20 25 Q20 15 30 15 L70 15 Q80 15 80 25 L70 60 Z" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <line x1="20" y1="34" x2="80" y2="34" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
    </svg>
  )
}

export default function BucketListPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [input, setInput] = useState('')

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('bucket_list').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  async function addItem() {
    const title = input.trim()
    if (!title) return
    const { data } = await supabase.from('bucket_list').insert({ user_id: user.id, category, title, complete: false }).select().single()
    if (data) setItems(prev => [data, ...prev])
    setInput('')
  }

  async function toggleComplete(item) {
    const complete = !item.complete
    const completed_at = complete ? new Date().toISOString().slice(0, 10) : null
    await supabase.from('bucket_list').update({ complete, completed_at }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, complete, completed_at } : i))
  }

  async function removeItem(id) {
    await supabase.from('bucket_list').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const filtered = items.filter(i => {
    if (filter === 'To Do') return !i.complete
    if (filter === 'Done') return i.complete
    return true
  })

  const overallPct = items.length ? Math.round((items.filter(i => i.complete).length / items.length) * 100) : 0

  const categoryStats = CATEGORIES.map(cat => {
    const catItems = items.filter(i => i.category === cat)
    const done = catItems.filter(i => i.complete).length
    return { category: cat, total: catItems.length, done, pct: catItems.length ? Math.round((done / catItems.length) * 100) : 0 }
  }).filter(c => c.total > 0)

  return (
    <div>
      <div className="page-header header-personal mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>Bucket List</h1>
            <p>The bigger picture stuff — for someday and one day</p>
          </div>
          <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
            <ArcRing value={overallPct} max={100} size={56} strokeWidth={5} color="var(--personal)" label={`${overallPct}%`} fontSize={11} />
          </div>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--personal)' }}><BucketDecoration /></div>
      </div>

      {/* Add item */}
      <div className="card mb-5" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: 'auto', fontSize: 13 }}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          placeholder="Something you want to do someday…"
          style={{ flex: 1, minWidth: 200, fontSize: 13 }}
        />
        <button className="btn btn-personal btn-sm" style={{ color: '#fff' }} onClick={addItem}>
          <Plus size={14} /> Add
        </button>
      </div>

      {/* Category progress */}
      {categoryStats.length > 0 && (
        <div className="grid-4 mb-5" style={{ gap: 12 }}>
          {categoryStats.map(c => (
            <div key={c.category} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
              <ArcRing value={c.pct} max={100} size={36} strokeWidth={4} color={CATEGORY_COLORS[c.category]} label={`${c.pct}%`} fontSize={8} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.category}</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{c.done}/{c.total}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 mb-5">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm ${filter === f ? 'btn-personal' : 'btn-ghost'}`} style={filter === f ? { color: '#fff' } : {}}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', fontStyle: 'italic' }}>Nothing here yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(item => (
            <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderLeft: `3px solid ${CATEGORY_COLORS[item.category]}` }}>
              <div className={`toggle-dot ${item.complete ? 'done' : ''}`} onClick={() => toggleComplete(item)} style={{ flexShrink: 0 }}>
                {item.complete && <Check size={11} color="white" strokeWidth={3} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, textDecoration: item.complete ? 'line-through' : 'none', color: item.complete ? 'var(--text-3)' : 'var(--text)' }}>{item.title}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: CATEGORY_COLORS[item.category], textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                  {item.category}{item.complete && item.completed_at ? ` · done ${item.completed_at}` : ''}
                </p>
              </div>
              <button className="btn-icon btn-sm" onClick={() => removeItem(item.id)}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
