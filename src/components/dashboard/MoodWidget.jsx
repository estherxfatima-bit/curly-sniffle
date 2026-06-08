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
    supabase
      .from('mood_logs')
      .select('mood_score')
      .eq('user_id', user.id)
      .eq('log_date', today)
      .maybeSingle()
      .then(({ data }) => { if (data) setTodayMood(data.mood_score) })
  }, [user, today])

  const logMood = async (score) => {
    if (todayMood || saving) return
    setSaving(true)
    await supabase.from('mood_logs').upsert({
      user_id: user.id,
      mood_score: score,
      log_date: today,
    }, { onConflict: 'user_id,log_date' })
    setTodayMood(score)
    setSaving(false)
  }

  return (
    <div className="card card-sm">
      <p className="mono mb-2">Today's mood</p>
      <div style={{ display: 'flex', gap: '8px' }}>
        {MOODS.map(m => (
          <button
            key={m.value}
            onClick={() => logMood(m.value)}
            title={m.label}
            style={{
              fontSize: '22px',
              background: 'transparent',
              padding: '4px 6px',
              borderRadius: 'var(--radius)',
              border: todayMood === m.value ? '1px solid var(--accent)' : '1px solid transparent',
              opacity: todayMood && todayMood !== m.value ? 0.35 : 1,
              cursor: todayMood ? 'default' : 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {m.emoji}
          </button>
        ))}
      </div>
      {todayMood && (
        <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
          Logged — {MOODS.find(m => m.value === todayMood)?.label}
        </p>
      )}
    </div>
  )
}
