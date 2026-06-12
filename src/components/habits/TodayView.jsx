import { Check, Snowflake } from 'lucide-react'
import { isExpectedDay, habitColor } from '../../lib/habitUtils'

export default function TodayView({ habits, today, todayStr, logsByHabit, sims, onToggleLog }) {
  const todaysHabits = habits.filter(h => isExpectedDay(h, today))

  if (todaysHabits.length === 0) {
    return <div className="empty-state"><p>Nothing scheduled for today.</p></div>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
      {todaysHabits.map(habit => {
        const color = habitColor(habit)
        const logged = logsByHabit[habit.id]?.has(todayStr)
        const frozen = sims[habit.id]?.frozenDates?.has(todayStr)
        const streak = sims[habit.id]?.streak ?? 0
        const banked = sims[habit.id]?.banked ?? 0

        return (
          <div key={habit.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
            <button
              onClick={() => onToggleLog(habit, todayStr)}
              style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: logged || frozen ? color : 'var(--card-bg)',
                border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              title={logged ? 'Mark as not done' : 'Mark as done'}
            >
              {logged && <Check size={18} color="white" strokeWidth={3} />}
              {!logged && frozen && <Snowflake size={18} color="white" />}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 14 }}>{habit.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{habit.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {streak > 0 && <span style={{ fontSize: 11 }}>🔥 {streak}</span>}
                {banked > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 10, color: 'var(--finance)', fontFamily: 'var(--font-mono)' }}>
                    <Snowflake size={10} />×{banked}
                  </span>
                )}
                {streak === 0 && banked === 0 && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>No streak yet</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
