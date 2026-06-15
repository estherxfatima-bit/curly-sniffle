import { useState, useRef, useEffect } from 'react'
import { PRIORITY_LEVELS, PRIORITY_LABELS, PRIORITY_COLORS, PRIORITY_MARKS } from '../../lib/constants'

// Clickable priority badge — shows '!' / '!!' / '!!!' / '!!!!' for
// Low / Medium / High / Urgent (colour-coded), or a faint '!' when no
// priority is set. Clicking opens a small menu to pick a level directly,
// or clear it.
export default function PriorityDot({ priority, onChange, size = 12 }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const color = PRIORITY_COLORS[priority]
  const label = PRIORITY_LABELS[priority] || 'No priority'
  const mark = PRIORITY_MARKS[priority] || '!'

  function choose(value) {
    onChange(value)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
      <button
        className="btn-icon"
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        title={`Priority: ${label} (click to change)`}
        style={{ padding: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span style={{
          display: 'block',
          fontSize: size,
          fontWeight: 800,
          lineHeight: 1,
          fontFamily: 'var(--font-mono)',
          letterSpacing: -1,
          color: color || 'var(--text-3)',
          opacity: color ? 1 : 0.35,
        }}>
          {mark}
        </span>
      </button>

      {open && (
        <div
          className="card"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
            padding: 4, display: 'flex', flexDirection: 'column', gap: 2,
            minWidth: 120, boxShadow: 'var(--shadow-lg)',
          }}
        >
          {PRIORITY_LEVELS.map(level => (
            <button
              key={level}
              className="btn btn-ghost btn-sm"
              onClick={() => choose(level)}
              style={{
                justifyContent: 'flex-start', gap: 8, fontSize: 12,
                ...(priority === level ? { background: 'var(--bg-3)' } : {}),
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: PRIORITY_COLORS[level], width: 36 }}>{PRIORITY_MARKS[level]}</span>
              {PRIORITY_LABELS[level]}
            </button>
          ))}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => choose(null)}
            style={{
              justifyContent: 'flex-start', gap: 8, fontSize: 12,
              ...(!priority ? { background: 'var(--bg-3)' } : {}),
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-3)', width: 36, opacity: 0.5 }}>!</span>
            No priority
          </button>
        </div>
      )}
    </div>
  )
}
