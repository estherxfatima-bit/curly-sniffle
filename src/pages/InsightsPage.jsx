import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12, boxShadow: 'var(--shadow-card)' }}>
      <p style={{ color: 'var(--text-3)', marginBottom: 4, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.color || 'var(--text)' }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</p>)}
    </div>
  )
}

function InsightsDecoration() {
  return (
    <svg width="110" height="70" viewBox="0 0 110 70" fill="none">
      {[20,35,22,48,30,42,55].map((h, i) => (
        <rect key={i} x={8 + i*14} y={58-h} width={10} height={h} rx={3} fill="currentColor" opacity={0.08 + i * 0.03}/>
      ))}
    </svg>
  )
}

export default function InsightsPage() {
  const { user } = useAuth()
  const [moodData, setMoodData] = useState([])
  const [habitData, setHabitData] = useState([])
  const [dayOfWeekData, setDayOfWeekData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) loadAll() }, [user])

  async function loadAll() {
    setLoading(true)
    const thirtyAgo = format(subDays(new Date(), 29), 'yyyy-MM-dd')
    const sevenAgo  = format(subDays(new Date(), 6), 'yyyy-MM-dd')

    const [moodRes, habitsRes, logsRes] = await Promise.all([
      supabase.from('mood_logs').select('mood_score, log_date').eq('user_id', user.id).gte('log_date', thirtyAgo).order('log_date'),
      supabase.from('habits').select('id, name').eq('user_id', user.id),
      supabase.from('habit_logs').select('habit_id, log_date').eq('user_id', user.id).gte('log_date', sevenAgo),
    ])

    const moods   = moodRes.data  || []
    const habitsArr = habitsRes.data || []
    const logs7   = logsRes.data  || []

    const days30 = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() })
    const moodMap = {}
    moods.forEach(m => { moodMap[m.log_date] = m.mood_score })
    setMoodData(days30.map(d => ({ date: format(d,'MMM d'), mood: moodMap[format(d,'yyyy-MM-dd')] ?? null })).filter(d => d.mood !== null))

    const dowMap = {}
    moods.forEach(m => { const dow = new Date(m.log_date).getDay(); if (!dowMap[dow]) dowMap[dow] = []; dowMap[dow].push(m.mood_score) })
    setDayOfWeekData(DAY_NAMES.map((name,i) => ({ day: name, avg: dowMap[i] ? dowMap[i].reduce((a,b)=>a+b,0)/dowMap[i].length : 0 })))

    const days7 = eachDayOfInterval({ start: subDays(new Date(),6), end: new Date() })
    const logMap = {}
    logs7.forEach(l => { if (!logMap[l.log_date]) logMap[l.log_date]=0; logMap[l.log_date]++ })
    setHabitData(days7.map(d => { const key = format(d,'yyyy-MM-dd'); return { date: format(d,'EEE d'), rate: habitsArr.length ? Math.round((logMap[key]||0)/habitsArr.length*100) : 0 } }))

    setLoading(false)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading insights…</div>

  return (
    <div>
      <div className="page-header header-career mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>Insights</h1>
            <p>Patterns from the last 30 days</p>
          </div>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--career)' }}><InsightsDecoration /></div>
      </div>

      <div className="grid-2">
        {/* 30-day mood line */}
        <div className="card card-personal" style={{ gridColumn: '1 / -1' }}>
          <h3 className="mb-4">30-day mood trend</h3>
          {moodData.length < 2 ? (
            <p style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontStyle: 'italic' }}>Log your mood daily to see trends appear here.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={moodData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[1,5]} ticks={[1,2,3,4,5]} tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="mood" stroke="var(--personal)" strokeWidth={2.5} dot={{ fill: 'var(--personal)', r: 3, strokeWidth: 0 }} name="Mood" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Mood by day of week */}
        <div className="card card-personal">
          <h3 className="mb-4">Mood by day of week</h3>
          {dayOfWeekData.every(d => d.avg === 0) ? (
            <p style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontStyle: 'italic' }}>Not enough data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dayOfWeekData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0,5]} ticks={[1,2,3,4,5]} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avg" name="Avg mood" radius={[5,5,0,0]}>
                  {dayOfWeekData.map((entry, i) => <Cell key={i} fill={entry.avg >= 4 ? 'var(--finance)' : entry.avg >= 3 ? 'var(--personal)' : 'var(--warning)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 7-day habit completion */}
        <div className="card card-career">
          <h3 className="mb-4">7-day habit completion</h3>
          {habitData.length === 0 ? (
            <p style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontStyle: 'italic' }}>No habits tracked yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={habitData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0,100]} tickFormatter={v => `${v}%`} tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="rate" name="Completion %" fill="var(--career)" radius={[5,5,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
