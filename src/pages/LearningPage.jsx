import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import {
  GraduationCap, Plus, X, ChevronLeft, ChevronRight, ChevronDown,
  BookOpen, Video, Mic, FileText, Wrench, Globe, Lock, Unlock,
  Check, Circle, ArrowUp, ArrowDown, Trash2, Edit2, ExternalLink,
  Sparkles, Loader, Link2, Image, FileCheck, Star,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import ArcRing from '../components/ui/ArcRing'
import { generateCurriculum, summariseStepNotes } from '../lib/learningClaude'

const L = 'var(--learning)'
const LT = 'var(--learning-tint)'
const LD = 'var(--learning-dim)'

const CATEGORIES = ['Creative Skills', 'Marketing & Strategy', 'Tech & Tools', 'Business & Finance', 'Personal Development', 'Other']
const STATUSES = ['Not started', 'In progress', 'On hold', 'Complete']
const RESOURCE_TYPES = ['Course', 'Book', 'Article', 'Video', 'Podcast', 'Tool', 'Other']
const STEP_STATUSES = ['Not started', 'In progress', 'Done']

const STATUS_COLORS = {
  'Not started': 'var(--text-3)',
  'In progress': 'var(--learning)',
  'On hold':     'var(--warning)',
  'Complete':    'var(--success)',
}

const TYPE_ICONS = {
  Course: BookOpen, Book: BookOpen, Article: FileText,
  Video: Video, Podcast: Mic, Tool: Wrench, Other: Globe,
}

function pct(steps) {
  if (!steps.length) return 0
  return Math.round((steps.filter(s => s.status === 'Done').length / steps.length) * 100)
}

// ─── Track card (list view) ────────────────────────────────────────────────────

function TrackCard({ track, steps, onClick }) {
  const progress = pct(steps)
  const statusColor = STATUS_COLORS[track.status]
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${L}`,
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
    >
      {/* Indigo header gradient */}
      <div style={{ background: `linear-gradient(135deg, ${LT} 0%, var(--card-bg) 100%)`, padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-2">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-2 mb-1">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: L }}>{track.category}</span>
              {track.private && <Lock size={10} color="var(--text-3)" />}
            </div>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700, lineHeight: 1.25, color: 'var(--text)' }}>{track.name}</p>
          </div>
          <ArcRing value={progress} max={100} size={52} strokeWidth={5} color={L} label={`${progress}%`} fontSize={10} />
        </div>
      </div>

      <div style={{ padding: '10px 16px 14px' }}>
        {track.why_text && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', marginBottom: 8, lineHeight: 1.4 }}>{track.why_text}</p>
        )}
        <div className="flex items-center gap-3 wrap">
          <span style={{ fontSize: 11, color: statusColor, fontWeight: 600 }}>{track.status}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
          {track.target_date && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
              by {format(new Date(track.target_date), 'd MMM yyyy')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step item (curriculum) ────────────────────────────────────────────────────

function StepItem({ step, index, total, aiEnabled, userId, onUpdate, onDelete, onMove }) {
  const [expanded, setExpanded] = useState(false)
  const [editTitle, setEditTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(step.title)
  const [reflectionSummary, setReflectionSummary] = useState(null)
  const [summarising, setSummarising] = useState(false)
  const [showAddAttachment, setShowAddAttachment] = useState(false)
  const [attachForm, setAttachForm] = useState({ type: 'url', url: '', display_name: '' })
  const [attachments, setAttachments] = useState([])

  useEffect(() => {
    if (expanded) loadAttachments()
  }, [expanded])

  async function loadAttachments() {
    const { data } = await supabase.from('learning_attachments').select('*').eq('step_id', step.id).order('created_at')
    setAttachments(data || [])
  }

  async function addAttachment() {
    if (!attachForm.url) return
    await supabase.from('learning_attachments').insert({ step_id: step.id, ...attachForm })
    setAttachForm({ type: 'url', url: '', display_name: '' })
    setShowAddAttachment(false)
    loadAttachments()
  }

  async function deleteAttachment(id) {
    await supabase.from('learning_attachments').delete().eq('id', id)
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  async function handleSummarise() {
    setSummarising(true)
    try {
      const summary = await summariseStepNotes({ stepTitle: step.title, notes: step.notes, reflectionNotes: step.reflection_notes, userId })
      setReflectionSummary(summary)
    } catch (e) { console.error(e) }
    setSummarising(false)
  }

  async function acceptSummary() {
    const newReflection = step.reflection_notes ? `${step.reflection_notes}\n\n${reflectionSummary}` : reflectionSummary
    await onUpdate(step.id, { reflection_notes: newReflection })
    setReflectionSummary(null)
  }

  const isDone = step.status === 'Done'

  return (
    <div style={{
      borderRadius: 8,
      border: `1px solid ${expanded ? L : 'var(--border)'}`,
      background: isDone ? 'var(--bg-2)' : 'var(--card-bg)',
      transition: 'all 0.15s',
      overflow: 'hidden',
    }}>
      <div className="flex items-center gap-3" style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
        {/* Status toggle */}
        <button
          onClick={e => { e.stopPropagation(); const next = STEP_STATUSES[(STEP_STATUSES.indexOf(step.status) + 1) % STEP_STATUSES.length]; onUpdate(step.id, { status: next }) }}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20 }}
        >
          {isDone
            ? <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10} color="#fff" strokeWidth={3} /></div>
            : step.status === 'In progress'
              ? <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${L}`, background: LD }} />
              : <Circle size={18} color="var(--text-3)" />
          }
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {editTitle ? (
            <input
              autoFocus value={titleVal}
              onChange={e => setTitleVal(e.target.value)}
              onBlur={() => { onUpdate(step.id, { title: titleVal }); setEditTitle(false) }}
              onKeyDown={e => { if (e.key === 'Enter') { onUpdate(step.id, { title: titleVal }); setEditTitle(false) } }}
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 13, fontWeight: isDone ? 400 : 500, width: '100%' }}
            />
          ) : (
            <span style={{ fontSize: 13, fontWeight: isDone ? 400 : 500, color: isDone ? 'var(--text-3)' : 'var(--text)', textDecoration: isDone ? 'line-through' : 'none' }}>
              {step.title}
            </span>
          )}
          {step.estimated_minutes && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginLeft: 8 }}>
              ~{step.estimated_minutes >= 60 ? `${(step.estimated_minutes / 60).toFixed(1)}h` : `${step.estimated_minutes}m`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {step.is_weekly_focus && <Star size={12} color="#d4af37" fill="#d4af37" title="Weekly focus" />}
          <button className="btn-icon btn btn-xs" onClick={() => onMove(step.id, -1)} disabled={index === 0} title="Move up"><ArrowUp size={11} /></button>
          <button className="btn-icon btn btn-xs" onClick={() => onMove(step.id, 1)} disabled={index === total - 1} title="Move down"><ArrowDown size={11} /></button>
          <button className="btn-icon btn btn-xs" onClick={() => setEditTitle(v => !v)} title="Edit title"><Edit2 size={11} /></button>
          <button className="btn-icon btn btn-xs" style={{ color: 'var(--danger)' }} onClick={() => onDelete(step.id)} title="Delete"><Trash2 size={11} /></button>
          {expanded ? <ChevronDown size={13} color="var(--text-3)" /> : <ChevronRight size={13} color="var(--text-3)" />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 12px 14px', borderTop: '1px solid var(--border)' }}>
          {/* Status selector */}
          <div className="flex items-center gap-2 mt-3 mb-3 wrap">
            {STEP_STATUSES.map(s => (
              <button key={s}
                className="btn btn-xs"
                style={{ background: step.status === s ? L : 'var(--bg-2)', color: step.status === s ? '#fff' : 'var(--text-3)', border: 'none' }}
                onClick={() => onUpdate(step.id, { status: s })}
              >{s}</button>
            ))}
            <label className="flex items-center gap-1" style={{ fontSize: 11, color: 'var(--text-3)', cursor: 'pointer', marginLeft: 4 }}>
              <input type="checkbox" checked={step.is_weekly_focus} onChange={e => onUpdate(step.id, { is_weekly_focus: e.target.checked })} />
              Weekly focus
            </label>
          </div>

          {step.description && (
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.5 }}>{step.description}</p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 10 }}>Notes</label>
              <textarea value={step.notes || ''} onChange={e => onUpdate(step.id, { notes: e.target.value })}
                style={{ minHeight: 70, fontSize: 12 }} placeholder="Notes while working through this…" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 10 }}>What I learned</label>
              <textarea value={step.reflection_notes || ''} onChange={e => onUpdate(step.id, { reflection_notes: e.target.value })}
                style={{ minHeight: 70, fontSize: 12 }} placeholder="Key takeaways and reflections…" />
              {aiEnabled && (
                <button className="btn btn-xs btn-ghost mt-1 flex items-center gap-1" onClick={handleSummarise} disabled={summarising}>
                  {summarising ? <Loader size={11} className="spin" /> : <Sparkles size={11} />}
                  Summarise my notes
                </button>
              )}
            </div>
          </div>

          {reflectionSummary && (
            <div style={{ background: LT, border: `1px solid ${L}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <p style={{ fontSize: 11, color: L, fontWeight: 600, marginBottom: 4 }}>AI summary</p>
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{reflectionSummary}</p>
              <div className="flex gap-2 mt-2">
                <button className="btn btn-xs" style={{ background: L, color: '#fff', border: 'none' }} onClick={acceptSummary}>Accept — append to reflection</button>
                <button className="btn btn-xs btn-ghost" onClick={() => setReflectionSummary(null)}>Dismiss</button>
              </div>
            </div>
          )}

          {/* Attachments */}
          <div>
            <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Attachments</p>
            {attachments.map(a => (
              <div key={a.id} className="flex items-center gap-2 mb-2">
                {a.type === 'image' ? <Image size={12} color={L} /> : a.type === 'pdf' ? <FileCheck size={12} color="#d4af37" /> : <Link2 size={12} color="var(--text-3)" />}
                <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: L, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.display_name || a.url}
                </a>
                <button className="btn-icon btn btn-xs" onClick={() => deleteAttachment(a.id)}><Trash2 size={10} /></button>
              </div>
            ))}
            {showAddAttachment ? (
              <div className="flex items-center gap-2 wrap mt-1">
                <select value={attachForm.type} onChange={e => setAttachForm(p => ({ ...p, type: e.target.value }))} style={{ fontSize: 11, padding: '3px 6px' }}>
                  <option value="url">Link</option>
                  <option value="image">Image URL</option>
                  <option value="pdf">PDF URL / Certificate</option>
                </select>
                <input value={attachForm.url} onChange={e => setAttachForm(p => ({ ...p, url: e.target.value }))} placeholder="URL" style={{ flex: 1, fontSize: 12, minWidth: 120 }} />
                <input value={attachForm.display_name} onChange={e => setAttachForm(p => ({ ...p, display_name: e.target.value }))} placeholder="Label (optional)" style={{ fontSize: 12, width: 120 }} />
                <button className="btn btn-xs" style={{ background: L, color: '#fff', border: 'none' }} onClick={addAttachment}>Add</button>
                <button className="btn btn-xs btn-ghost" onClick={() => setShowAddAttachment(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn-xs btn-ghost mt-1" onClick={() => setShowAddAttachment(true)}><Plus size={10} /> add attachment</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Resource card ────────────────────────────────────────────────────────────

function ResourceCard({ resource, onDelete }) {
  const Icon = TYPE_ICONS[resource.type] || Globe
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
      <div className="flex items-start justify-between gap-2">
        <div style={{ flex: 1 }}>
          <div className="flex items-center gap-2 mb-1">
            <Icon size={13} color={L} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: L }}>{resource.type}</span>
            {resource.platform && <span style={{ fontSize: 10, color: 'var(--text-3)', background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 4 }}>{resource.platform}</span>}
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{resource.title}</p>
          {resource.cost && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>£{resource.cost}</p>}
          {resource.notes && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.4 }}>{resource.notes}</p>}
        </div>
        <div className="flex items-center gap-1">
          {resource.url && <a href={resource.url} target="_blank" rel="noreferrer" className="btn-icon btn btn-xs"><ExternalLink size={11} /></a>}
          <button className="btn-icon btn btn-xs" style={{ color: 'var(--danger)' }} onClick={() => onDelete(resource.id)}><Trash2 size={11} /></button>
        </div>
      </div>
    </div>
  )
}

// ─── AI Curriculum panel ──────────────────────────────────────────────────────

function AICurriculumPanel({ track, resources, userId, onAddItems, onDismiss }) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [selectedSteps, setSelectedSteps] = useState(new Set())
  const [selectedModules, setSelectedModules] = useState(new Set())
  const [selectedResources, setSelectedResources] = useState(new Set())
  const [adding, setAdding] = useState(false)

  useEffect(() => { run() }, [])

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const r = await generateCurriculum({ track, resources, userId })
      setResult(r)
      // Pre-select all
      if (r.steps.length) setSelectedSteps(new Set(r.steps.map((_, i) => i)))
      if (r.modules.length) setSelectedModules(new Set(r.modules.map((_, i) => i)))
      if (r.resources.length) setSelectedResources(new Set(r.resources.map((_, i) => i)))
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  function toggleStep(i) { setSelectedSteps(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n }) }
  function toggleModule(i) { setSelectedModules(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n }) }
  function toggleResource(i) { setSelectedResources(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n }) }

  async function addSelected() {
    setAdding(true)
    const steps = (result.steps || []).filter((_, i) => selectedSteps.has(i))
    const modules = (result.modules || []).filter((_, i) => selectedModules.has(i))
    const resources = (result.resources || []).filter((_, i) => selectedResources.has(i))
    await onAddItems({ steps, modules, resources })
    setAdding(false)
    onDismiss()
  }

  async function addAll() {
    setAdding(true)
    await onAddItems({ steps: result.steps || [], modules: result.modules || [], resources: result.resources || [] })
    setAdding(false)
    onDismiss()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onDismiss() }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', width: '100%', maxWidth: 700, maxHeight: '85vh', overflow: 'auto', padding: 24 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} color={L} />
            <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-serif)' }}>AI curriculum for "{track.name}"</h3>
          </div>
          <button className="btn-icon btn" onClick={onDismiss}><X size={16} /></button>
        </div>

        {loading && (
          <div className="flex items-center gap-2" style={{ color: 'var(--text-3)', padding: '40px 0', justifyContent: 'center' }}>
            <Loader size={16} className="spin" /> Generating curriculum…
          </div>
        )}
        {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}

        {result && !loading && (
          <>
            {result.approachNote && (
              <div style={{ background: LT, border: `1px solid ${L}`, borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
                <p style={{ fontSize: 11, color: L, fontWeight: 600, marginBottom: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Approach</p>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{result.approachNote}</p>
              </div>
            )}

            {/* Freeform steps */}
            {result.steps.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 8 }}>Curriculum steps</p>
                {result.steps.map((s, i) => (
                  <label key={i} className="flex items-start gap-3" style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <input type="checkbox" checked={selectedSteps.has(i)} onChange={() => toggleStep(i)} style={{ marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</p>
                      {s.description && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{s.description}</p>}
                      {s.estimated_minutes && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>~{s.estimated_minutes >= 60 ? `${(s.estimated_minutes / 60).toFixed(1)}h` : `${s.estimated_minutes}m`}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Structured modules */}
            {result.modules.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 8 }}>Modules & lessons</p>
                {result.modules.map((m, mi) => (
                  <div key={mi} style={{ marginBottom: 12 }}>
                    <label className="flex items-center gap-2" style={{ cursor: 'pointer', marginBottom: 4 }}>
                      <input type="checkbox" checked={selectedModules.has(mi)} onChange={() => toggleModule(mi)} />
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</p>
                    </label>
                    {(m.lessons || []).map((l, li) => (
                      <div key={li} style={{ paddingLeft: 24, paddingBottom: 4 }}>
                        <p style={{ fontSize: 12, color: 'var(--text-2)' }}>• {l.title}{l.estimated_minutes ? ` (${l.estimated_minutes >= 60 ? `${(l.estimated_minutes / 60).toFixed(1)}h` : `${l.estimated_minutes}m`})` : ''}</p>
                        {l.description && <p style={{ fontSize: 11, color: 'var(--text-3)', paddingLeft: 8 }}>{l.description}</p>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Resources */}
            {result.resources.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 8 }}>Resources</p>
                {result.resources.map((r, i) => {
                  const Icon = TYPE_ICONS[r.type] || Globe
                  return (
                    <label key={i} className="flex items-start gap-3" style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <input type="checkbox" checked={selectedResources.has(i)} onChange={() => toggleResource(i)} style={{ marginTop: 3, flexShrink: 0 }} />
                      <Icon size={14} color={L} style={{ marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500 }}>{r.title}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.type} · {r.platform}</p>
                        {r.why && <p style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic', marginTop: 2 }}>{r.why}</p>}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button className="btn" style={{ background: L, color: '#fff', border: 'none' }} onClick={addSelected} disabled={adding}>
                {adding ? <Loader size={13} className="spin" /> : <Check size={13} />} Add selected
              </button>
              <button className="btn btn-ghost" onClick={addAll} disabled={adding}>Add all</button>
              <button className="btn btn-ghost" onClick={onDismiss}>Dismiss</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Track detail view ────────────────────────────────────────────────────────

function TrackDetail({ track, onBack, onUpdate, onDelete, goals, aiEnabled, userId }) {
  const [tab, setTab] = useState('curriculum')
  const [resources, setResources] = useState([])
  const [steps, setSteps] = useState([])
  const [modules, setModules] = useState([])
  const [attachments, setAttachments] = useState([]) // all attachments for outputs gallery
  const [notes, setNotes] = useState(track.notes_text || '')
  const [notesSaved, setNotesSaved] = useState(false)
  const [showAddResource, setShowAddResource] = useState(false)
  const [showAddStep, setShowAddStep] = useState(false)
  const [showAddModule, setShowAddModule] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [resourceForm, setResourceForm] = useState({ title: '', type: 'Course', url: '', platform: '', cost: '', notes: '' })
  const [stepForm, setStepForm] = useState({ title: '', description: '', estimated_minutes: '', module_id: '' })
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' })
  const [editTrack, setEditTrack] = useState(false)
  const [editForm, setEditForm] = useState({ name: track.name, category: track.category, why_text: track.why_text || '', status: track.status, target_date: track.target_date || '', curriculum_mode: track.curriculum_mode, private: track.private })

  const isStructured = track.curriculum_mode === 'structured'
  const progress = pct(steps)

  useEffect(() => { loadAll() }, [track.id])

  async function loadAll() {
    const [rRes, sRes, mRes] = await Promise.all([
      supabase.from('learning_resources').select('*').eq('track_id', track.id).order('created_at'),
      supabase.from('learning_steps').select('*').eq('track_id', track.id).order('sort_order').order('created_at'),
      supabase.from('learning_modules').select('*').eq('track_id', track.id).order('sort_order'),
    ])
    const stepsData = sRes.data || []
    setResources(rRes.data || [])
    setSteps(stepsData)
    setModules(mRes.data || [])
    if (stepsData.length) {
      const { data: aData } = await supabase.from('learning_attachments').select('*').in('step_id', stepsData.map(s => s.id)).order('created_at')
      setAttachments(aData || [])
    }
  }

  async function addResource() {
    if (!resourceForm.title) return
    const { data } = await supabase.from('learning_resources').insert({
      track_id: track.id, ...resourceForm, cost: resourceForm.cost ? Number(resourceForm.cost) : null,
    }).select().single()
    setResources(p => [...p, data])
    setResourceForm({ title: '', type: 'Course', url: '', platform: '', cost: '', notes: '' })
    setShowAddResource(false)
  }

  async function deleteResource(id) {
    await supabase.from('learning_resources').delete().eq('id', id)
    setResources(p => p.filter(r => r.id !== id))
  }

  async function addStep(overrides = {}) {
    const title = overrides.title || stepForm.title
    if (!title) return
    const payload = {
      title,
      description: overrides.description || stepForm.description || null,
      estimated_minutes: overrides.estimated_minutes || (stepForm.estimated_minutes ? Number(stepForm.estimated_minutes) : null),
      module_id: overrides.module_id || stepForm.module_id || null,
      sort_order: steps.length,
    }
    const { data } = await supabase.from('learning_steps').insert({ track_id: track.id, ...payload }).select().single()
    setSteps(p => [...p, data])
    setStepForm({ title: '', description: '', estimated_minutes: '', module_id: '' })
    setShowAddStep(false)
  }

  async function updateStep(id, patch) {
    await supabase.from('learning_steps').update(patch).eq('id', id)
    setSteps(p => p.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  async function deleteStep(id) {
    await supabase.from('learning_steps').delete().eq('id', id)
    setSteps(p => p.filter(s => s.id !== id))
  }

  async function moveStep(id, dir) {
    const idx = steps.findIndex(s => s.id === id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= steps.length) return
    const reordered = [...steps]
    ;[reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]]
    const updates = reordered.map((s, i) => supabase.from('learning_steps').update({ sort_order: i }).eq('id', s.id))
    await Promise.all(updates)
    setSteps(reordered.map((s, i) => ({ ...s, sort_order: i })))
  }

  async function addModule() {
    if (!moduleForm.title) return
    const { data } = await supabase.from('learning_modules').insert({ track_id: track.id, ...moduleForm, sort_order: modules.length }).select().single()
    setModules(p => [...p, { ...data, lessons: [] }])
    setModuleForm({ title: '', description: '' })
    setShowAddModule(false)
  }

  async function saveNotes() {
    await supabase.from('learning_tracks').update({ notes_text: notes }).eq('id', track.id)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  async function saveEditTrack() {
    const patch = { ...editForm, target_date: editForm.target_date || null }
    await supabase.from('learning_tracks').update(patch).eq('id', track.id)
    onUpdate({ ...track, ...patch })
    setEditTrack(false)
  }

  async function addAIItems({ steps: aiSteps, modules: aiModules, resources: aiResources }) {
    for (const s of aiSteps) await addStep({ title: s.title, description: s.description, estimated_minutes: s.estimated_minutes })
    for (const m of aiModules) {
      const { data: mod } = await supabase.from('learning_modules').insert({ track_id: track.id, title: m.title, description: m.description, sort_order: modules.length }).select().single()
      if (mod && m.lessons) {
        for (const l of m.lessons) await supabase.from('learning_steps').insert({ track_id: track.id, module_id: mod.id, title: l.title, description: l.description, estimated_minutes: l.estimated_minutes, sort_order: steps.length })
      }
    }
    for (const r of aiResources) await supabase.from('learning_resources').insert({ track_id: track.id, title: r.title, type: r.type || 'Other', url: r.url || null, platform: r.platform || null, notes: r.why || null })
    await loadAll()
  }

  const weeklyFocusSteps = steps.filter(s => s.is_weekly_focus)
  const images = attachments.filter(a => a.type === 'image')
  const certs = attachments.filter(a => a.type === 'pdf')
  const links = attachments.filter(a => a.type === 'url')

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm flex items-center gap-1" onClick={onBack}><ChevronLeft size={14} /> All tracks</button>
      </div>

      <div style={{ background: `linear-gradient(135deg, ${LT} 0%, var(--card-bg) 100%)`, border: '1px solid var(--border)', borderLeft: `4px solid ${L}`, borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 20 }}>
        <div className="flex items-start justify-between gap-4">
          <div style={{ flex: 1 }}>
            {editTrack ? (
              <div>
                <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontWeight: 700, width: '100%', marginBottom: 10 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 10 }}>
                  <select value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))} style={{ fontSize: 12 }}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))} style={{ fontSize: 12 }}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <input type="date" value={editForm.target_date} onChange={e => setEditForm(p => ({ ...p, target_date: e.target.value }))} style={{ fontSize: 12 }} />
                  <select value={editForm.curriculum_mode} onChange={e => setEditForm(p => ({ ...p, curriculum_mode: e.target.value }))} style={{ fontSize: 12 }}>
                    <option value="freeform">Freeform steps</option>
                    <option value="structured">Structured modules</option>
                  </select>
                </div>
                <textarea value={editForm.why_text} onChange={e => setEditForm(p => ({ ...p, why_text: e.target.value }))}
                  placeholder="Why do you want to learn this?" style={{ width: '100%', fontSize: 12, minHeight: 56, marginBottom: 8 }} />
                <label className="flex items-center gap-2" style={{ fontSize: 12, cursor: 'pointer', marginBottom: 10 }}>
                  <input type="checkbox" checked={editForm.private} onChange={e => setEditForm(p => ({ ...p, private: e.target.checked }))} />
                  Private (hidden from accountability partners)
                </label>
                <div className="flex gap-2">
                  <button className="btn btn-sm" style={{ background: L, color: '#fff', border: 'none' }} onClick={saveEditTrack}>Save</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditTrack(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: L, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{track.category}</span>
                  {track.private ? <Lock size={11} color="var(--text-3)" /> : <Unlock size={11} color="var(--text-3)" />}
                </div>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>{track.name}</h1>
                {track.why_text && <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', marginBottom: 8 }}>{track.why_text}</p>}
                <div className="flex items-center gap-3 wrap">
                  <span style={{ fontSize: 12, color: STATUS_COLORS[track.status], fontWeight: 600 }}>{track.status}</span>
                  {track.target_date && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>Target: {format(new Date(track.target_date), 'd MMM yyyy')}</span>}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{track.curriculum_mode === 'structured' ? 'Structured' : 'Freeform'} curriculum</span>
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col items-center gap-2">
            <ArcRing value={progress} max={100} size={68} strokeWidth={6} color={L} label={`${progress}%`} fontSize={13} />
            <div className="flex gap-1">
              <button className="btn-icon btn btn-sm" onClick={() => setEditTrack(v => !v)} title="Edit track"><Edit2 size={13} /></button>
              <button className="btn-icon btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => onDelete(track.id)} title="Delete track"><Trash2 size={13} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4" style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['curriculum', 'Curriculum'], ['resources', 'Resources'], ['outputs', 'Outputs'], ['notes', 'Notes']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: tab === key ? 600 : 400,
            background: tab === key ? 'var(--card-bg)' : 'transparent',
            color: tab === key ? L : 'var(--text-3)',
            border: tab === key ? `1px solid ${L}` : 'none', cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {/* ── Curriculum tab ── */}
      {tab === 'curriculum' && (
        <div>
          {weeklyFocusSteps.length > 0 && (
            <div style={{ background: LT, border: `1px solid ${L}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: L, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>This week's focus</p>
              {weeklyFocusSteps.map(s => <p key={s.id} style={{ fontSize: 12, color: 'var(--text-2)' }}>▸ {s.title}</p>)}
            </div>
          )}

          <div className="flex items-center gap-2 mb-3">
            <h3 style={{ flex: 1, fontSize: '0.9rem' }}>{isStructured ? 'Modules & lessons' : 'Steps'}</h3>
            {aiEnabled && (
              <button className="btn btn-sm flex items-center gap-2" style={{ background: L, color: '#fff', border: 'none', fontSize: 12 }}
                onClick={() => setShowAI(true)}>
                <Sparkles size={13} /> Generate curriculum
              </button>
            )}
            {isStructured ? (
              <button className="btn btn-sm btn-ghost" onClick={() => setShowAddModule(true)}><Plus size={13} /> Module</button>
            ) : (
              <button className="btn btn-sm btn-ghost" onClick={() => setShowAddStep(true)}><Plus size={13} /> Step</button>
            )}
          </div>

          {isStructured ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {modules.map(m => {
                const mSteps = steps.filter(s => s.module_id === m.id)
                return (
                  <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ background: LD, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 13, color: L }}>{m.title}</p>
                        {m.description && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.description}</p>}
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>{mSteps.filter(s => s.status === 'Done').length}/{mSteps.length}</span>
                    </div>
                    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {mSteps.map((s, i) => (
                        <StepItem key={s.id} step={s} index={i} total={mSteps.length} aiEnabled={aiEnabled} userId={userId}
                          onUpdate={updateStep} onDelete={deleteStep} onMove={moveStep} />
                      ))}
                      <button className="btn btn-xs btn-ghost mt-1" onClick={() => setShowAddStep(true)}><Plus size={10} /> lesson</button>
                    </div>
                  </div>
                )
              })}
              {modules.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No modules yet. Add one or generate a curriculum.</p>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {steps.map((s, i) => (
                <StepItem key={s.id} step={s} index={i} total={steps.length} aiEnabled={aiEnabled} userId={userId}
                  onUpdate={updateStep} onDelete={deleteStep} onMove={moveStep} />
              ))}
              {steps.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
                  <GraduationCap size={32} color={L} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  <p style={{ fontSize: 13, marginBottom: 8 }}>No steps yet.</p>
                  {aiEnabled && <p style={{ fontSize: 12 }}>Try "Generate curriculum" to get started.</p>}
                </div>
              )}
            </div>
          )}

          {/* Add step/module forms */}
          {showAddStep && (
            <div style={{ marginTop: 12, background: 'var(--bg-2)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={stepForm.title} onChange={e => setStepForm(p => ({ ...p, title: e.target.value }))} placeholder="Step title…" style={{ fontSize: 13 }} autoFocus />
              <div className="flex gap-2">
                <input value={stepForm.description} onChange={e => setStepForm(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" style={{ flex: 1, fontSize: 12 }} />
                <input value={stepForm.estimated_minutes} onChange={e => setStepForm(p => ({ ...p, estimated_minutes: e.target.value }))} placeholder="Est. mins" type="number" style={{ width: 80, fontSize: 12 }} />
                {isStructured && (
                  <select value={stepForm.module_id} onChange={e => setStepForm(p => ({ ...p, module_id: e.target.value }))} style={{ fontSize: 12 }}>
                    <option value="">No module</option>
                    {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                )}
              </div>
              <div className="flex gap-2">
                <button className="btn btn-sm" style={{ background: L, color: '#fff', border: 'none' }} onClick={() => addStep({ module_id: stepForm.module_id || null })}>Add</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setShowAddStep(false)}>Cancel</button>
              </div>
            </div>
          )}

          {showAddModule && (
            <div style={{ marginTop: 12, background: 'var(--bg-2)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={moduleForm.title} onChange={e => setModuleForm(p => ({ ...p, title: e.target.value }))} placeholder="Module title…" style={{ fontSize: 13 }} autoFocus />
              <input value={moduleForm.description} onChange={e => setModuleForm(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" style={{ fontSize: 12 }} />
              <div className="flex gap-2">
                <button className="btn btn-sm" style={{ background: L, color: '#fff', border: 'none' }} onClick={addModule}>Add module</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setShowAddModule(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Resources tab ── */}
      {tab === 'resources' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 style={{ fontSize: '0.9rem' }}>Resources</h3>
            <button className="btn btn-sm btn-ghost" onClick={() => setShowAddResource(v => !v)}><Plus size={13} /> Add resource</button>
          </div>

          {showAddResource && (
            <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: 14, marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input style={{ gridColumn: '1/-1', fontSize: 13 }} value={resourceForm.title} onChange={e => setResourceForm(p => ({ ...p, title: e.target.value }))} placeholder="Title" autoFocus />
              <select value={resourceForm.type} onChange={e => setResourceForm(p => ({ ...p, type: e.target.value }))} style={{ fontSize: 12 }}>
                {RESOURCE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <input value={resourceForm.platform} onChange={e => setResourceForm(p => ({ ...p, platform: e.target.value }))} placeholder="Platform (e.g. Udemy)" style={{ fontSize: 12 }} />
              <input value={resourceForm.url} onChange={e => setResourceForm(p => ({ ...p, url: e.target.value }))} placeholder="URL (optional)" style={{ fontSize: 12 }} />
              <input value={resourceForm.cost} onChange={e => setResourceForm(p => ({ ...p, cost: e.target.value }))} placeholder="Cost £ (optional)" type="number" style={{ fontSize: 12 }} />
              <textarea value={resourceForm.notes} onChange={e => setResourceForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes (optional)" style={{ gridColumn: '1/-1', fontSize: 12, minHeight: 50 }} />
              <div className="flex gap-2" style={{ gridColumn: '1/-1' }}>
                <button className="btn btn-sm" style={{ background: L, color: '#fff', border: 'none' }} onClick={addResource}>Add</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setShowAddResource(false)}>Cancel</button>
              </div>
            </div>
          )}

          {resources.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No resources yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {resources.map(r => <ResourceCard key={r.id} resource={r} onDelete={deleteResource} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Outputs tab ── */}
      {tab === 'outputs' && (
        <div>
          <h3 style={{ fontSize: '0.9rem', marginBottom: 16 }}>Outputs & attachments</h3>

          {images.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Images</p>
              <div style={{ columns: 3, columnGap: 8 }}>
                {images.map(a => (
                  <div key={a.id} style={{ marginBottom: 8, breakInside: 'avoid' }}>
                    <a href={a.url} target="_blank" rel="noreferrer">
                      <img src={a.url} alt={a.display_name || ''} style={{ width: '100%', borderRadius: 6, display: 'block' }} />
                    </a>
                    {a.display_name && <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>{a.display_name}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {certs.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Certificates</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {certs.map(a => (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    border: '2px solid #d4af37', borderRadius: 10, padding: '12px 16px',
                    textDecoration: 'none', color: 'var(--text)',
                    background: 'linear-gradient(135deg, #fffbf0 0%, var(--card-bg) 100%)',
                  }}>
                    <FileCheck size={20} color="#d4af37" />
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 13 }}>{a.display_name || 'Certificate'}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>PDF · Click to open</p>
                    </div>
                    <ExternalLink size={14} color="var(--text-3)" style={{ marginLeft: 'auto' }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {links.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>External links</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {links.map(a => (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2" style={{ fontSize: 13, color: L, textDecoration: 'none' }}>
                    <ExternalLink size={13} /> {a.display_name || a.url}
                  </a>
                ))}
              </div>
            </div>
          )}

          {images.length === 0 && certs.length === 0 && links.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
              No outputs yet. Add attachments (links, images, certificates) to individual steps in the Curriculum tab.
            </p>
          )}
        </div>
      )}

      {/* ── Notes tab ── */}
      {tab === 'notes' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 style={{ fontSize: '0.9rem' }}>Track notes</h3>
            <div className="flex items-center gap-2">
              {notesSaved && <span style={{ fontSize: 11, color: 'var(--success)' }}>Saved</span>}
              <button className="btn btn-sm" style={{ background: L, color: '#fff', border: 'none' }} onClick={saveNotes}>Save</button>
            </div>
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="General notes, resources, thoughts, links…"
            style={{
              width: '100%', minHeight: 320, fontSize: 13, lineHeight: 1.7,
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 16, fontFamily: 'var(--font-body)',
              resize: 'vertical',
            }}
          />
        </div>
      )}

      {showAI && (
        <AICurriculumPanel track={track} resources={resources} userId={userId}
          onAddItems={addAIItems} onDismiss={() => setShowAI(false)} />
      )}
    </div>
  )
}

// ─── Add track modal ──────────────────────────────────────────────────────────

function AddTrackModal({ goals, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', category: CATEGORIES[0], why_text: '', goal_id: '',
    status: 'Not started', target_date: '', curriculum_mode: 'freeform', private: false,
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = { ...form, goal_id: form.goal_id || null, target_date: form.target_date || null }
    await onSave(payload)
    setSaving(false)
  }

  return createPortal(
    <div className="modal-overlay">
      <div className="modal scale-in" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-serif)' }}>New learning track</h2>
          <button className="btn-icon btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="form-group">
          <label>Track name</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="What do you want to learn?" autoFocus />
        </div>
        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Why do you want to learn this?</label>
          <textarea value={form.why_text} onChange={e => set('why_text', e.target.value)}
            placeholder="Short motivational note — shown on the track card" style={{ minHeight: 60 }} />
        </div>
        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Curriculum mode</label>
            <select value={form.curriculum_mode} onChange={e => set('curriculum_mode', e.target.value)}>
              <option value="freeform">Freeform steps</option>
              <option value="structured">Structured modules</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Target date (optional)</label>
            <input type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} />
          </div>
        </div>
        {goals.length > 0 && (
          <div className="form-group">
            <label>Link to a goal (optional)</label>
            <select value={form.goal_id} onChange={e => set('goal_id', e.target.value)}>
              <option value="">None</option>
              {goals.map(g => <option key={g.id} value={g.id}>{g.primary_goal}</option>)}
            </select>
          </div>
        )}
        <label className="flex items-center gap-2 mb-4" style={{ fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.private} onChange={e => set('private', e.target.checked)} />
          Private track (hidden from accountability partners)
        </label>

        <div className="flex gap-2 justify-end">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn" style={{ background: L, color: '#fff', border: 'none' }} onClick={save} disabled={saving || !form.name.trim()}>
            {saving ? 'Creating…' : 'Create track'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LearningPage() {
  const { user } = useAuth()
  const [tracks, setTracks] = useState([])
  const [steps, setSteps] = useState([]) // all steps for all tracks (for progress + weekly focus)
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [showAddTrack, setShowAddTrack] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const [tRes, gRes, profileRes] = await Promise.all([
      supabase.from('learning_tracks').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('goals').select('id,primary_goal').eq('user_id', user.id),
      supabase.from('profiles').select('ai_enabled').eq('id', user.id).maybeSingle(),
    ])
    const tracksData = tRes.data || []
    setTracks(tracksData)
    setGoals(gRes.data || [])
    setAiEnabled(!!profileRes.data?.ai_enabled)

    if (tracksData.length) {
      const { data: stepsData } = await supabase
        .from('learning_steps')
        .select('id,track_id,status,is_weekly_focus,title')
        .in('track_id', tracksData.map(t => t.id))
      setSteps(stepsData || [])
    }
    setLoading(false)
  }

  function stepsFor(trackId) { return steps.filter(s => s.track_id === trackId) }

  async function createTrack(payload) {
    const { data } = await supabase.from('learning_tracks').insert({ user_id: user.id, ...payload }).select().single()
    setTracks(p => [...p, data])
    setShowAddTrack(false)
    setSelectedTrack(data)
  }

  async function updateTrack(updated) {
    setTracks(p => p.map(t => t.id === updated.id ? updated : t))
    setSelectedTrack(updated)
  }

  async function deleteTrack(id) {
    await supabase.from('learning_tracks').delete().eq('id', id)
    setTracks(p => p.filter(t => t.id !== id))
    setSelectedTrack(null)
  }

  // Recompute steps when returning to list
  async function refreshSteps() {
    if (!tracks.length) return
    const { data } = await supabase
      .from('learning_steps')
      .select('id,track_id,status,is_weekly_focus,title')
      .in('track_id', tracks.map(t => t.id))
    setSteps(data || [])
  }

  // Header stats
  const inProgress = tracks.filter(t => t.status === 'In progress').length
  const complete = tracks.filter(t => t.status === 'Complete').length
  const weeklyFocus = steps.filter(s => s.is_weekly_focus)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader size={20} color={L} className="spin" />
      </div>
    )
  }

  if (selectedTrack) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <TrackDetail
          track={selectedTrack}
          goals={goals}
          aiEnabled={aiEnabled}
          userId={user.id}
          onBack={() => { setSelectedTrack(null); refreshSteps() }}
          onUpdate={updateTrack}
          onDelete={deleteTrack}
        />
      </div>
    )
  }

  const grouped = {
    'In progress': tracks.filter(t => t.status === 'In progress'),
    'Not started': tracks.filter(t => t.status === 'Not started'),
    'On hold':     tracks.filter(t => t.status === 'On hold'),
    'Complete':    tracks.filter(t => t.status === 'Complete'),
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <GraduationCap size={22} color={L} />
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 700 }}>Learning</h1>
          </div>
          <div className="flex items-center gap-4 wrap">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
            {inProgress > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: L }}>{inProgress} in progress</span>}
            {complete > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--success)' }}>{complete} complete</span>}
          </div>
        </div>
        <button className="btn flex items-center gap-2" style={{ background: L, color: '#fff', border: 'none', flexShrink: 0 }} onClick={() => setShowAddTrack(true)}>
          <Plus size={15} /> New track
        </button>
      </div>

      {/* Timeline strip */}
      {tracks.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 8, minWidth: 'max-content', padding: '4px 2px' }}>
            {tracks.map(t => {
              const p = pct(stepsFor(t.id))
              return (
                <button key={t.id} onClick={() => setSelectedTrack(t)} style={{
                  background: 'var(--bg-2)', border: `1px solid ${p === 100 ? 'var(--success)' : L}`,
                  borderRadius: 8, padding: '8px 14px', cursor: 'pointer', minWidth: 130, textAlign: 'left',
                }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{t.name}</p>
                  <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
                    <div style={{ height: '100%', width: `${p}%`, background: p === 100 ? 'var(--success)' : L, transition: 'width 0.3s' }} />
                  </div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>{p}%{t.target_date ? ` · ${format(new Date(t.target_date), 'd MMM')}` : ''}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Weekly focus */}
      {weeklyFocus.length > 0 && (
        <div style={{ background: LT, border: `1px solid ${L}`, borderRadius: 10, padding: '14px 18px', marginBottom: 24 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: L, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>What I'm learning this week</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {weeklyFocus.map(s => {
              const t = tracks.find(tr => tr.id === s.track_id)
              return (
                <div key={s.id} className="flex items-center gap-2" style={{ cursor: 'pointer' }} onClick={() => setSelectedTrack(t)}>
                  <Star size={11} color="#d4af37" fill="#d4af37" />
                  <span style={{ fontSize: 13 }}>{s.title}</span>
                  {t && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>· {t.name}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Grouped track list */}
      {tracks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <GraduationCap size={48} color={L} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--text-3)', marginBottom: 8 }}>What do you want to learn next?</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>Track courses, books, skills, and structured curricula all in one place.</p>
          <button className="btn" style={{ background: L, color: '#fff', border: 'none', fontSize: 15, padding: '12px 28px' }} onClick={() => setShowAddTrack(true)}>
            <Plus size={16} /> Start a learning track
          </button>
        </div>
      ) : (
        ['In progress', 'Not started', 'On hold', 'Complete'].map(status => {
          const group = grouped[status]
          if (!group.length) return null
          return (
            <div key={status} style={{ marginBottom: 28 }}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: STATUS_COLORS[status], fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{status}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>({group.length})</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {group.map(t => <TrackCard key={t.id} track={t} steps={stepsFor(t.id)} onClick={() => setSelectedTrack(t)} />)}
              </div>
            </div>
          )
        })
      )}

      {showAddTrack && <AddTrackModal goals={goals} onClose={() => setShowAddTrack(false)} onSave={createTrack} />}
    </div>
  )
}
