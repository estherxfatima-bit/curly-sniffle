import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Wand2, Sparkles, BarChart2, ExternalLink } from 'lucide-react'
import { CONTENT_FORMATS, CONTENT_STATUSES } from '../../lib/constants'
import { useContentPillars } from '../../hooks/useContentPillars'
import { useAuth } from '../../hooks/useAuth'

const STATUS_COLORS = {
  'Idea':           { bg: 'var(--bg-3)',        color: 'var(--text-3)' },
  'Film next':      { bg: 'var(--career-tint)',  color: 'var(--career)' },
  'Ready to edit':  { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
  'Pull clip':      { bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)' },
  'Posted':         { bg: 'rgba(16,185,129,0.12)', color: 'var(--success)' },
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      {children}
    </div>
  )
}

function EditableText({ value, onChange, placeholder, multiline }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')
  useEffect(() => { setVal(value || '') }, [value])
  function commit() { setEditing(false); if ((value || '') !== val) onChange(val || null) }

  if (multiline) {
    return editing ? (
      <textarea
        autoFocus rows={3}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        placeholder={placeholder}
        style={{ fontSize: 13, width: '100%', resize: 'vertical', padding: '6px 8px' }}
      />
    ) : (
      <p
        onClick={() => setEditing(true)}
        style={{ fontSize: 13, color: val ? 'var(--text)' : 'var(--text-3)', fontStyle: val ? 'normal' : 'italic', lineHeight: 1.5, cursor: 'text', minHeight: 20 }}
      >
        {val || placeholder}
      </p>
    )
  }

  return editing ? (
    <input
      autoFocus
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit() }}
      placeholder={placeholder}
      style={{ fontSize: 13, padding: '6px 8px', width: '100%' }}
    />
  ) : (
    <p
      onClick={() => setEditing(true)}
      style={{ fontSize: 13, color: val ? 'var(--text)' : 'var(--text-3)', fontStyle: val ? 'normal' : 'italic', cursor: 'text', minHeight: 20 }}
    >
      {val || placeholder}
    </p>
  )
}

function EditableSelect({ value, onChange, options, placeholder }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <select
        autoFocus
        value={value || ''}
        onChange={e => { onChange(e.target.value || null); setEditing(false) }}
        onBlur={() => setEditing(false)}
        style={{ fontSize: 13, padding: '4px 8px' }}
      >
        <option value="">—</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    )
  }
  return (
    <p onClick={() => setEditing(true)} style={{ fontSize: 13, color: value ? 'var(--text)' : 'var(--text-3)', fontStyle: value ? 'normal' : 'italic', cursor: 'pointer', minHeight: 20 }}>
      {value || placeholder}
    </p>
  )
}

export default function IdeaDetailModal({ idea, batches, onUpdate, onClose, onFleshOut, onViewFleshOut, onMetrics }) {
  const { user } = useAuth()
  const CONTENT_PILLARS = useContentPillars(user?.id)

  const statusStyle = STATUS_COLORS[idea.status] || STATUS_COLORS['Idea']

  function update(field, value) {
    onUpdate(idea.id, field, value === '' ? null : value)
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, height: '100vh', background: 'var(--bg)', overflowY: 'auto',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 0', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* Status pill — click to cycle */}
              <select
                value={idea.status || 'Idea'}
                onChange={e => update('status', e.target.value)}
                style={{
                  fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
                  background: statusStyle.bg, color: statusStyle.color, appearance: 'none', WebkitAppearance: 'none',
                }}
              >
                {CONTENT_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
              {idea.pillar && (
                <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'var(--bg-3)', color: 'var(--text-3)' }}>{idea.pillar}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {onFleshOut && (
                <button className="btn btn-xs btn-ghost" onClick={() => onFleshOut(idea)} title="Flesh out with AI">
                  <Wand2 size={12} /> Flesh out
                </button>
              )}
              {idea.last_flesh_out_id && onViewFleshOut && (
                <button className="btn btn-xs btn-ghost" onClick={() => onViewFleshOut(idea)} title="View last flesh out">
                  <Sparkles size={12} />
                </button>
              )}
              {idea.status === 'Posted' && onMetrics && (
                <button className="btn btn-xs btn-ghost" onClick={() => onMetrics(idea)} title="Update metrics">
                  <BarChart2 size={12} />
                </button>
              )}
              <button className="btn-icon btn" onClick={onClose}><X size={16} /></button>
            </div>
          </div>
          {/* Title */}
          <div style={{ marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
            <EditableText
              value={idea.title}
              onChange={v => update('title', v)}
              placeholder="Untitled idea"
            />
            {/* Override the default font size for title */}
            <style>{`.idea-title { font-size: 20px; font-weight: 600; line-height: 1.3; }`}</style>
            <p style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.3, display: 'none' }} />
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Hook */}
          <Field label="Hook">
            <EditableText value={idea.hook} onChange={v => update('hook', v)} placeholder="What's the opening hook?" multiline />
          </Field>

          {/* Caption notes */}
          <Field label="Caption notes">
            <EditableText value={idea.caption_notes} onChange={v => update('caption_notes', v)} placeholder="Caption ideas, CTAs…" multiline />
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <EditableText value={idea.notes} onChange={v => update('notes', v)} placeholder="Any other context…" multiline />
          </Field>

          {/* Grid of metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
            <Field label="Format">
              <EditableSelect value={idea.format} onChange={v => update('format', v)} options={CONTENT_FORMATS} placeholder="Choose format" />
            </Field>
            <Field label="Pillar">
              <EditableSelect value={idea.pillar} onChange={v => update('pillar', v)} options={CONTENT_PILLARS} placeholder="Choose pillar" />
            </Field>
            <Field label="Batch">
              <EditableSelect value={idea.batch} onChange={v => update('batch', v)} options={batches.map(b => b.name)} placeholder="Unassigned" />
            </Field>
            <Field label="Series">
              <EditableText value={idea.series} onChange={v => update('series', v)} placeholder="Series name" />
            </Field>
            <Field label="Sound">
              <EditableText value={idea.sound} onChange={v => update('sound', v)} placeholder="Audio / sound" />
            </Field>
            <Field label="Repurpose from">
              <EditableText value={idea.repurpose_from} onChange={v => update('repurpose_from', v)} placeholder="Original content" />
            </Field>
            <Field label="Posted date">
              <input
                type="date"
                value={idea.posted_date || ''}
                onChange={e => update('posted_date', e.target.value || null)}
                style={{ fontSize: 13, padding: '4px 0', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}
              />
            </Field>
            {idea.reference_url && (
              <Field label="Reference URL">
                <a href={idea.reference_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--career)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ExternalLink size={12} /> Open link
                </a>
              </Field>
            )}
          </div>

          {/* Metrics — shown if posted */}
          {idea.status === 'Posted' && idea.views != null && (
            <div style={{ padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 'var(--radius)' }}>
              <p className="mono mb-3" style={{ fontSize: 10 }}>Performance</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {[['Views', idea.views], ['Likes', idea.likes], ['Comments', idea.comments], ['Saves', idea.saves], ['Shares', idea.shares]].map(([label, val]) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--creative)' }}>{val ?? '—'}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
