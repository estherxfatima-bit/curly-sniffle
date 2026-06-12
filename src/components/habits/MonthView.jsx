import { format, isSameMonth, getDate } from 'date-fns'
import { ChevronLeft, ChevronRight, Check, Snowflake } from 'lucide-react'
import ArcRing from '../ui/ArcRing'
import { habitColor, monthStats } from '../../lib/habitUtils'

const CELL = 22

export default function MonthView({ habits, logsByHabit, sims, monthDate, today, onPrevMonth, onNextMonth, onToggleLog }) {
  const isCurrentMonth = isSameMonth(monthDate, today)

  if (habits.length === 0) {
    return <div className="empty-state"><p>No habits yet.</p></div>
  }

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button className="btn-icon btn" onClick={onPrevMonth}><ChevronLeft size={16} /></button>
        <h3 style={{ fontSize: '1rem' }}>{format(monthDate, 'MMMM yyyy')}</h3>
        <button className="btn-icon btn" onClick={onNextMonth} disabled={isCurrentMonth} style={isCurrentMonth ? { opacity: 0.3, cursor: 'default' } : {}}><ChevronRight size={16} /></button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {habits.map(habit => {
          const color = habitColor(habit)
          const logSet = logsByHabit[habit.id] || new Set()
          const frozenSet = sims[habit.id]?.frozenDates || new Set()
          const stats = monthStats(habit, logSet, frozenSet, monthDate, today)
          const streak = sims[habit.id]?.streak ?? 0

          return (
            <div key={habit.id} className="card">
              <div className="flex items-center justify-between gap-3 wrap mb-4">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 18 }}>{habit.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{habit.name}</span>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
                </div>
                <div className="flex items-center gap-4 wrap">
                  <ArcRing value={stats.completionPct} max={100} size={44} strokeWidth={4} color={color} label={`${stats.completionPct}%`} fontSize={9} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Longest streak this month: <strong>{stats.longestStreak}</strong></p>
                    <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Current streak: <strong>{streak}</strong>{streak >= 3 ? ' 🔥' : ''}</p>
                    {stats.monthlyGoal && (
                      <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Monthly goal: <strong>{stats.monthlyGoal.current}/{stats.monthlyGoal.target}</strong></p>
                    )}
                  </div>
                </div>
              </div>

              {/* Day grid */}
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, minWidth: stats.days.length * (CELL + 4) }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {stats.days.map(({ date, ds }) => (
                      <div key={`h-${ds}`} style={{ width: CELL, textAlign: 'center', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                        {getDate(date)}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {stats.days.map(({ ds, status }) => {
                      let bg = 'var(--card-bg)'
                      let border = 'var(--border)'
                      if (status === 'done' || status === 'frozen') { bg = color; border = color }
                      else if (status === 'na' || status === 'future') { bg = 'var(--bg-3)'; border = 'transparent' }

                      const clickable = status === 'done' || status === 'missed'

                      return (
                        <div
                          key={ds}
                          onClick={() => clickable && onToggleLog(habit, ds)}
                          title={ds}
                          style={{
                            width: CELL, height: CELL, borderRadius: '50%',
                            background: bg, border: `2px solid ${border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: clickable ? 'pointer' : 'default',
                            opacity: status === 'future' ? 0.3 : 1,
                            flexShrink: 0,
                          }}
                        >
                          {status === 'done' && <Check size={10} color="white" strokeWidth={3} />}
                          {status === 'frozen' && <Snowflake size={10} color="white" />}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
