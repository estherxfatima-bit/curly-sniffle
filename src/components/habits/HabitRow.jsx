import { format, isAfter, isToday } from 'date-fns'
import { Check, Trash2, Snowflake, Edit2 } from 'lucide-react'
import { isExpectedDay, frequencyLabel, computeCurrentStreak, weekCount } from '../../lib/habitUtils'

export default function HabitRow({ habit, weekDays, logSet, freezeSet, freezeAvailable, onToggleLog, onFreeze, onOpenMonth, onEdit, onDelete }) {
  const today = new Date()
  const streak = computeCurrentStreak(habit, logSet, freezeSet, today)
  const isTimesPerWeek = habit.frequency_type === 'times_per_week'
  const cnt = isTimesPerWeek ? weekCount(logSet, weekDays[0]) : 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 110px 1fr 56px', padding: '13px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center', minWidth: 700 }}>
      {/* Habit name + frequency */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <button
          onClick={() => onOpenMonth(habit)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
          title="See month"
        >
          <span style={{ fontSize: 16 }}>{habit.emoji}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</span>
        </button>
        <div className="flex items-center gap-2 wrap">
          <span className="badge badge-muted" style={{ fontSize: 9 }}>{frequencyLabel(habit)}</span>
          {isTimesPerWeek && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>{cnt}/{habit.frequency_count} this week</span>
          )}
        </div>
      </div>

      {/* Streak + freeze */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 22, fontFamily: 'var(--font-serif)', fontWeight: 700, color: streak > 0 ? 'var(--personal)' : 'var(--text-3)' }}>{streak}</span>
        {streak >= 3 && <span style={{ fontSize: 14 }}>🔥</span>}
        {streak > 0 && (
          <span title={freezeAvailable ? 'Streak freeze available this month' : 'Freeze used this month'}>
            <Snowflake size={13} color={freezeAvailable ? 'var(--finance)' : 'var(--border)'} />
          </span>
        )}
      </div>

      {/* Week dots */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {weekDays.map(d => {
          const ds = format(d, 'yyyy-MM-dd')
          const expected = isExpectedDay(habit, d)
          const logged = logSet.has(ds)
          const frozen = freezeSet.has(ds)
          const future = isAfter(d, today) && !isToday(d)
          const todayDot = isToday(d)

          let bg = 'var(--bg-3)'
          let border = 'transparent'
          if (logged || frozen) bg = 'var(--personal)'
          else if (!expected) bg = 'var(--bg-3)'
          else bg = 'var(--card-bg)'
          if (todayDot) border = 'var(--personal)'

          const canFreeze = expected && !logged && !frozen && !future && !todayDot && freezeAvailable
          const clickable = expected && !future

          return (
            <div key={ds} style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <div
                onClick={() => clickable && onToggleLog(habit, ds)}
                title={!expected ? 'Not scheduled' : ds}
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: bg,
                  border: `2px solid ${border}`,
                  cursor: clickable ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                  boxShadow: logged ? '0 0 0 2px var(--personal-tint)' : 'none',
                  opacity: !expected ? 0.5 : 1,
                }}
              >
                {logged && <Check size={10} color="white" strokeWidth={3} />}
                {!logged && frozen && <Snowflake size={10} color="white" />}
              </div>
              {canFreeze && (
                <button
                  onClick={() => onFreeze(habit, ds)}
                  title="Freeze this missed day"
                  className="btn-icon"
                  style={{ position: 'absolute', top: -8, right: -2, padding: 0, width: 14, height: 14, color: 'var(--finance)', background: 'var(--card-bg)', borderRadius: '50%' }}
                >
                  <Snowflake size={10} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Edit / delete */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <button className="btn-icon btn" onClick={() => onEdit(habit)}><Edit2 size={12} /></button>
        <button className="btn-icon btn" onClick={() => onDelete(habit.id)}><Trash2 size={13} /></button>
      </div>
    </div>
  )
}
