import { AREA_COLORS } from '../../lib/constants'
import PriorityDot from '../shared/PriorityDot'

function areaColor(area) {
  return AREA_COLORS[area] || AREA_COLORS.Other
}

export default function CardView({ tasks, goals, onToggle, onOpenDetail }) {
  const linkedGoal = (task) => goals.find(g => g.id === task.goal_id)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
      {tasks.map(task => {
        const color = areaColor(task.area)
        const goal = linkedGoal(task)
        const done = task.complete
        return (
          <div
            key={task.id}
            onClick={() => onOpenDetail(task)}
            style={{
              background: 'var(--bg-2)',
              borderRadius: 'var(--radius)',
              borderLeft: `4px solid ${color}`,
              padding: '12px 14px',
              cursor: 'pointer',
              opacity: done ? 0.6 : 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.1)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <input
                type="checkbox"
                checked={done}
                onChange={e => { e.stopPropagation(); onToggle(task) }}
                onClick={e => e.stopPropagation()}
                style={{ marginTop: 2, flexShrink: 0, cursor: 'pointer' }}
              />
              <p style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text)',
                lineHeight: 1.4,
                flex: 1,
                textDecoration: done ? 'line-through' : 'none',
              }}>
                {task.specific_task}
              </p>
            </div>
            {task.action && (
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 24 }}>{task.action}</p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginLeft: 24 }}>
              <span style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                background: color + '22',
                color: color,
                borderRadius: 4,
                padding: '2px 6px',
              }}>{task.area}</span>
              {task.priority_level && <PriorityDot level={task.priority_level} size={10} />}
              {task.frequency && (
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{task.frequency}</span>
              )}
              {task.time_allocation && (
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{task.time_allocation}</span>
              )}
              {goal && (
                <span style={{ fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                  🎯 {goal.primary_goal?.slice(0, 30)}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
