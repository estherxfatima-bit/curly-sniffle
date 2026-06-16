import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { format } from 'date-fns'

const MOODS = [
  { value: 1, emoji: '😞', label: 'Low' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😊', label: 'Great' },
]

export default function MoodWidget() {
  const { user } = useAuth()
  const [todayMood, setTodayMood] = useState(null)
  const [saving, setSaving] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (!user) return
    supabase.from('mood_logs').select('mood_score').eq('user_id', user.id).eq('log_date', today).maybeSingle()
      .then(({ data }) => { if (data) setTodayMood(data.mood_score) })
  }, [user, today])

  async function logMood(score) {
    if (saving) return
    setSaving(true)
    await supabase.from('mood_logs').upsert({ user_id: user.id, mood_score: score, log_date: today }, { onConflict: 'user_id,log_date' })
    setTodayMood(score)
    setSaving(false)
  }

  return (
    <div className="card card-personal card-sm">
      <p className="mono mb-3">Today's mood</p>
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
    </div>
  )
}
