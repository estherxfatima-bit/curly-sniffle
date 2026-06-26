import { X, Lightbulb } from 'lucide-react'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

export default function BrainDumpPicker({ ideas, onSelect, onClose }) {
  useLockBodyScroll()
  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: 420, maxHeight: '70vh', overflow: 'auto', padding: 18 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: '0.95rem' }}>Pull from brain dump</h3>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>
        {ideas.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
            Nothing parked right now. Add ideas via Goals → Idea parking lot.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ideas.map(idea => (
              <button
                key={idea.id}
                onClick={() => onSelect(idea)}
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Lightbulb size={12} color="var(--wellness)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{idea.text}</span>
                {idea.category && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', marginLeft: 'auto', flexShrink: 0, textTransform: 'uppercase' }}>{idea.category}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
