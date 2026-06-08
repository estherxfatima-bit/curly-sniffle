import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { buildICSFile, buildICSEvent, downloadICS } from '../../lib/ics'
import { Plus, X, Calendar } from 'lucide-react'
import { startOfWeek, addDays, format } from 'date-fns'

function CompletionRing({ done, total, size = 48 }) {
  const pct = total > 0 ? done / total : 0
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct)
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-4)" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
      />
      <text x="50%" y="54%" textAnchor="middle" fill="var(--text-2)" fontSize="10"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontFamily: 'var(--font-mono)' }}
        dominantBaseline="middle"
      >
        {Math.round(pct * 100)}%
      </text>
    </svg>
  )
}

export default function BatchesTab() {
  const { user } = useAuth()
  const [batches, setBatches] = useState([])
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newBatch, setNewBatch] = useState({ name: '', description: '' })
  const [dragItem, setDragItem] = useState(null)

  useEffect(() => {
    if (user) loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)
    const [bRes, iRes] = await Promise.all([
      supabase.from('content_batches').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('content_ideas').select('*').eq('user_id', user.id),
    ])
    setBatches(bRes.data || [])
    setIdeas(iRes.data || [])
    setLoading(false)
  }

  async function addBatch() {
    if (!newBatch.name.trim()) return
    const { data } = await supabase.from('content_batches').insert({
      user_id: user.id,
      name: newBatch.name,
      description: newBatch.description,
    }).select().single()
    if (data) setBatches(prev => [...prev, data])
    setNewBatch({ name: '', description: '' })
    setShowAdd(false)
  }

  async function moveToBatch(ideaId, batchName) {
    await supabase.from('content_ideas').update({ batch: batchName }).eq('id', ideaId)
    setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, batch: batchName } : i))
  }

  async function markFilmingWeek(batch) {
    const nextMonday = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 })
    const batchIdeas = ideas.filter(i => i.batch === batch.name)
    const events = batchIdeas.map(idea => buildICSEvent({
      summary: `Film: ${idea.title}`,
      description: `Batch: ${batch.name}\nPillar: ${idea.pillar}\nFormat: ${idea.format}`,
      start: nextMonday,
      end: addDays(nextMonday, 1),
    }))
    const ics = buildICSFile(events)
    downloadICS(`${batch.name.replace(/\s+/g, '-')}-filming-week.ics`, ics)
  }

  const unassigned = ideas.filter(i => !i.batch)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-dim">Group ideas into filming batches. Drag ideas to assign them.</p>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(v => !v)}>
          <Plus size={13} /> New batch
        </button>
      </div>

      {showAdd && (
        <div className="card mb-4">
          <div className="flex gap-3">
            <input value={newBatch.name} onChange={e => setNewBatch(p => ({ ...p, name: e.target.value }))} placeholder="Batch name (e.g. Batch 1)" style={{ flex: 1 }} autoFocus />
            <input value={newBatch.description} onChange={e => setNewBatch(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" style={{ flex: 2 }} />
            <button className="btn btn-primary btn-sm" onClick={addBatch}>Create</button>
            <button className="btn-icon btn" onClick={() => setShowAdd(false)}><X size={14} /></button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-dim" style={{ textAlign: 'center', padding: '40px' }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {/* Unassigned */}
          {unassigned.length > 0 && (
            <div
              className="card"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                const id = e.dataTransfer.getData('ideaId')
                moveToBatch(id, null)
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="mono">Unassigned</span>
                <span className="badge badge-muted">{unassigned.length}</span>
              </div>
              {unassigned.map(idea => (
                <div
                  key={idea.id}
                  draggable
                  onDragStart={e => e.dataTransfer.setData('ideaId', idea.id)}
                  style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius)', padding: '8px 10px', marginBottom: '6px', cursor: 'grab', fontSize: '12px' }}
                >
                  {idea.title}
                  {idea.pillar && <span className="badge badge-accent" style={{ marginLeft: '6px', fontSize: '9px' }}>{idea.pillar.split(' ')[0]}</span>}
                </div>
              ))}
            </div>
          )}

          {batches.map(batch => {
            const batchIdeas = ideas.filter(i => i.batch === batch.name)
            const posted = batchIdeas.filter(i => i.status === 'Posted').length
            return (
              <div
                key={batch.id}
                className="card"
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  const id = e.dataTransfer.getData('ideaId')
                  moveToBatch(id, batch.name)
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p style={{ fontWeight: '500', fontSize: '14px' }}>{batch.name}</p>
                    {batch.description && <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{batch.description}</p>}
                  </div>
                  <CompletionRing done={posted} total={batchIdeas.length} />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  {batchIdeas.map(idea => (
                    <div
                      key={idea.id}
                      draggable
                      onDragStart={e => e.dataTransfer.setData('ideaId', idea.id)}
                      style={{
                        background: 'var(--bg-3)',
                        borderRadius: 'var(--radius)',
                        padding: '8px 10px',
                        marginBottom: '6px',
                        cursor: 'grab',
                        fontSize: '12px',
                        opacity: idea.status === 'Posted' ? 0.5 : 1,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span>{idea.title}</span>
                        <span className={`badge badge-muted`} style={{ fontSize: '9px' }}>{idea.status}</span>
                      </div>
                      {idea.format && <p style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '3px' }}>{idea.format}</p>}
                    </div>
                  ))}
                  {batchIdeas.length === 0 && (
                    <p style={{ fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic', padding: '8px 0' }}>Drop ideas here</p>
                  )}
                </div>

                <button
                  className="btn btn-ghost btn-sm w-full"
                  onClick={() => markFilmingWeek(batch)}
                  style={{ justifyContent: 'center' }}
                >
                  <Calendar size={13} />
                  Export filming week to Apple Calendar
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
