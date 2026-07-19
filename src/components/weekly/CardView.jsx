import { AREA_COLORS } from '../../lib/constants'
import { PRIORITY_COLORS } from '../../lib/constants'
import { Check, RotateCcw } from 'lucide-react'

function areaColor(area) {
  return AREA_COLORS[area] || AREA_COLORS.Other
}

const PRIORITY_LABEL = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' }

export default function CardView({ tasks, goals, onToggle, onOpenDetail }) {
  const linkedGoal = (task) => goals.find(g => g.id === task.goal_id)

  if (!tasks.length) {
    return <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', fontStyle: 'italic' }}>No tasks this week — click "Add task" to start</p>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
      {tasks.map(task => {
        const color = areaColor(task.area)
        const goal = linkedGoal(task)
        const done = task.complete
        const pColor = task.priority_level ? (PRIORITY_COLORS[task.priority_level] || '#8a7d75') : null

        return (
          <div
            key={task.id}
            onClick={() => onOpenDetail(task)}
            style={{
              background: 'var(--bg-2)',
              borderRadius: 12,
              borderLeft: `4px solid ${color}`,
              padding: '14px 16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              opacity: done ? 0.65 : 1,
              transition: 'box-shadow 0.15s, transform 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
          >
            {/* Top row: area badge + completion */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                background: color + '20',
                color,
                borderRadius: 20,
                padding: '3px 10px',
              }}>{task.area}</span>
              <div
                onClick={e => { e.stopPropagation(); onToggle(task) }}
                style={{
                  width: 24, height: 24,
                  borderRadius: '50%',
                  border: done ? 'none' : '2px solid var(--border)',
                  background: done ? color : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                {done && <Check size={13} color="#fff" strokeWidth={3} />}
              </div>
            </div>

            {/* Task title */}
            <p style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: 1.35,
              textDecoration: done ? 'line-through' : 'none',
              margin: 0,
            }}>{task.specific_task}</p>

            {/* Badges row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {task.frequency && (
                <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--bg-3)', borderRadius: 20, padding: '2px 9px' }}>{task.frequency}</span>
              )}
              {task.time_allocation && (
                <span style={{ fontSize: 11, color: 'var(--text-3)', background: 'var(--bg-3)', borderRadius: 20, padding: '2px 9px', fontFamily: 'var(--font-mono)' }}>{task.time_allocation}</span>
              )}
              {pColor && task.priority_level && (
                <span style={{ fontSize: 11, fontWeight: 600, color: pColor, background: pColor + '18', borderRadius: 20, padding: '2px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: pColor, display: 'inline-block' }} />
                  {PRIORITY_LABEL[task.priority_level]}
                </span>
              )}
            </div>

            {/* Goal footer */}
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
              {goal ? `Goal: ${goal.primary_goal?.slice(0, 40)}` : 'No goal linked'}
            </p>
          </div>
        )
      })}
    </div>
  )
}
