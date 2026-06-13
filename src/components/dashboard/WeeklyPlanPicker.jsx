import { AREA_COLORS } from '../../lib/constants'
import { X, CalendarDays } from 'lucide-react'

const DAY_SHORT_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function areaColor(area) {
  return AREA_COLORS[area] || AREA_COLORS.Other
}

export default function WeeklyPlanPicker({ tasks, viewDayOfWeek, onSelect, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: 420, maxHeight: '70vh', overflow: 'auto', padding: 18 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: '0.95rem' }}>Pull from weekly plan</h3>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>
        {tasks.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
            No incomplete tasks in this week's plan.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tasks.map(task => (
              <button
                key={task.id}
                onClick={() => onSelect(task)}
                className="btn btn-ghost"
                style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span className="badge" style={{ background: `${areaColor(task.area)}22`, color: areaColor(task.area), flexShrink: 0 }}>{task.area}</span>
                <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.specific_task || task.action}</span>
                {task.day_of_week != null && (
                  <span
                    className="badge"
                    title={task.day_of_week === viewDayOfWeek ? 'Allocated to this day' : 'Allocated day'}
                    style={{
                      fontSize: 9, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3,
                      background: task.day_of_week === viewDayOfWeek ? 'var(--success-tint, var(--career-tint))' : 'var(--career-tint)',
                      color: 'var(--career)',
                      marginLeft: task.time_allocation ? 0 : 'auto',
                    }}
                  >
                    <CalendarDays size={9} /> {DAY_SHORT_LABELS[task.day_of_week]}
                  </span>
                )}
                {task.time_allocation && (
                  <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginLeft: 'auto', flexShrink: 0 }}>{task.time_allocation}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
