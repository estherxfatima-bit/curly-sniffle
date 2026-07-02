import { useState } from 'react'
import { format, isSameMonth, startOfMonth, endOfMonth, startOfWeek, addDays, subDays } from 'date-fns'
import { ChevronLeft, ChevronRight, Check, Snowflake } from 'lucide-react'
import ArcRing from '../ui/ArcRing'
import { habitColor, monthStats, dayStatus, DAY_NAMES } from '../../lib/habitUtils'

const CELL = 18
const HEATMAP_WEEKS = 13 // ~3 months

function CompletionHeatmap({ habits, logsByHabit, today }) {
  const todayStr = format(today, 'yyyy-MM-dd')
  const total = habits.length || 1

  // Build a 13-week grid ending today
  const gridEnd = today
  const gridEndWeekSun = addDays(startOfWeek(gridEnd, { weekStartsOn: 1 }), 6)
  const gridStart = subDays(gridEndWeekSun, HEATMAP_WEEKS * 7 - 1)
  const weeks = []
  for (let d = gridStart; d <= gridEndWeekSun; d = addDays(d, 7)) weeks.push(d)

  function pct(dateStr) {
    if (dateStr > todayStr) return null
    let done = 0
    for (const h of habits) {
      if (logsByHabit[h.id]?.has(dateStr)) done++
    }
    return total > 0 ? done / total : 0
  }

  function cellColor(p) {
    if (p === null) return 'var(--bg-3)'
    if (p === 0) return 'var(--bg-2)'
    if (p < 0.34) return 'color-mix(in srgb, var(--personal) 25%, var(--bg-2))'
    if (p < 0.67) return 'color-mix(in srgb, var(--personal) 55%, var(--bg-2))'
    if (p < 1)    return 'color-mix(in srgb, var(--personal) 80%, var(--bg-2))'
    return 'var(--personal)'
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 18, flexShrink: 0 }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ height: CELL, display: 'flex', alignItems: 'center', fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', width: 12 }}>
              {d.slice(0, 1)}
            </div>
          ))}
        </div>
        {/* Week columns */}
        {weeks.map((weekStart, wi) => {
          const monthLabel = wi === 0 || format(weekStart, 'M') !== format(subDays(weekStart, 7), 'M')
            ? format(weekStart, 'MMM')
            : ''
          return (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
              <div style={{ height: 14, fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{monthLabel}</div>
              {Array.from({ length: 7 }, (_, i) => {
                const date = addDays(weekStart, i)
                const ds = format(date, 'yyyy-MM-dd')
                const p = pct(ds)
                return (
                  <div
                    key={ds}
                    title={ds + (p !== null ? ` — ${Math.round(p * 100)}%` : '')}
                    style={{
                      width: CELL, height: CELL, borderRadius: 3,
                      background: cellColor(p),
                      flexShrink: 0,
                    }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-2 mt-3" style={{ justifyContent: 'flex-end' }}>
        <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>Less</p>
        {[0, 0.33, 0.66, 1].map(p => (
          <div key={p} style={{ width: 10, height: 10, borderRadius: 2, background: cellColor(p) }} />
        ))}
        <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>More</p>
      </div>
    </div>
  )
}

export default function MonthView({ habits, logsByHabit, sims, monthDate, today, onPrevMonth, onNextMonth, onToggleLog }) {
  const [tab, setTab] = useState('overview')
  const isCurrentMonth = isSameMonth(monthDate, today)

  if (habits.length === 0) {
    return <div className="empty-state"><p>No habits yet.</p></div>
  }

  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const weeks = []
  for (let ws = gridStart; ws <= monthEnd; ws = addDays(ws, 7)) {
    weeks.push(ws)
  }

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex items-center gap-2 mb-4">
        {['overview', 'by-habit'].map(t => (
          <button
            key={t}
            className={`btn btn-xs ${tab === t ? 'btn-personal' : 'btn-ghost'}`}
            style={tab === t ? { color: '#fff' } : {}}
            onClick={() => setTab(t)}
          >
            {t === 'overview' ? 'Overview' : 'By habit'}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="card" style={{ padding: 20 }}>
          <p className="mono mb-4" style={{ fontSize: 11 }}>13-week completion heatmap</p>
          <CompletionHeatmap habits={habits} logsByHabit={logsByHabit} today={today} />
        </div>
      ) : null}

      {/* Month nav — only show in by-habit tab */}
      {tab === 'by-habit' && (
        <div className="flex items-center justify-between mb-4">
          <button className="btn-icon btn" onClick={onPrevMonth}><ChevronLeft size={16} /></button>
          <h3 style={{ fontSize: '1rem' }}>{format(monthDate, 'MMMM yyyy')}</h3>
          <button className="btn-icon btn" onClick={onNextMonth} disabled={isCurrentMonth} style={isCurrentMonth ? { opacity: 0.3, cursor: 'default' } : {}}><ChevronRight size={16} /></button>
        </div>
      )}

      {tab === 'by-habit' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>

        {habits.map(habit => {
          const color = habitColor(habit)
          const logSet = logsByHabit[habit.id] || new Set()
          const frozenSet = sims[habit.id]?.frozenDates || new Set()
          const stats = monthStats(habit, logSet, frozenSet, monthDate, today)
          const streak = sims[habit.id]?.streak ?? 0

          return (
            <div key={habit.id} className="card" style={{ padding: 14 }}>
              <div className="flex items-center justify-between gap-2 wrap mb-3">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 16 }}>{habit.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{habit.name}</span>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block' }} />
                </div>
                <ArcRing value={stats.completionPct} max={100} size={36} strokeWidth={4} color={color} label={`${stats.completionPct}%`} fontSize={8} />
              </div>

              {/* Calendar grid: Mon-Sun rows, weeks across */}
              <div className="table-scroll" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                  {DAY_NAMES.map(d => (
                    <div key={d} style={{ height: CELL, display: 'flex', alignItems: 'center', fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                      {d.slice(0, 1)}
                    </div>
                  ))}
                </div>
                {weeks.map(weekStart => (
                  <div key={format(weekStart, 'yyyy-MM-dd')} style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                    {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map(date => {
                      const inMonth = isSameMonth(date, monthDate)
                      const ds = format(date, 'yyyy-MM-dd')
                      const status = dayStatus(habit, logSet, frozenSet, date, today)
                      let bg = 'var(--card-bg)'
                      let border = 'var(--border)'
                      if (status === 'done' || status === 'frozen') { bg = color; border = color }
                      else if (status === 'na' || !inMonth) { bg = 'var(--bg-3)'; border = 'transparent' }

                      const clickable = inMonth && status !== 'na'

                      return (
                        <div
                          key={ds}
                          onClick={() => clickable && onToggleLog(habit, ds)}
                          title={ds}
                          style={{
                            width: CELL, height: CELL, borderRadius: 4,
                            background: bg, border: `1px solid ${border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: clickable ? 'pointer' : 'default',
                            opacity: !inMonth ? 0.25 : 1,
                            flexShrink: 0,
                          }}
                        >
                          {status === 'done' && <Check size={9} color="white" strokeWidth={3} />}
                          {status === 'frozen' && <Snowflake size={9} color="white" />}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <p style={{ fontSize: 11, color: 'var(--text-2)' }}>Longest streak this month: <strong>{stats.longestStreak}</strong></p>
                <p style={{ fontSize: 11, color: 'var(--text-2)' }}>Current streak: <strong>{streak}</strong>{streak >= 3 ? ' 🔥' : ''}</p>
                {stats.monthlyGoal && (
                  <p style={{ fontSize: 11, color: 'var(--text-2)' }}>Monthly goal: <strong>{stats.monthlyGoal.current}/{stats.monthlyGoal.target}</strong></p>
                )}
              </div>
            </div>
          )
        })}
      </div>}
    </div>
  )
}
