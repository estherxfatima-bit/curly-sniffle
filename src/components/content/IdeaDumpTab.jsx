import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useContentPillars } from '../../hooks/useContentPillars'
import { CONTENT_FORMATS, CONTENT_STATUSES } from '../../lib/constants'
import { Plus, Trash2 } from 'lucide-react'

const STATUS_COLORS = {
  'Idea': 'badge-muted',
  'Film next': 'badge-cobalt',
  'Ready to edit': 'badge-accent',
  'Pull clip': 'badge-warning',
  'Posted': 'badge-success',
}

function InlineCell({ value, onChange, type = 'text', options, renderDisplay }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')

  useEffect(() => { setVal(value || '') }, [value])

  function commit() {
    setEditing(false)
    if ((value || '') !== val) onChange(val)
  }

  if (!editing) {
    return (
      <span className="inline-cell" onClick={() => setEditing(true)}>
        {renderDisplay
          ? renderDisplay(value)
          : (value || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>—</span>)}
      </span>
    )
  }

  if (type === 'select') {
    return (
      <select
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
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
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit() }}
      autoFocus
      style={{ fontSize: '12px', padding: '2px 6px', width: type === 'date' ? '130px' : '160px' }}
      type={type}
    />
  )
}

export default function IdeaDumpTab({ refreshKey = 0 }) {
  const { user } = useAuth()
  const CONTENT_PILLARS = useContentPillars(user?.id)
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ pillar: '', status: '', batch: '' })
  const [batches, setBatches] = useState([])

  useEffect(() => {
    if (user) { loadIdeas(); loadBatches() }
  }, [user, refreshKey])

  async function loadIdeas() {
    setLoading(true)
    const { data, error } = await supabase.from('content_ideas').select('*').eq('user_id', user.id).order('created_at')
    if (error) setError(error.message)
    setIdeas(data || [])
    setLoading(false)
  }

  async function loadBatches() {
    const { data, error } = await supabase.from('content_batches').select('id, name').eq('user_id', user.id)
    if (error) setError(error.message)
    setBatches(data || [])
  }

  async function updateIdea(id, field, value) {
    const clean = value === '' ? null : value
    const { error } = await supabase.from('content_ideas').update({ [field]: clean }).eq('id', id)
    if (error) { setError(error.message); return }
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, [field]: clean } : i))
  }

  async function addIdea(position) {
    const { data, error } = await supabase.from('content_ideas').insert({
      user_id: user.id,
      title: 'New idea',
      status: 'Idea',
      production_stage: 'Idea',
    }).select().single()
    if (error) { setError(error.message); return }
    setIdeas(prev => position === 'top' ? [data, ...prev] : [...prev, data])
  }

  async function deleteIdea(id) {
    const { error } = await supabase.from('content_ideas').delete().eq('id', id)
    if (error) { setError(error.message); return }
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
    { key: 'pillar', label: 'Pillar', type: 'select', options: CONTENT_PILLARS, width: '160px' },
    { key: 'format', label: 'Format', type: 'select', options: CONTENT_FORMATS, width: '150px' },
    {
      key: 'status', label: 'Status', type: 'select', options: CONTENT_STATUSES, width: '130px',
      renderDisplay: v => <span className={`badge ${STATUS_COLORS[v] || 'badge-muted'}`} style={{ fontSize: '9px' }}>{v || 'Idea'}</span>,
    },
    { key: 'hook', label: 'Hook', width: '180px' },
    { key: 'caption_notes', label: 'Caption notes', width: '150px' },
    { key: 'repurpose_from', label: 'Repurpose from', width: '140px' },
    { key: 'batch', label: 'Batch', type: 'select', options: batches.map(b => b.name), width: '110px' },
    { key: 'posted_date', label: 'Posted date', type: 'date', width: '120px' },
    { key: 'notes', label: 'Notes', width: '150px' },
    { key: 'reference_url', label: 'Reference URL', width: '150px' },
    { key: 'sound', label: 'Sound', width: '120px' },
  ]

  const AddRowButton = ({ position }) => (
    <button className="btn btn-ghost btn-sm flex items-center gap-2" onClick={() => addIdea(position)}>
      <Plus size={13} /> Add row
    </button>
  )

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
        <AddRowButton position="top" />
      </div>

      {error && (
        <div className="card mb-4" style={{ borderLeft: '3px solid var(--personal)' }}>
          <p style={{ fontSize: 12, color: 'var(--personal)' }}>Error: {error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-dim" style={{ textAlign: 'center', padding: '40px' }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '1500px' }}>
            <thead>
              <tr>
                <th style={{ width: '32px' }}>#</th>
                {cols.map(c => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((idea, idx) => (
                <tr key={idea.id} style={{ opacity: idea.status === 'Posted' ? 0.5 : 1 }}>
                  <td><span className="mono">{idx + 1}</span></td>
                  {cols.map(col => (
                    <td key={col.key}>
                      <InlineCell
                        value={idea[col.key]}
                        onChange={v => updateIdea(idea.id, col.key, v)}
                        type={col.type || 'text'}
                        options={col.options}
                        renderDisplay={col.renderDisplay}
                      />
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

      <div className="flex justify-end mt-4">
        <AddRowButton position="bottom" />
      </div>
    </div>
  )
}
