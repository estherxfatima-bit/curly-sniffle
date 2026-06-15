import { useState, useEffect, useRef } from 'react'
import { format, startOfWeek } from 'date-fns'
import { supabase } from '../lib/supabase'
import { simulateHabit } from '../lib/habitUtils'
import { useAuth } from './useAuth'

async function generateNudgeNotifications(user) {
  const { data: comments } = await supabase
    .from('comments')
    .select('id, content, created_at')
    .eq('partner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  if (!comments?.length) return

  const rows = comments.map(c => ({
    user_id: user.id,
    type: 'nudge',
    title: 'New nudge from your partner',
    body: c.content,
    link: '/weekly',
    source_id: c.id,
    created_at: c.created_at,
  }))
  await supabase.from('notifications').upsert(rows, { onConflict: 'user_id,type,source_id', ignoreDuplicates: true })
}

async function generateReviewReminder(user) {
  const today = new Date()
  if (today.getDay() !== 0) return // Only nudge for a review on Sundays
  const weekStartStr = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const { data: review } = await supabase.from('weekly_reviews').select('id').eq('user_id', user.id).eq('week_start', weekStartStr).maybeSingle()
  if (review) return

  await supabase.from('notifications').upsert([{
    user_id: user.id,
    type: 'review_reminder',
    title: 'Weekly review due',
    body: "Take a few minutes to reflect on this week's progress.",
    link: '/weekly?review=1',
    source_id: weekStartStr,
  }], { onConflict: 'user_id,type,source_id', ignoreDuplicates: true })
}

async function generateStreakWarnings(user) {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  const [habitsRes, logsRes] = await Promise.all([
    supabase.from('habits').select('*').eq('user_id', user.id),
    supabase.from('habit_logs').select('habit_id, log_date').eq('user_id', user.id),
  ])
  const habits = habitsRes.data || []
  const logs = logsRes.data || []
  if (!habits.length) return

  const rows = []
  for (const h of habits) {
    const logSet = new Set(logs.filter(l => l.habit_id === h.id).map(l => l.log_date))
    const sim = simulateHabit(h, logSet, today)
    if (sim.pending && sim.streak >= 3) {
      rows.push({
        user_id: user.id,
        type: 'streak_warning',
        title: `${h.emoji ? h.emoji + ' ' : ''}${h.name} streak at risk`,
        body: `You have a ${sim.streak}-day streak — log it today to keep it going.`,
        link: '/habits',
        source_id: `${h.id}:${todayStr}`,
      })
    }
  }
  if (rows.length) {
    await supabase.from('notifications').upsert(rows, { onConflict: 'user_id,type,source_id', ignoreDuplicates: true })
  }
}

export function useNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const generatedRef = useRef(false)

  async function load(u) {
    setLoading(true)
    const { data } = await supabase.from('notifications').select('*').eq('user_id', u.id).order('created_at', { ascending: false }).limit(30)
    setNotifications(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    ;(async () => {
      if (!generatedRef.current) {
        generatedRef.current = true
        await Promise.all([
          generateNudgeNotifications(user),
          generateReviewReminder(user),
          generateStreakWarnings(user),
        ])
      }
      await load(user)
    })()
  }, [user])

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return { notifications, unreadCount, loading, markRead, markAllRead }
}
