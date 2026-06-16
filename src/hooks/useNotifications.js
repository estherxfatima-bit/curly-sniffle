import { useState, useEffect, useRef } from 'react'
import { format, startOfWeek, addDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { simulateHabit } from '../lib/habitUtils'
import { useAuth } from './useAuth'

// Always compare against UK clock so notifications fire at the right local time
// regardless of where the user's device is set.
function ukHour() {
  return parseInt(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/London' }).format(new Date()),
    10,
  )
}

async function generateNudgeNotifications(user) {
  const { data: comments } = await supabase
    .from('comments')
    .select('id, content, created_at, user_id, task_id')
    .eq('partner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  if (!comments?.length) return

  // Collect unique sender IDs and task IDs to batch-fetch
  const senderIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))]
  const taskIds   = [...new Set(comments.map(c => c.task_id).filter(Boolean))]

  const [profilesRes, tasksRes] = await Promise.all([
    senderIds.length
      ? supabase.from('profiles').select('id, display_name, email').in('id', senderIds)
      : { data: [] },
    taskIds.length
      ? supabase.from('weekly_tasks').select('id, specific_task').in('id', taskIds)
      : { data: [] },
  ])

  const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id, p]))
  const taskMap    = Object.fromEntries((tasksRes.data    || []).map(t => [t.id, t]))

  const rows = comments.map(c => {
    const profile  = profileMap[c.user_id]
    const senderName = profile?.display_name || profile?.email?.split('@')[0] || 'Your partner'
    const task = c.task_id ? taskMap[c.task_id] : null
    const context = task
      ? `"${task.specific_task}"`
      : c.content?.toLowerCase().includes('weekly') ? 'your weekly plan'
      : c.content?.toLowerCase().includes('todo') || c.content?.toLowerCase().includes('to-do') ? 'a to-do'
      : 'your progress'
    return {
      user_id: user.id,
      type: 'nudge',
      title: `${senderName} nudged you on ${context}`,
      body: c.content,
      link: '/weekly',
      source_id: c.id,
      created_at: c.created_at,
    }
  })
  await supabase.from('notifications').upsert(rows, { onConflict: 'user_id,type,source_id', ignoreDuplicates: true })
}

async function generateMorningReminder(user) {
  const h = ukHour()
  if (h < 6 || h >= 12) return
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  await supabase.from('notifications').upsert([{
    user_id: user.id,
    type: 'morning_reminder',
    title: 'Good morning — ready to plan your day?',
    body: 'Check your daily to-dos and set your priorities for today.',
    link: '/',
    source_id: `${todayStr}:morning`,
  }], { onConflict: 'user_id,type,source_id', ignoreDuplicates: true })
}

async function generateReflectionReminder(user) {
  const h = ukHour()
  if (h < 17) return
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const { data } = await supabase.from('daily_reflections').select('id').eq('user_id', user.id).eq('date', todayStr).maybeSingle()
  if (data) return
  await supabase.from('notifications').upsert([{
    user_id: user.id,
    type: 'reflection',
    title: 'Time for your daily reflection',
    body: "Rate your day, jot what went well, and set tomorrow's priorities.",
    link: '/?reflect=1',
    source_id: `${todayStr}:reflection`,
  }], { onConflict: 'user_id,type,source_id', ignoreDuplicates: true })
}

async function generateReviewReminder(user) {
  const now = new Date()
  if (now.getDay() !== 0) return // Sundays only
  const h = ukHour()
  if (h < 21) return // only after 9 pm UK time
  const weekStartStr = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  // Check if they have any weekly tasks this week — if none, that counts as not planned
  const [reviewRes, taskRes] = await Promise.all([
    supabase.from('weekly_reviews').select('id').eq('user_id', user.id).eq('week_start', weekStartStr).maybeSingle(),
    supabase.from('weekly_tasks').select('id').eq('user_id', user.id).eq('week_start', weekStartStr).limit(1),
  ])
  const hasReview = !!reviewRes.data
  const hasTasks = !!(taskRes.data?.length)
  if (hasReview && hasTasks) return

  await supabase.from('notifications').upsert([{
    user_id: user.id,
    type: 'review_reminder',
    title: "Weekly plan not done — it's 9 pm Sunday",
    body: hasTasks
      ? "You've got tasks but haven't done your weekly review yet."
      : "You haven't added any tasks to this week's plan.",
    link: '/weekly',
    source_id: `${weekStartStr}:sunday21`,
  }], { onConflict: 'user_id,type,source_id', ignoreDuplicates: true })
}

async function generatePlanTomorrowReminder(user) {
  const h = ukHour()
  if (h < 18) return // only from 6 pm onwards
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const { data } = await supabase
    .from('daily_todos')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', tomorrowStr)
    .eq('archived', false)
    .limit(3)
  if ((data?.length ?? 0) >= 2) return
  await supabase.from('notifications').upsert([{
    user_id: user.id,
    type: 'plan_tomorrow',
    title: 'Plan your tomorrow',
    body: (data?.length ?? 0) === 0
      ? "You have nothing planned for tomorrow yet."
      : "You only have 1 task planned for tomorrow — add a couple more.",
    link: '/',
    source_id: `${tomorrowStr}:plan`,
  }], { onConflict: 'user_id,type,source_id', ignoreDuplicates: true })
}

async function generatePartnerNudgePrompts(user) {
  // If a partner has no weekly tasks and no daily todos, prompt the user to nudge them.
  const { data: partnerRows } = await supabase
    .from('accountability_partners')
    .select('partner_id')
    .eq('user_id', user.id)
    .eq('status', 'accepted')
  if (!partnerRows?.length) return

  const now = new Date()
  const weekStartStr = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const todayStr = format(now, 'yyyy-MM-dd')

  const rows = []
  for (const row of partnerRows) {
    const pid = row.partner_id
    const [taskRes, todoRes, profileRes] = await Promise.all([
      supabase.from('weekly_tasks').select('id').eq('user_id', pid).eq('week_start', weekStartStr).limit(1),
      supabase.from('daily_todos').select('id').eq('user_id', pid).eq('date', todayStr).eq('archived', false).limit(1),
      supabase.from('profiles').select('display_name, email').eq('id', pid).maybeSingle(),
    ])
    const hasWeekTasks = !!(taskRes.data?.length)
    const hasTodayTodos = !!(todoRes.data?.length)
    if (hasWeekTasks && hasTodayTodos) continue

    const name = profileRes.data?.display_name || profileRes.data?.email?.split('@')[0] || 'Your partner'
    const missing = !hasWeekTasks && !hasTodayTodos
      ? 'no weekly plan or daily to-dos'
      : !hasWeekTasks
        ? 'no weekly plan yet'
        : 'nothing planned for today'

    rows.push({
      user_id: user.id,
      type: 'partner_nudge_prompt',
      title: `${name} has ${missing}`,
      body: 'Send them a nudge to get going.',
      link: `/partners/${pid}/compare`,
      source_id: `${pid}:${weekStartStr}:empty`,
    })
  }
  if (rows.length) {
    await supabase.from('notifications').upsert(rows, { onConflict: 'user_id,type,source_id', ignoreDuplicates: true })
  }
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
          generateMorningReminder(user),
          generateReflectionReminder(user),
          generateReviewReminder(user),
          generatePlanTomorrowReminder(user),
          generatePartnerNudgePrompts(user),
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
