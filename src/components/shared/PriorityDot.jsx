import { PRIORITY_LABELS, PRIORITY_COLORS, cyclePriority } from '../../lib/constants'

// Clickable dot that cycles Urgent -> High -> Medium -> Low -> None.
// Renders nothing visually distinct when there's no priority, beyond a faint outline,
// so it stays available as a click target without implying a priority is set.
export default function PriorityDot({ priority, onChange, size = 10 }) {
  const color = PRIORITY_COLORS[priority]
  const label = PRIORITY_LABELS[priority] || 'No priority'

  return (
    <button
      className="btn-icon"
      onClick={e => { e.stopPropagation(); onChange(cyclePriority(priority)) }}
      title={`Priority: ${label} (click to change)`}
      style={{ padding: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <span style={{
        display: 'block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color || 'transparent',
        border: color ? 'none' : '1.5px solid var(--text-3)',
      }} />
    </button>
  )
}
