import { TASK_AREAS, AREA_COLORS } from '../../lib/constants'
import { format, addDays, startOfWeek } from 'date-fns'

const DAY_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function areaColor(area) {
  return AREA_COLORS[area] || AREA_COLORS.Other
}

function TaskPill({ task, onOpenDetail }) {
  const color = areaColor(task.area)
  const label = task.specific_task.length > 18 ? task.specific_task.slice(0, 17) + '…' : task.specific_task
  return (
    <div
      onClick={() => onOpenDetail(task)}
      title={task.specific_task}
      style={{
        background: color + '18',
        color,
        border: `1px solid ${color}40`,
        borderRadius: 8,
        padding: '5px 10px',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        lineHeight: 1.3,
        marginBottom: 4,
        opacity: task.complete ? 0.5 : 1,
        textDecoration: task.complete ? 'line-through' : 'none',
        transition: 'opacity 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
      onMouseEnter={e => e.currentTarget.style.background = color + '28'}
      onMouseLeave={e => e.currentTarget.style.background = color + '18'}
    >
      {task.complete && <span style={{ fontSize: 10 }}>✓</span>}
      {label}
    </div>
  )
}

export default function TimelineView({ tasks, weekStart, onOpenDetail }) {
  const today = new Date()
  const todayDateStr = format(today, 'yyyy-MM-dd')

  // Compute all 7 day dates
  const days = DAY_SHORT.map((label, i) => {
    const d = addDays(weekStart, i)
    return { label, date: d, dateStr: format(d, 'yyyy-MM-dd'), dayNum: format(d, 'd'), isToday: format(d, 'yyyy-MM-dd') === todayDateStr }
  })

  const scheduled = tasks.filter(t => t.day_of_week != null)
  const unscheduled = tasks.filter(t => t.day_of_week == null)

  // Only show rows for areas that have tasks this week
  const usedAreas = TASK_AREAS.filter(area =>
    tasks.some(t => t.area === area)
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 600 }}>
        <thead>
          <tr>
            <th style={{
              width: 110, padding: '10px 14px', fontSize: 11,
              fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
              color: 'var(--text-3)', textAlign: 'left', letterSpacing: '0.05em',
            }}>Area</th>
            {days.map((day, i) => (
              <th key={i} style={{ padding: '8px 6px', textAlign: 'center', minWidth: 80 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                    letterSpacing: '0.07em',
                    color: day.isToday ? '#1a4fff' : 'var(--text-3)',
                  }}>{day.label}</span>
                  <span style={{
                    width: 30, height: 30,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%',
                    background: day.isToday ? '#1a4fff' : 'transparent',
                    color: day.isToday ? '#fff' : 'var(--text)',
                    fontSize: 14, fontWeight: day.isToday ? 700 : 500,
                  }}>{day.dayNum}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {usedAreas.map((area, ri) => {
            const color = areaColor(area)
            return (
              <tr key={area}>
                <td style={{
                  padding: '10px 14px',
                  verticalAlign: 'top',
                  borderTop: '1px solid var(--border)',
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    background: color + '18',
                    color,
                    borderRadius: 20,
                    padding: '3px 10px',
                  }}>{area}</span>
                </td>
                {days.map((day, di) => {
                  const dayTasks = scheduled.filter(t => t.area === area && t.day_of_week === di)
                  return (
                    <td key={di} style={{
                      padding: '8px 4px',
                      verticalAlign: 'top',
                      borderTop: '1px solid var(--border)',
                      background: day.isToday ? '#1a4fff06' : 'transparent',
                    }}>
                      {dayTasks.map(t => <TaskPill key={t.id} task={t} onOpenDetail={onOpenDetail} />)}
                    </td>
                  )
                })}
              </tr>
            )
          })}

          {/* Unscheduled row */}
          {unscheduled.length > 0 && (
            <tr>
              <td style={{
                padding: '10px 14px', verticalAlign: 'top',
                borderTop: '2px solid var(--border)',
              }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>Unscheduled</span>
              </td>
              <td colSpan={7} style={{ padding: '8px 4px', borderTop: '2px solid var(--border)', verticalAlign: 'top' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {unscheduled.map(t => (
                    <div
                      key={t.id}
                      onClick={() => onOpenDetail(t)}
                      style={{
                        background: areaColor(t.area) + '18',
                        color: areaColor(t.area),
                        border: `1px solid ${areaColor(t.area)}40`,
                        borderRadius: 8,
                        padding: '4px 10px',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        opacity: t.complete ? 0.5 : 1,
                      }}
                    >
                      {t.specific_task}
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          )}

          {usedAreas.length === 0 && unscheduled.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontStyle: 'italic', fontSize: 13 }}>
                No tasks this week.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
