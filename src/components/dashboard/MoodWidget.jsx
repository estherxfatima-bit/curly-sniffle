import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { format, subDays } from 'date-fns'

const MOODS = [
  { value: 1, emoji: '😞', label: 'Low' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😊', label: 'Great' },
]

const DAYS = 7

function MoodSparkline({ history }) {
  if (!history || history.every(v => v === null)) return null
  const W = 120, H = 32, pad = 4
  const filled = history.filter(v => v !== null)
  if (filled.length < 2) return null

  const xs = history.map((_, i) => pad + (i / (DAYS - 1)) * (W - pad * 2))
  const y = v => v === null ? null : H - pad - ((v - 1) / 4) * (H - pad * 2)

  // Build polyline from non-null consecutive points
  const points = history.map((v, i) => v !== null ? `${xs[i]},${y(v)}` : null).filter(Boolean).join(' ')

  return (
    <svg width={W} height={H} style={{ overflow: 'visible', display: 'block' }}>
      <polyline points={points} fill="none" stroke="var(--personal)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.6} />
      {history.map((v, i) => v !== null ? (
        <circle key={i} cx={xs[i]} cy={y(v)} r={i === DAYS - 1 ? 3 : 2} fill="var(--personal)" opacity={i === DAYS - 1 ? 1 : 0.5} />
      ) : null)}
    </svg>
  )
}

export default function MoodWidget() {
  const { user } = useAuth()
  const [todayMood, setTodayMood] = useState(null)
  const [moodHistory, setMoodHistory] = useState(Array(DAYS).fill(null))
  const [saving, setSaving] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (!user) return
    const days = Array.from({ length: DAYS }, (_, i) => format(subDays(new Date(), DAYS - 1 - i), 'yyyy-MM-dd'))
    supabase.from('mood_logs').select('mood_score, log_date').eq('user_id', user.id).gte('log_date', days[0]).lte('log_date', today)
      .then(({ data }) => {
        const map = Object.fromEntries((data || []).map(r => [r.log_date, r.mood_score]))
        setMoodHistory(days.map(d => map[d] ?? null))
        if (map[today]) setTodayMood(map[today])
      })
  }, [user, today])

  async function logMood(score) {
    if (saving) return
    setSaving(true)
    await supabase.from('mood_logs').upsert({ user_id: user.id, mood_score: score, log_date: today }, { onConflict: 'user_id,log_date' })
    setTodayMood(score)
    setMoodHistory(prev => { const next = [...prev]; next[DAYS - 1] = score; return next })
    setSaving(false)
  }

  const filledDays = moodHistory.filter(v => v !== null).length
  const avg = filledDays > 0 ? (moodHistory.filter(v => v !== null).reduce((s, v) => s + v, 0) / filledDays) : null

  return (
    <div className="card card-personal card-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="mono">Today's mood</p>
        {avg !== null && filledDays > 1 && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
            {avg.toFixed(1)} avg · {filledDays}d
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {MOODS.map(m => (
          <button
            key={m.value}
            onClick={() => logMood(m.value)}
            title={m.label}
            style={{
              fontSize: 24,
              background: todayMood === m.value ? 'var(--personal-tint)' : 'transparent',
              padding: '5px 7px',
              borderRadius: 'var(--radius)',
              border: todayMood === m.value ? '2px solid var(--personal)' : '2px solid transparent',
              opacity: 1,
              cursor: 'pointer',
              transition: 'all 0.15s',
              transform: todayMood === m.value ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            {m.emoji}
          </button>
        ))}
      </div>
      {todayMood && (
        <p style={{ fontSize: 11, color: 'var(--personal)', marginTop: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Logged — {MOODS.find(m => m.value === todayMood)?.label}
        </p>
      )}
      {filledDays > 1 && (
        <div style={{ marginTop: 12, opacity: 0.85 }}>
          <MoodSparkline history={moodHistory} />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', marginTop: 4 }}>7-day trend</p>
        </div>
      )}
    </div>
  )
}
