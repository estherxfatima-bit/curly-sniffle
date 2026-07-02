import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, RotateCcw, Trash2, AlertTriangle } from 'lucide-react'
import { AREA_COLORS } from '../../lib/constants'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

function areaColor(area) {
  return AREA_COLORS[area] || AREA_COLORS.Other
}

// decision: 'keep' | 'drop'
export default function CarryForwardReviewModal({ incompleteTasks, onConfirm, onClose }) {
  useLockBodyScroll()

  const [decisions, setDecisions] = useState(() =>
    Object.fromEntries(incompleteTasks.map(t => [t.id, 'keep']))
  )

  function setAll(decision) {
    setDecisions(Object.fromEntries(incompleteTasks.map(t => [t.id, decision])))
  }

  const keepCount = Object.values(decisions).filter(d => d === 'keep').length
  const dropCount = Object.values(decisions).filter(d => d === 'drop').length

  const previouslyCarried = incompleteTasks.filter(t => t.carried_forward)
  const fresh = incompleteTasks.filter(t => !t.carried_forward)

  function handleConfirm() {
    const toKeep = incompleteTasks.filter(t => decisions[t.id] === 'keep')
    onConfirm(toKeep)
  }

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(13,8,5,0.5)', zIndex: 1100, backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 520, maxWidth: '95vw', maxHeight: '85vh',
        zIndex: 1200, background: 'var(--card-bg)',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <RotateCcw size={16} color="var(--career)" />
              <h3 style={{ fontSize: '1rem' }}>Carry forward review</h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {incompleteTasks.length} incomplete task{incompleteTasks.length !== 1 ? 's' : ''} — choose what to keep
            </p>
          </div>
          <button className="btn-icon btn" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Bulk actions */}
        <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-xs btn-ghost" onClick={() => setAll('keep')}>Keep all</button>
          <button className="btn btn-xs btn-ghost" onClick={() => setAll('drop')}>Drop all</button>
        </div>

        {/* Task list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {previouslyCarried.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={12} color="var(--warning)" />
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Already carried from last week
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {previouslyCarried.map(task => (
                  <TaskRow key={task.id} task={task} decision={decisions[task.id]} onChange={d => setDecisions(p => ({ ...p, [task.id]: d }))} />
                ))}
              </div>
            </div>
          )}

          {fresh.length > 0 && (
            <div>
              {previouslyCarried.length > 0 && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  New this week
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {fresh.map(task => (
                  <TaskRow key={task.id} task={task} decision={decisions[task.id]} onChange={d => setDecisions(p => ({ ...p, [task.id]: d }))} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            {keepCount > 0 ? `${keepCount} carry forward` : 'Nothing to carry'}
            {dropCount > 0 ? ` · ${dropCount} drop` : ''}
          </p>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-career btn-sm"
              style={{ color: '#fff' }}
              onClick={handleConfirm}
            >
              <RotateCcw size={13} /> Carry {keepCount > 0 ? keepCount : 'none'} forward
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

function TaskRow({ task, decision, onChange }) {
  const color = areaColor(task.area)
  const isKeep = decision === 'keep'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', borderRadius: 'var(--radius)',
      border: `1px solid ${isKeep ? 'var(--border)' : 'transparent'}`,
      background: isKeep ? 'var(--bg)' : 'var(--bg-2)',
      opacity: isKeep ? 1 : 0.5,
      transition: 'all 0.15s',
    }}>
      <span style={{ width: 3, height: 32, borderRadius: 2, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: 'var(--text)', textDecoration: isKeep ? 'none' : 'line-through', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {task.specific_task}
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
          {task.area}{task.notes ? ' · has note' : ''}
        </p>
      </div>
      <div className="flex gap-1" style={{ flexShrink: 0 }}>
        <button
          className={`btn btn-xs ${isKeep ? 'btn-career' : 'btn-ghost'}`}
          style={isKeep ? { color: '#fff' } : {}}
          onClick={() => onChange('keep')}
        >
          <RotateCcw size={11} /> Keep
        </button>
        <button
          className={`btn btn-xs ${!isKeep ? '' : 'btn-ghost'}`}
          style={!isKeep ? { background: 'var(--danger)', color: '#fff', border: 'none' } : {}}
          onClick={() => onChange('drop')}
        >
          <Trash2 size={11} /> Drop
        </button>
      </div>
    </div>
  )
}
