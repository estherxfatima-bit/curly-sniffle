import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useContentPillars } from '../../hooks/useContentPillars'
import { PRODUCTION_STAGES, CONTENT_FORMATS } from '../../lib/constants'
import { smartBatchIdeas } from '../../lib/claude'
import { Sparkles, X, ChevronRight } from 'lucide-react'

const EDITING_CHECKLIST = [
  'rough_cut',
  'captions',
  'sound',
  'colour_grade',
  'caption_written',
  'hook_reviewed',
]

const CHECKLIST_LABELS = {
  rough_cut: 'Rough cut',
  captions: 'Captions',
  sound: 'Sound mix',
  colour_grade: 'Colour grade',
  caption_written: 'Caption written',
  hook_reviewed: 'Hook reviewed',
}

function ProgressRing({ label, value, total, color = 'var(--accent)' }) {
  if (!total) return null
  return (
    <div style={{ textAlign: 'center', minWidth: '80px' }}>
      <p style={{ fontSize: '22px', fontFamily: 'var(--font-serif)', color }}>{value}</p>
      <p className="mono" style={{ fontSize: '9px' }}>{label}</p>
    </div>
  )
}

export default function ProductionPipelineTab() {
  const { user } = useAuth()
  const CONTENT_PILLARS = useContentPillars(user?.id)
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ pillar: '', format: '' })
  const [selected, setSelected] = useState(null) // idea for detail modal
  const [smartBatches, setSmartBatches] = useState(null)
  const [smartLoading, setSmartLoading] = useState(false)
  const [smartError, setSmartError] = useState(null)

  useEffect(() => {
    if (user) loadIdeas()
  }, [user])

  async function loadIdeas() {
    setLoading(true)
    const { data } = await supabase.from('content_ideas').select('*').eq('user_id', user.id)
    setIdeas(data || [])
    setLoading(false)
  }

  async function moveStage(idea, stage) {
    await supabase.from('content_ideas').update({ production_stage: stage }).eq('id', idea.id)
    setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, production_stage: stage } : i))
    // Open detail modal if moving to Filmed or Editing
    if (stage === 'Filmed' || stage === 'Editing') {
      setSelected({ ...idea, production_stage: stage })
    }
  }

  async function saveFilmingNotes(id, notes) {
    await supabase.from('content_ideas').update({ filming_notes: notes }).eq('id', id)
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, filming_notes: notes } : i))
  }

  async function updateChecklist(id, key, checked) {
    const idea = ideas.find(i => i.id === id)
    const current = idea?.editing_checklist || {}
    const updated = { ...current, [key]: checked }
    await supabase.from('content_ideas').update({ editing_checklist: updated }).eq('id', id)
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, editing_checklist: updated } : i))
  }

  async function runSmartBatch() {
    setSmartLoading(true)
    setSmartError(null)
    try {
      const eligible = ideas.filter(i => i.production_stage !== 'Posted')
      const result = await smartBatchIdeas(eligible)
      setSmartBatches(result)
    } catch (e) {
      setSmartError(e.message)
    } finally {
      setSmartLoading(false)
    }
  }

  const filtered = ideas.filter(i => {
    if (filters.pillar && i.pillar !== filters.pillar) return false
    if (filters.format && i.format !== filters.format) return false
    return true
  })

  const stages = PRODUCTION_STAGES
  const stageIdeas = (stage) => filtered.filter(i => (i.production_stage || 'Idea') === stage)

  const total = ideas.length
  const filmed = ideas.filter(i => ['Filmed', 'Editing', 'Ready to post', 'Posted'].includes(i.production_stage)).length
  const editing = ideas.filter(i => ['Editing', 'Ready to post'].includes(i.production_stage)).length
  const posted = ideas.filter(i => i.production_stage === 'Posted').length

  return (
    <div>
      {/* Progress summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '16px 20px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: '20px' }}>
        <ProgressRing label="Total" value={total} total={total} color="var(--text-2)" />
        <div style={{ width: '1px', height: '40px', background: 'var(--border)' }} />
        <ProgressRing label="Filmed" value={filmed} total={total} color="var(--cobalt)" />
        <ProgressRing label="Editing" value={editing} total={total} color="var(--warning)" />
        <ProgressRing label="Posted" value={posted} total={total} color="var(--success)" />

        <div style={{ flex: 1 }} />

        <button className="btn btn-accent btn-sm" onClick={runSmartBatch} disabled={smartLoading}>
          <Sparkles size={13} />
          {smartLoading ? 'Analysing…' : 'Smart batch'}
        </button>
      </div>

      {/* Smart batch results */}
      {smartError && (
        <div style={{ background: 'rgba(192,70,74,0.1)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '16px', color: 'var(--danger)', fontSize: '13px' }}>
          {smartError}
        </div>
      )}

      {smartBatches && (
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 style={{ fontSize: '1rem' }}>Smart filming clusters</h3>
            <button className="btn-icon btn" onClick={() => setSmartBatches(null)}><X size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {smartBatches.clusters?.map((cluster, i) => (
              <div key={i} style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
                <p style={{ fontWeight: '500', fontSize: '13px', marginBottom: '4px' }}>{cluster.name}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '8px', lineHeight: '1.5' }}>{cluster.rationale}</p>
                {cluster.estimatedTime && <p className="mono mb-2">{cluster.estimatedTime}</p>}
                {cluster.ideas?.map(idx => {
                  const idea = ideas[idx - 1]
                  return idea ? (
                    <p key={idx} style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '2px' }}>• {idea.title}</p>
                  ) : null
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <select value={filters.pillar} onChange={e => setFilters(p => ({ ...p, pillar: e.target.value }))} style={{ width: 'auto', fontSize: '12px', padding: '4px 10px' }}>
          <option value="">All pillars</option>
          {CONTENT_PILLARS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={filters.format} onChange={e => setFilters(p => ({ ...p, format: e.target.value }))} style={{ width: 'auto', fontSize: '12px', padding: '4px 10px' }}>
          <option value="">All formats</option>
          {CONTENT_FORMATS.map(f => <option key={f}>{f}</option>)}
        </select>
      </div>

      {/* Kanban */}
      {loading ? (
        <p className="text-dim" style={{ textAlign: 'center', padding: '40px' }}>Loading…</p>
      ) : (
        <div className="kanban-board">
          {stages.map(stage => (
            <div key={stage} className="kanban-column">
              <div className="kanban-column-header">
                <span>{stage}</span>
                <span style={{ color: 'var(--text-2)' }}>{stageIdeas(stage).length}</span>
              </div>
              {stageIdeas(stage).map(idea => (
                <KanbanCard
                  key={idea.id}
                  idea={idea}
                  stages={stages}
                  onMove={moveStage}
                  onClick={() => setSelected(idea)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <IdeaDetailModal
          idea={selected}
          onClose={() => setSelected(null)}
          onSaveNotes={saveFilmingNotes}
          onChecklistChange={updateChecklist}
          onMove={moveStage}
          stages={stages}
        />
      )}
    </div>
  )
}

function KanbanCard({ idea, stages, onMove, onClick }) {
  const nextStage = stages[stages.indexOf(idea.production_stage || 'Idea') + 1]
  return (
    <div className="kanban-card" onClick={onClick}>
      <p style={{ fontSize: '12px', fontWeight: '500', marginBottom: '6px', lineHeight: '1.4' }}>
        {idea.title}
      </p>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {idea.pillar && <span className="badge badge-accent" style={{ fontSize: '9px' }}>{idea.pillar.split(' ')[0]}</span>}
        {idea.format && <span className="badge badge-muted" style={{ fontSize: '9px' }}>{idea.format}</span>}
      </div>
      {nextStage && (
        <button
          className="btn btn-ghost btn-sm w-full"
          style={{ justifyContent: 'center', fontSize: '11px', padding: '4px' }}
          onClick={e => { e.stopPropagation(); onMove(idea, nextStage) }}
        >
          → {nextStage}
        </button>
      )}
    </div>
  )
}

function IdeaDetailModal({ idea, onClose, onSaveNotes, onChecklistChange, onMove, stages }) {
  const [notes, setNotes] = useState(idea.filming_notes || '')
  const checklist = idea.editing_checklist || {}
  const isFilming = idea.production_stage === 'Filmed'
  const isEditing = idea.production_stage === 'Editing'

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.1rem' }}>{idea.title}</h2>
          <button className="btn-icon btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="flex gap-2 mb-4">
          {idea.pillar && <span className="badge badge-accent">{idea.pillar}</span>}
          {idea.format && <span className="badge badge-muted">{idea.format}</span>}
          <span className="badge badge-cobalt">{idea.production_stage || 'Idea'}</span>
        </div>

        {/* Move stage */}
        <div className="form-group">
          <label>Move to stage</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {stages.map(s => (
              <button
                key={s}
                className={`btn btn-sm ${(idea.production_stage || 'Idea') === s ? 'btn-accent' : 'btn-ghost'}`}
                onClick={() => onMove(idea, s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Filming notes (shown when Filmed) */}
        {isFilming && (
          <div className="form-group">
            <label>Filming notes (B-roll, sound, issues)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes from the filming session…" />
            <button className="btn btn-primary btn-sm mt-2" onClick={() => onSaveNotes(idea.id, notes)}>
              Save notes
            </button>
          </div>
        )}

        {/* Editing checklist (shown when Editing) */}
        {isEditing && (
          <div className="form-group">
            <label>Editing checklist</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {EDITING_CHECKLIST.map(key => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: 'var(--text)', textTransform: 'none', letterSpacing: 0, fontSize: '13px', fontFamily: 'var(--font-body)' }}>
                  <input
                    type="checkbox"
                    checked={!!checklist[key]}
                    onChange={e => onChecklistChange(idea.id, key, e.target.checked)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  {CHECKLIST_LABELS[key]}
                </label>
              ))}
            </div>
          </div>
        )}

        {idea.hook && (
          <div className="form-group">
            <label>Hook</label>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', fontStyle: 'italic' }}>"{idea.hook}"</p>
          </div>
        )}

        {idea.caption_notes && (
          <div className="form-group">
            <label>Caption notes</label>
            <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>{idea.caption_notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
