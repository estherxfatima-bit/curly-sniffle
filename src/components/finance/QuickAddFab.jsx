import { useState, useRef, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import QuickAddExpense from './QuickAddExpense'

// Floating action button (bottom-right) that opens a quick-add popover.
export default function QuickAddFab({ onAdd }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 30 }}>
      {open && (
        <div className="card scale-in" style={{ position: 'absolute', bottom: '110%', right: 0, width: 280, marginBottom: 12, boxShadow: 'var(--shadow)' }}>
          <h3 style={{ fontSize: '0.85rem', marginBottom: 12 }}>Quick add expense</h3>
          <QuickAddExpense onAdd={onAdd} />
        </div>
      )}
      <button
        className="btn btn-finance"
        onClick={() => setOpen(v => !v)}
        title="Quick add expense"
        style={{
          width: 52, height: 52, borderRadius: '50%', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow)', color: '#fff',
        }}
      >
        {open ? <X size={20} /> : <Plus size={22} />}
      </button>
    </div>
  )
}
