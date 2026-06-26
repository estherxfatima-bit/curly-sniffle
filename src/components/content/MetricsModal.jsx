import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

const FIELDS = [
  { key: 'views', label: 'Views' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'saves', label: 'Saves' },
  { key: 'shares', label: 'Shares' },
]

export default function MetricsModal({ idea, onSave, onClose }) {
  useLockBodyScroll()
  const [values, setValues] = useState(
    Object.fromEntries(FIELDS.map(f => [f.key, idea[f.key] ?? '']))
  )

  function save() {
    onSave(Object.fromEntries(FIELDS.map(f => [f.key, values[f.key] === '' ? null : Number(values[f.key])])))
  }

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(13,8,5,0.45)', zIndex: 1100, backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }} onClick={onClose} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1200, width: 380, maxWidth: '92vw' }}>
        <div className="card" style={{ padding: 22 }}>
          <div className="flex items-center justify-between mb-2">
            <h3 style={{ fontSize: '0.95rem' }}>Update metrics</h3>
            <button className="btn-icon" onClick={onClose}><X size={15} /></button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>{idea.title}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {FIELDS.map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input
                  type="number"
                  min="0"
                  value={values[f.key]}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  style={{ fontSize: 13, padding: '6px 8px' }}
                  placeholder="—"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Skip</button>
            <button className="btn btn-accent btn-sm" onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
