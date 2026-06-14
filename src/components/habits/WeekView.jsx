import { format } from 'date-fns'
import HabitRow from './HabitRow'
import { isExpectedThisWeek } from '../../lib/habitUtils'

export default function WeekView({ habits, weekDays, todayStr, logsByHabit, sims, onToggleLog, onOpenMonth, onEdit, onDelete }) {
  const visibleHabits = habits.filter(isExpectedThisWeek)

  if (visibleHabits.length === 0) {
    return <div className="empty-state"><p>No habits scheduled this week.</p></div>
  }

  return (
    <div className="card table-scroll" style={{ padding: 0 }}>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 110px 1fr 56px', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', minWidth: 700 }}>
        <span className="mono">Habit</span>
        <span className="mono">Streak</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {weekDays.map(d => (
            <div key={format(d, 'yyyy-MM-dd')} style={{ textAlign: 'center', fontSize: 9, fontFamily: 'var(--font-mono)', color: format(d, 'yyyy-MM-dd') === todayStr ? 'var(--personal)' : 'var(--text-3)', letterSpacing: '0.02em' }}>
              {format(d, 'EEE').slice(0,1)}<br/>{format(d, 'd')}
            </div>
          ))}
        </div>
        <span />
      </div>

      {visibleHabits.map(habit => (
        <HabitRow
          key={habit.id}
          habit={habit}
          weekDays={weekDays}
          logSet={logsByHabit[habit.id] || new Set()}
          frozenSet={sims[habit.id]?.frozenDates || new Set()}
          streak={sims[habit.id]?.streak ?? 0}
          banked={sims[habit.id]?.banked ?? 0}
          onToggleLog={onToggleLog}
          onOpenMonth={onOpenMonth}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
