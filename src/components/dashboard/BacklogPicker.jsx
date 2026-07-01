import { createPortal } from 'react-dom'
import { X, Archive } from 'lucide-react'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

export default function BacklogPicker({ items, catColor, onSelect, onDelete, onClose }) {
  useLockBodyScroll()

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div className="card" style={{ width: '100%', maxWidth: 420, maxHeight: '70vh', overflow: 'auto', padding: 18 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Archive size={14} color="var(--creative)" />
            <h3 style={{ fontSize: '0.95rem' }}>Task backlog</h3>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>
            No tasks in your backlog yet. Save incomplete tasks here during the daily carryover prompt.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '8px 10px', fontSize: 13, flex: 1 }}
                  onClick={() => onSelect(item)}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{item.text}</p>
                    {item.category && (
                      <p style={{ fontSize: 10, color: catColor(item.category), fontFamily: 'var(--font-mono)', marginTop: 1 }}>{item.category}</p>
                    )}
                  </div>
                </button>
                <button
                  className="btn-icon btn"
                  title="Remove from backlog"
                  onClick={() => onDelete(item.id)}
                  style={{ flexShrink: 0, color: 'var(--text-3)' }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
