import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, RotateCcw, Archive, ChevronRight, ChevronDown } from 'lucide-react'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

const DECISION_LABELS = {
  carry:   { label: 'Carry today', color: 'var(--career)',   icon: <RotateCcw size={11} /> },
  backlog: { label: 'Save for later', color: 'var(--creative)', icon: <Archive size={11} /> },
  skip:    { label: 'Dismiss',    color: 'var(--text-3)',    icon: <X size={11} /> },
}

export default function TaskCarryoverModal({ tasks, catColor, onConfirm, onDismiss }) {
  useLockBodyScroll()

  const [decisions, setDecisions] = useState(() =>
    Object.fromEntries(tasks.map(t => [t.id, 'carry']))
  )
  const [expanded, setExpanded] = useState({})

  function setDecision(id, val) {
    setDecisions(prev => ({ ...prev, [id]: val }))
  }

  function handleConfirm() {
    onConfirm(tasks.map(t => ({ ...t, decision: decisions[t.id] })))
  }

  const counts = Object.values(decisions).reduce((acc, d) => {
    acc[d] = (acc[d] || 0) + 1
    return acc
  }, {})

  const sourceDates = [...new Set(tasks.map(t => t.date))].sort()
  const dateLabel = sourceDates.length === 1
    ? new Date(sourceDates[0] + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : `${sourceDates.length} days`

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onDismiss}
    >
      <div className="card" style={{ width: '100%', maxWidth: 460, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="flex items-center justify-between mb-1">
            <h3 style={{ fontSize: '0.95rem' }}>Unfinished from {dateLabel}</h3>
            <button className="btn-icon" onClick={onDismiss}><X size={15} /></button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Choose what to do with each task. "Save for later" adds it to your backlog to pull on any future day.
          </p>
          {/* Quick-select row */}
          <div className="flex items-center gap-2 mt-2 wrap">
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Set all to:</span>
            {Object.entries(DECISION_LABELS).map(([val, { label, color }]) => (
              <button
                key={val}
                className="btn btn-xs btn-ghost"
                style={{ fontSize: 10 }}
                onClick={() => setDecisions(Object.fromEntries(tasks.map(t => [t.id, val])))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Task list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.map(t => {
              const decision = decisions[t.id]
              const cc = catColor(t.category)
              return (
                <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  {/* Single-line row: stripe + truncated text + expand + buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 3, borderRadius: 2, alignSelf: 'stretch', background: cc, flexShrink: 0, minHeight: 20 }} />
                    <button
                      onClick={() => setExpanded(p => ({ ...p, [t.id]: !p[t.id] }))}
                      style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', padding: 0 }}
                    >
                      <p style={{
                        fontSize: 13, fontWeight: 500, lineHeight: 1.4,
                        ...(expanded[t.id] ? { wordBreak: 'break-word' } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                      }}>{t.text}</p>
                      {t.category && (
                        <p style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{t.category}</p>
                      )}
                    </button>
                    {/* expand toggle — only show if text might be long */}
                    {t.text.length > 40 && (
                      <button onClick={() => setExpanded(p => ({ ...p, [t.id]: !p[t.id] }))} style={{ flexShrink: 0, color: 'var(--text-3)', background: 'none', padding: 2 }}>
                        <ChevronDown size={12} style={{ transform: expanded[t.id] ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                      </button>
                    )}
                    {/* Decision toggles inline */}
                    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                      {Object.entries(DECISION_LABELS).map(([val, { label, color, icon }]) => (
                        <button
                          key={val}
                          onClick={() => setDecision(t.id, val)}
                          title={label}
                          className="btn btn-xs"
                          style={{
                            fontSize: 10,
                            display: 'flex', alignItems: 'center', gap: 2,
                            background: decision === val ? color : 'var(--bg-2)',
                            color: decision === val ? '#fff' : 'var(--text-3)',
                            border: `1px solid ${decision === val ? color : 'var(--border)'}`,
                            padding: '3px 6px',
                            borderRadius: 6,
                            fontWeight: decision === val ? 600 : 400,
                          }}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Expanded: show label of selected decision */}
                  {expanded[t.id] && (
                    <div style={{ paddingLeft: 11, marginTop: 4 }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {Object.entries(DECISION_LABELS).map(([val, { label, color, icon }]) => (
                          <button
                            key={val}
                            onClick={() => setDecision(t.id, val)}
                            className="btn btn-xs"
                            style={{
                              fontSize: 10, display: 'flex', alignItems: 'center', gap: 3,
                              background: decision === val ? color : 'var(--bg-2)',
                              color: decision === val ? '#fff' : 'var(--text-3)',
                              border: `1px solid ${decision === val ? color : 'var(--border)'}`,
                              padding: '3px 8px', borderRadius: 6,
                              fontWeight: decision === val ? 600 : 400,
                            }}
                          >{icon} {label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {counts.carry || 0} today · {counts.backlog || 0} for later · {counts.skip || 0} dismissed
          </p>
          <button className="btn btn-career btn-sm" style={{ color: '#fff' }} onClick={handleConfirm}>
            Confirm <ChevronRight size={12} style={{ marginLeft: 2 }} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
