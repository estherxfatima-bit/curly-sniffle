import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { CONTENT_PILLARS, CONTENT_FORMATS, CONTENT_STATUSES } from '../../lib/constants'
import { Plus, Trash2 } from 'lucide-react'

const STATUS_COLORS = {
  'Idea': 'badge-muted',
  'Film next': 'badge-cobalt',
  'Pull clip': 'badge-warning',
  'Ready to edit': 'badge-accent',
  'Editing': 'badge-warning',
  'Ready to post': 'badge-success',
  'Posted': 'badge-success',
}

function InlineCell({ value, onChange, type = 'text', options }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        style={{ cursor: 'text', minWidth: '40px', display: 'inline-block', borderBottom: '1px dashed transparent' }}
        onMouseEnter={e => e.target.style.borderBottomColor = 'var(--border-light)'}
        onMouseLeave={e => e.target.style.borderBottomColor = 'transparent'}
      >
        {value || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>—</span>}
      </span>
    )
  }

  if (type === 'select') {
    return (
      <select
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { onChange(val); setEditing(false) }}
        autoFocus
        style={{ fontSize: '12px', padding: '2px 6px', width: 'auto' }}
      >
        <option value="">—</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    )
  }

  return (
    <input
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { onChange(val); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') { onChange(val); setEditing(false) } }}
      autoFocus
      style={{ fontSize: '12px', padding: '2px 6px', width: type === 'date' ? '130px' : '160px' }}
      type={type}
    />
  )
}

export default function IdeaDumpTab({ refreshKey = 0 }) {
  const { user } = useAuth()
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ pillar: '', status: '', batch: '' })
  const [batches, setBatches] = useState([])
  const [adding, setAdding] = useState(false)
  const [newIdea, setNewIdea] = useState({ title: '', pillar: '', format: '', status: 'Idea' })

  useEffect(() => {
    if (user) { loadIdeas(); loadBatches() }
  }, [user, refreshKey])

  async function loadIdeas() {
    setLoading(true)
    const { data } = await supabase.from('content_ideas').select('*').eq('user_id', user.id).order('created_at')
    setIdeas(data || [])
    setLoading(false)
  }

  async function loadBatches() {
    const { data } = await supabase.from('content_batches').select('id, name').eq('user_id', user.id)
    setBatches(data || [])
  }

  async function updateIdea(id, field, value) {
    await supabase.from('content_ideas').update({ [field]: value || null }).eq('id', id)
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  async function addIdea() {
    if (!newIdea.title.trim()) return
    const { data } = await supabase.from('content_ideas').insert({
      user_id: user.id,
      ...newIdea,
      production_stage: 'Idea',
    }).select().single()
    if (data) setIdeas(prev => [...prev, data])
    setNewIdea({ title: '', pillar: '', format: '', status: 'Idea' })
    setAdding(false)
  }

  async function deleteIdea(id) {
    await supabase.from('content_ideas').delete().eq('id', id)
    setIdeas(prev => prev.filter(i => i.id !== id))
  }

  const filtered = ideas.filter(i => {
    if (filters.pillar && i.pillar !== filters.pillar) return false
    if (filters.status && i.status !== filters.status) return false
    if (filters.batch && i.batch !== filters.batch) return false
    return true
  })

  const cols = [
    { key: 'title', label: 'Idea / Title', width: '200px' },
    { key: 'series', label: 'Series', width: '120px' },
    { key: 'pillar', label: 'Pillar', type: 'select', options: CONTENT_PILLARS, width: '140px' },
    { key: 'format', label: 'Format', type: 'select', options: CONTENT_FORMATS, width: '120px' },
    { key: 'status', label: 'Status', type: 'select', options: CONTENT_STATUSES, width: '110px' },
    { key: 'hook', label: 'Hook', width: '180px' },
    { key: 'caption_notes', label: 'Caption notes', width: '150px' },
    { key: 'repurpose_from', label: 'Repurpose from', width: '140px' },
    { key: 'batch', label: 'Batch', width: '80px' },
    { key: 'posted_date', label: 'Posted date', type: 'date', width: '120px' },
    { key: 'notes', label: 'Notes', width: '150px' },
    { key: 'reference_url', label: 'Reference URL', width: '150px' },
    { key: 'sound', label: 'Sound', width: '120px' },
  ]

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        <select value={filters.pillar} onChange={e => setFilters(p => ({ ...p, pillar: e.target.value }))} style={{ width: 'auto', fontSize: '12px', padding: '4px 10px' }}>
          <option value="">All pillars</option>
          {CONTENT_PILLARS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))} style={{ width: 'auto', fontSize: '12px', padding: '4px 10px' }}>
          <option value="">All statuses</option>
          {CONTENT_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filters.batch} onChange={e => setFilters(p => ({ ...p, batch: e.target.value }))} style={{ width: 'auto', fontSize: '12px', padding: '4px 10px' }}>
          <option value="">All batches</option>
          {batches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(v => !v)}>
          <Plus size={13} /> Add idea
        </button>
      </div>

      {loading ? (
        <p className="text-dim" style={{ textAlign: 'center', padding: '40px' }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '1400px' }}>
            <thead>
              <tr>
                <th style={{ width: '32px' }}>#</th>
                {cols.map(c => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {adding && (
                <tr style={{ background: 'var(--bg-3)' }}>
                  <td></td>
                  <td colSpan={3}>
                    <div className="flex gap-2">
                      <input value={newIdea.title} onChange={e => setNewIdea(p => ({ ...p, title: e.target.value }))} placeholder="Idea title" style={{ fontSize: '12px' }} autoFocus />
                    </div>
                  </td>
                  <td>
                    <select value={newIdea.pillar} onChange={e => setNewIdea(p => ({ ...p, pillar: e.target.value }))} style={{ fontSize: '12px', padding: '4px' }}>
                      <option value="">Pick pillar</option>
                      {CONTENT_PILLARS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={newIdea.format} onChange={e => setNewIdea(p => ({ ...p, format: e.target.value }))} style={{ fontSize: '12px', padding: '4px' }}>
                      <option value="">Pick format</option>
                      {CONTENT_FORMATS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={newIdea.status} onChange={e => setNewIdea(p => ({ ...p, status: e.target.value }))} style={{ fontSize: '12px', padding: '4px' }}>
                      {CONTENT_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td colSpan={cols.length - 5}></td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-primary btn-sm" onClick={addIdea}>Add</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>✕</button>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((idea, idx) => (
                <tr key={idea.id} style={{ opacity: idea.status === 'Posted' ? 0.5 : 1 }}>
                  <td><span className="mono">{idx + 1}</span></td>
                  {cols.map(col => (
                    <td key={col.key}>
                      {col.key === 'status' ? (
                        <div className="flex items-center gap-2">
                          <span className={`badge ${STATUS_COLORS[idea.status] || 'badge-muted'}`} style={{ fontSize: '9px' }}>
                            {idea.status || '—'}
                          </span>
                          <InlineCell value={idea.status} onChange={v => updateIdea(idea.id, 'status', v)} type="select" options={CONTENT_STATUSES} />
                        </div>
                      ) : (
                        <InlineCell
                          value={idea[col.key]}
                          onChange={v => updateIdea(idea.id, col.key, v)}
                          type={col.type || 'text'}
                          options={col.options}
                        />
                      )}
                    </td>
                  ))}
                  <td>
                    <button className="btn-icon btn" onClick={() => deleteIdea(idea.id)}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty-state"><p>No ideas match the current filters.</p></div>
          )}
        </div>
      )}
    </div>
  )
}
