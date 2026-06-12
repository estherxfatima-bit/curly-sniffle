import { Check, Snowflake } from 'lucide-react'
import { isExpectedDay, habitColor } from '../../lib/habitUtils'

export default function TodayView({ habits, today, todayStr, logsByHabit, sims, onToggleLog }) {
  const todaysHabits = habits.filter(h => isExpectedDay(h, today))

  if (todaysHabits.length === 0) {
    return <div className="empty-state"><p>Nothing scheduled for today.</p></div>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
      {todaysHabits.map(habit => {
        const color = habitColor(habit)
        const logged = logsByHabit[habit.id]?.has(todayStr)
        const frozen = sims[habit.id]?.frozenDates?.has(todayStr)
        const streak = sims[habit.id]?.streak ?? 0
        const banked = sims[habit.id]?.banked ?? 0

        return (
          <div key={habit.id} className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, textAlign: 'center' }}>
              <span style={{ fontSize: 20 }}>{habit.emoji}</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{habit.name}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {streak > 0 && <span style={{ fontSize: 13 }}>🔥 {streak}</span>}
              {banked > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12, color: 'var(--finance)', fontFamily: 'var(--font-mono)' }}>
                  <Snowflake size={12} />×{banked}
                </span>
              )}
              {streak === 0 && banked === 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No streak yet</span>}
            </div>

            <button
              onClick={() => onToggleLog(habit, todayStr)}
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: logged || frozen ? color : 'var(--card-bg)',
                border: `3px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              title={logged ? 'Mark as not done' : 'Mark as done'}
            >
              {logged && <Check size={28} color="white" strokeWidth={3} />}
              {!logged && frozen && <Snowflake size={28} color="white" />}
            </button>
          </div>
        )
      })}
    </div>
  )
}
