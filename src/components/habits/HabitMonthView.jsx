import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isAfter } from 'date-fns'
import { ChevronLeft, ChevronRight, X, Check, Snowflake } from 'lucide-react'
import ArcRing from '../ui/ArcRing'
import { DAY_NAMES, isExpectedDay, computeCurrentStreak, computeBestStreak } from '../../lib/habitUtils'

export default function HabitMonthView({ habit, logSet, freezeSet, monthDate, onPrevMonth, onNextMonth, onClose, onToggleLog }) {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d)

  // Stats for this month
  let loggedCount = 0, expectedCount = 0
  for (let d = monthStart; d <= monthEnd; d = addDays(d, 1)) {
    if (isAfter(d, today)) continue
    if (!isExpectedDay(habit, d)) continue
    expectedCount++
    if (logSet.has(format(d, 'yyyy-MM-dd'))) loggedCount++
  }
  const completionPct = expectedCount ? Math.round((loggedCount / expectedCount) * 100) : 0

  const currentStreak = computeCurrentStreak(habit, logSet, freezeSet, today)
  const bestStreak = computeBestStreak(habit, logSet, freezeSet, habit.created_at ? new Date(habit.created_at) : monthStart, today)

  const monthKey = format(monthDate, 'yyyy-MM')
  const freezeUsedThisMonth = [...freezeSet].some(d => d.startsWith(monthKey))

  const isCurrentMonth = isSameMonth(monthDate, today)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.2rem' }}>{habit.emoji} {habit.name}</h2>
          <button className="btn-icon btn" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button className="btn-icon btn" onClick={onPrevMonth}><ChevronLeft size={16} /></button>
          <h3 style={{ fontSize: '1rem' }}>{format(monthDate, 'MMMM yyyy')}</h3>
          <button className="btn-icon btn" onClick={onNextMonth} disabled={isCurrentMonth} style={isCurrentMonth ? { opacity: 0.3, cursor: 'default' } : {}}><ChevronRight size={16} /></button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-5 wrap">
          <ArcRing value={completionPct} max={100} size={64} strokeWidth={6} color="var(--personal)" label={`${completionPct}%`} sublabel="this month" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Current streak: <strong>{currentStreak}</strong>{currentStreak >= 3 ? ' 🔥' : ''}</p>
            <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Best streak ever: <strong>{bestStreak}</strong></p>
            <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Logged this month: <strong>{loggedCount}</strong> day{loggedCount === 1 ? '' : 's'}</p>
            <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Freeze used this month: <strong>{freezeUsedThisMonth ? 'Yes' : 'No'}</strong></p>
          </div>
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>{d.slice(0, 1)}</div>
          ))}
          {days.map(d => {
            const ds = format(d, 'yyyy-MM-dd')
            const inMonth = isSameMonth(d, monthDate)
            const future = isAfter(d, today)
            const expected = isExpectedDay(habit, d)
            const logged = logSet.has(ds)
            const frozen = freezeSet.has(ds)
            let bg = 'var(--bg-3)'
            if (inMonth && !future) {
              if (logged || frozen) bg = 'var(--personal)'
              else if (!expected) bg = 'var(--bg-3)'
              else bg = 'transparent'
            }
            return (
              <div
                key={ds}
                onClick={() => { if (inMonth && !future && expected) onToggleLog(ds) }}
                title={ds}
                style={{
                  aspectRatio: '1',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: bg,
                  border: inMonth ? `2px solid ${(!future && expected && !logged && !frozen) ? 'var(--border)' : 'transparent'}` : 'none',
                  opacity: inMonth ? (future ? 0.3 : 1) : 0.15,
                  cursor: (inMonth && !future && expected) ? 'pointer' : 'default',
                  fontSize: 11,
                }}
              >
                {frozen ? <Snowflake size={11} color="var(--finance)" /> : logged ? <Check size={11} color="white" strokeWidth={3} /> : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
