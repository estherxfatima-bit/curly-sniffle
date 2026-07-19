import { TASK_AREAS, AREA_COLORS } from '../../lib/constants'
import { format, addDays } from 'date-fns'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function areaColor(area) {
  return AREA_COLORS[area] || AREA_COLORS.Other
}

export default function TimelineView({ tasks, weekStart, onOpenDetail }) {
  const today = new Date()
  const todayIdx = (today.getDay() + 6) % 7 // 0=Mon..6=Sun
  const isCurrentWeek = format(weekStart, 'yyyy-MM-dd') === format(new Date(today.getFullYear(), today.getMonth(), today.getDate() - todayIdx), 'yyyy-MM-dd')

  const scheduled = tasks.filter(t => t.day_of_week != null)
  const unscheduled = tasks.filter(t => t.day_of_week == null)

  const rows = TASK_AREAS.map(area => ({
    area,
    color: areaColor(area),
    byDay: DAY_LABELS.map((_, dayIdx) => scheduled.filter(t => t.area === area && t.day_of_week === dayIdx)),
  })).filter(r => r.byDay.some(d => d.length > 0))

  const thStyle = (dayIdx) => ({
    padding: '8px 4px',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    textAlign: 'center',
    color: isCurrentWeek && dayIdx === todayIdx ? '#fff' : 'var(--text-3)',
    background: isCurrentWeek && dayIdx === todayIdx ? '#1a4fff' : 'transparent',
    borderRadius: isCurrentWeek && dayIdx === todayIdx ? 4 : 0,
    fontWeight: isCurrentWeek && dayIdx === todayIdx ? 700 : 400,
    minWidth: 80,
  })

  function Pill({ task }) {
    const color = areaColor(task.area)
    return (
      <div
        onClick={() => onOpenDetail(task)}
        title={task.specific_task}
        style={{
          background: color + '20',
          color,
          borderLeft: `3px solid ${color}`,
          borderRadius: 4,
          padding: '3px 7px',
          fontSize: 11,
          cursor: 'pointer',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
          opacity: task.complete ? 0.5 : 1,
          textDecoration: task.complete ? 'line-through' : 'none',
          marginBottom: 3,
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = task.complete ? 0.7 : 0.85}
        onMouseLeave={e => e.currentTarget.style.opacity = task.complete ? 0.5 : 1}
      >
        {task.specific_task}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
        <thead>
          <tr>
            <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-3)', textAlign: 'left', width: 110, fontFamily: 'var(--font-mono)' }}>Area</th>
            {DAY_LABELS.map((label, i) => (
              <th key={i} style={thStyle(i)}>
                {label}
                {weekStart && (
                  <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>
                    {format(addDays(weekStart, i), 'd')}
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.area}>
              <td style={{
                padding: '8px 12px',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: row.color,
                verticalAlign: 'top',
                borderTop: '1px solid var(--border)',
                whiteSpace: 'nowrap',
              }}>
                {row.area}
              </td>
              {row.byDay.map((dayTasks, dayIdx) => (
                <td key={dayIdx} style={{
                  padding: '6px 4px',
                  verticalAlign: 'top',
                  borderTop: '1px solid var(--border)',
                  background: isCurrentWeek && dayIdx === todayIdx ? '#1a4fff08' : 'transparent',
                }}>
                  {dayTasks.map(t => <Pill key={t.id} task={t} />)}
                </td>
              ))}
            </tr>
          ))}
          {unscheduled.length > 0 && (
            <tr>
              <td style={{
                padding: '8px 12px',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-3)',
                verticalAlign: 'top',
                borderTop: '2px solid var(--border)',
              }}>
                Unscheduled
              </td>
              <td colSpan={7} style={{ padding: '6px 4px', borderTop: '2px solid var(--border)', verticalAlign: 'top' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {unscheduled.map(t => (
                    <div
                      key={t.id}
                      onClick={() => onOpenDetail(t)}
                      style={{
                        background: areaColor(t.area) + '20',
                        color: areaColor(t.area),
                        borderLeft: `3px solid ${areaColor(t.area)}`,
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: 11,
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
          {rows.length === 0 && unscheduled.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, fontStyle: 'italic' }}>
                No tasks this week.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
