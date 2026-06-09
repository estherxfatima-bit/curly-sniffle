import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { Pin, X, ChevronDown, ChevronUp, Search } from 'lucide-react'

const TYPE_LABELS = {
  weekly_plan:      'Weekly Plan',
  daily_focus:      'Daily Focus',
  finance_summary:  'Finance',
  content_analysis: 'Content',
  smart_batch:      'Smart Batch',
  brain_dump:       'Brain Dump',
  custom:           'Custom',
}

const TYPE_CLASSES = {
  weekly_plan:      'badge-career',
  daily_focus:      'badge-career',
  finance_summary:  'badge-finance',
  content_analysis: 'badge-creative',
  smart_batch:      'badge-creative',
  brain_dump:       'badge-personal',
  custom:           'badge-muted',
}

function AILogDecoration() {
  return (
    <svg width="100" height="70" viewBox="0 0 100 70" fill="none">
      <rect x="10" y="12" width="55" height="8" rx="4" fill="currentColor" opacity="0.15"/>
      <rect x="10" y="26" width="40" height="6" rx="3" fill="currentColor" opacity="0.1"/>
      <rect x="10" y="38" width="50" height="6" rx="3" fill="currentColor" opacity="0.1"/>
      <rect x="10" y="50" width="35" height="6" rx="3" fill="currentColor" opacity="0.1"/>
      <circle cx="80" cy="35" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
      <path d="M74 35 L80 29 L86 35" stroke="currentColor" strokeWidth="1.5" opacity="0.3" fill="none"/>
    </svg>
  )
}

export default function AILogPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})

  useEffect(() => { if (user) loadEntries() }, [user])

  async function loadEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('ai_log')
      .select('*')
      .eq('user_id', user.id)
      .eq('dismissed', false)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  async function togglePin(id, current) {
    await supabase.from('ai_log').update({ pinned: !current }).eq('id', id)
    setEntries(prev => prev.map(e => e.id === id ? { ...e, pinned: !current } : e)
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.created_at) - new Date(a.created_at))
    )
  }

  async function dismiss(id) {
    await supabase.from('ai_log').update({ dismissed: true }).eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const filtered = entries.filter(e => {
    if (typeFilter && e.type !== typeFilter) return false
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.response.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const types = [...new Set(entries.map(e => e.type))]

  return (
    <div>
      <div className="page-header header-career mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>AI Log</h1>
            <p>Every AI response saved — nothing disappears unless you dismiss it</p>
          </div>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--career)' }}><AILogDecoration /></div>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-5 wrap">
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries…" style={{ paddingLeft: 34 }} />
        </div>
        <div className="flex items-center gap-2 wrap">
          <button onClick={() => setTypeFilter('')} className={`btn btn-sm ${!typeFilter ? 'btn-career' : 'btn-ghost'}`} style={!typeFilter ? { color: '#fff' } : {}}>All</button>
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? '' : t)} className={`btn btn-sm ${typeFilter === t ? 'btn-career' : 'btn-ghost'}`} style={typeFilter === t ? { color: '#fff' } : {}}>
              {TYPE_LABELS[t] || t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No AI log entries yet. AI responses from Weekly Review, Content Analysis, and the Planning Panel will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(entry => {
            const isExpanded = !!expanded[entry.id]
            const preview = entry.response.split('\n').filter(Boolean).slice(0, 2).join(' ')
            return (
              <div key={entry.id} className={`card ${entry.pinned ? 'card-career' : ''} fade-in`} style={{ position: 'relative' }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className={`badge ${TYPE_CLASSES[entry.type] || 'badge-muted'}`}>{TYPE_LABELS[entry.type] || entry.type}</span>
                    {entry.pinned && <span className="badge badge-career" style={{ fontSize: 9 }}>📌 Pinned</span>}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
                      {format(new Date(entry.created_at), 'EEE d MMM, HH:mm')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                    <button className="btn-icon btn" onClick={() => togglePin(entry.id, entry.pinned)} title={entry.pinned ? 'Unpin' : 'Pin'} style={{ color: entry.pinned ? 'var(--career)' : undefined }}>
                      <Pin size={13} />
                    </button>
                    <button className="btn-icon btn" onClick={() => dismiss(entry.id)} title="Dismiss"><X size={13} /></button>
                  </div>
                </div>

                <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>{entry.title}</h3>

                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
                  {isExpanded ? entry.response : preview}
                  {!isExpanded && entry.response.length > preview.length && '…'}
                </p>

                {entry.response.length > preview.length && (
                  <button
                    onClick={() => setExpanded(p => ({ ...p, [entry.id]: !p[entry.id] }))}
                    style={{ background: 'transparent', color: 'var(--career)', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {isExpanded ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> Show full response</>}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
