import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, subDays, eachDayOfInterval, startOfDay } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts'

const MOOD_LABELS = { 1: 'Low', 2: 'Meh', 3: 'Okay', 4: 'Good', 5: 'Great' }
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const chartStyle = {
  backgroundColor: 'transparent',
  border: 'none',
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: '12px' }}>
      <p style={{ color: 'var(--text-3)', marginBottom: '4px', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color || 'var(--text)' }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</p>
      ))}
    </div>
  )
}

export default function InsightsPage() {
  const { user } = useAuth()
  const [moodData, setMoodData] = useState([])
  const [habitData, setHabitData] = useState([])
  const [dayOfWeekData, setDayOfWeekData] = useState([])
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)
    const thirtyAgo = format(subDays(new Date(), 29), 'yyyy-MM-dd')
    const sevenAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd')

    const [moodRes, habitsRes, logsRes] = await Promise.all([
      supabase.from('mood_logs').select('mood_score, log_date').eq('user_id', user.id).gte('log_date', thirtyAgo).order('log_date'),
      supabase.from('habits').select('id, name').eq('user_id', user.id),
      supabase.from('habit_logs').select('habit_id, log_date').eq('user_id', user.id).gte('log_date', sevenAgo),
    ])

    const moods = moodRes.data || []
    const habitsArr = habitsRes.data || []
    const logs7 = logsRes.data || []

    // 30-day mood line
    const days30 = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() })
    const moodMap = {}
    moods.forEach(m => { moodMap[m.log_date] = m.mood_score })
    const moodLine = days30.map(d => {
      const key = format(d, 'yyyy-MM-dd')
      return { date: format(d, 'MMM d'), mood: moodMap[key] ?? null }
    }).filter(d => d.mood !== null)
    setMoodData(moodLine)

    // Average mood by day of week
    const dowMap = {}
    moods.forEach(m => {
      const dow = new Date(m.log_date).getDay()
      if (!dowMap[dow]) dowMap[dow] = []
      dowMap[dow].push(m.mood_score)
    })
    const dowData = DAY_NAMES.map((name, i) => ({
      day: name,
      avg: dowMap[i] ? dowMap[i].reduce((a, b) => a + b, 0) / dowMap[i].length : 0,
    }))
    setDayOfWeekData(dowData)

    // 7-day rolling habit completion
    const days7 = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() })
    const logMap = {}
    logs7.forEach(l => {
      if (!logMap[l.log_date]) logMap[l.log_date] = 0
      logMap[l.log_date]++
    })
    const habitRate = days7.map(d => {
      const key = format(d, 'yyyy-MM-dd')
      const done = logMap[key] || 0
      const total = habitsArr.length || 1
      return { date: format(d, 'EEE d'), rate: Math.round((done / total) * 100) }
    })
    setHabitData(habitRate)
    setHabits(habitsArr)
    setLoading(false)
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>Loading insights…</div>

  return (
    <div>
      <div className="page-header">
        <h1>Insights</h1>
        <p>Patterns from the last 30 days</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* 30-day mood trend */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="mb-3">30-day mood trend</h3>
          {moodData.length < 2 ? (
            <p className="text-dim" style={{ padding: '20px', textAlign: 'center' }}>Log your mood daily to see trends appear here.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={moodData} style={chartStyle}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="mood" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3, strokeWidth: 0 }} name="Mood" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Average mood by day of week */}
        <div className="card">
          <h3 className="mb-3">Mood by day of week</h3>
          {dayOfWeekData.every(d => d.avg === 0) ? (
            <p className="text-dim" style={{ padding: '20px', textAlign: 'center' }}>Not enough data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dayOfWeekData} style={chartStyle}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avg" name="Avg mood" radius={[4, 4, 0, 0]}>
                  {dayOfWeekData.map((entry, i) => (
                    <Cell key={i} fill={entry.avg >= 4 ? 'var(--success)' : entry.avg >= 3 ? 'var(--accent)' : 'var(--warning)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 7-day habit completion rate */}
        <div className="card">
          <h3 className="mb-3">7-day habit completion</h3>
          {habitData.length === 0 ? (
            <p className="text-dim" style={{ padding: '20px', textAlign: 'center' }}>No habits tracked yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={habitData} style={chartStyle}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="rate" name="Completion %" fill="var(--cobalt)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
