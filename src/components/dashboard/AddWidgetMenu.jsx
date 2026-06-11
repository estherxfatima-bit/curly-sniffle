import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'

// Dropdown for adding hidden widgets back to a dashboard view
export default function AddWidgetMenu({ available, onAdd }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  if (available.length === 0) return null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn btn-sm btn-ghost" onClick={() => setOpen(v => !v)}>
        <Plus size={13} /> Add widget
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 20,
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
          minWidth: 180, padding: 6,
        }}>
          {available.map(({ id, label }) => (
            <div
              key={id}
              onClick={() => { onAdd(id); setOpen(false) }}
              style={{ padding: '7px 10px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
