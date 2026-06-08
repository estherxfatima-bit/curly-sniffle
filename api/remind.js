// /api/remind — Make.com webhook endpoint
// POST with { user_id: "...", secret: "..." } or set a REMIND_SECRET env var
// Returns today's habits and incomplete tasks as a formatted summary for SMS/Pushover

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role needed for server-side access
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { user_id, secret } = req.body || {}

  // Basic secret guard — set REMIND_SECRET in Vercel env vars
  if (process.env.REMIND_SECRET && secret !== process.env.REMIND_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' })
  }

  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' })
  }

  const today = new Date().toISOString().split('T')[0]
  const weekStart = getMonday(new Date()).toISOString().split('T')[0]

  const [habitsRes, logsRes, tasksRes] = await Promise.all([
    supabase.from('habits').select('id, name, emoji').eq('user_id', user_id),
    supabase.from('habit_logs').select('habit_id').eq('user_id', user_id).eq('log_date', today),
    supabase.from('weekly_tasks').select('specific_task, area, complete').eq('user_id', user_id).eq('week_start', weekStart).eq('complete', false),
  ])

  const habits = habitsRes.data || []
  const loggedIds = new Set((logsRes.data || []).map(l => l.habit_id))
  const pendingHabits = habits.filter(h => !loggedIds.has(h.id))
  const incompleteTasks = tasksRes.data || []

  const lines = [
    `📋 Life OS reminder — ${today}`,
    '',
  ]

  if (pendingHabits.length > 0) {
    lines.push(`Habits still to log today (${pendingHabits.length}):`)
    pendingHabits.forEach(h => lines.push(`  ${h.emoji} ${h.name}`))
    lines.push('')
  } else {
    lines.push('✅ All habits logged today!')
    lines.push('')
  }

  if (incompleteTasks.length > 0) {
    lines.push(`Incomplete tasks this week (${incompleteTasks.length}):`)
    incompleteTasks.slice(0, 8).forEach(t => lines.push(`  • [${t.area}] ${t.specific_task}`))
    if (incompleteTasks.length > 8) lines.push(`  …and ${incompleteTasks.length - 8} more`)
  } else {
    lines.push('✅ No incomplete tasks this week!')
  }

  return res.status(200).json({
    summary: lines.join('\n'),
    pendingHabitsCount: pendingHabits.length,
    incompleteTasksCount: incompleteTasks.length,
    pendingHabits,
    incompleteTasks,
  })
}

function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}
