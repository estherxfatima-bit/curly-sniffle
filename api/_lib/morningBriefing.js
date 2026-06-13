// Builds the 8am daily SMS briefing — today's to-dos, habit streaks,
// a momentum one-liner, and this week's focus area.
import { format, startOfWeek, subDays } from 'date-fns'
import { supabaseAdmin } from './db.js'
import { getTodaysTodos } from './smsRouter.js'

export async function buildMorningBriefing(userId) {
  const now = new Date()
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const days = Array.from({ length: 14 }, (_, i) => format(subDays(now, 13 - i), 'yyyy-MM-dd'))

  const [todos, habitsRes, logsRes, tasksRes] = await Promise.all([
    getTodaysTodos(userId),
    supabaseAdmin.from('habits').select('id, name, emoji').eq('user_id', userId),
    supabaseAdmin.from('habit_logs').select('habit_id, log_date').eq('user_id', userId).gte('log_date', days[0]),
    supabaseAdmin.from('weekly_tasks').select('area, complete').eq('user_id', userId).eq('week_start', weekStart),
  ])

  // To-dos, numbered as the morning briefing — "done N" replies refer to these numbers.
  const todosText = todos.length
    ? todos.map((t, i) => `${i + 1}. ${t.text}${t.complete ? ' ✓' : ''}`).join('\n')
    : 'Nothing on your list yet.'

  // Habit streaks
  const habits = habitsRes.data || []
  const logsByHabit = {}
  habits.forEach(h => { logsByHabit[h.id] = new Set() })
  ;(logsRes.data || []).forEach(l => { logsByHabit[l.habit_id]?.add(l.log_date) })
  const streaks = habits.map(h => {
    let streak = 0
    for (let i = days.length - 1; i >= 0; i--) {
      if (logsByHabit[h.id]?.has(days[i])) streak++
      else break
    }
    return { name: h.name, emoji: h.emoji, streak }
  })
  const streaksText = streaks.length
    ? streaks.map(h => `${h.emoji || ''} ${h.name} ${h.streak}d`).join(', ')
    : 'No habits tracked'

  // This week's focus — area with the most incomplete tasks
  const tasks = tasksRes.data || []
  const incomplete = tasks.filter(t => !t.complete)
  const areaCounts = {}
  incomplete.forEach(t => { areaCounts[t.area] = (areaCounts[t.area] || 0) + 1 })
  const topArea = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0]
  const focusText = topArea ? `${topArea[0]} (${topArea[1]} left)` : 'All caught up this week!'

  // Momentum one-liner
  let momentum
  const bestStreak = streaks.slice().sort((a, b) => b.streak - a.streak)[0]
  if (bestStreak && bestStreak.streak >= 3) {
    momentum = `${bestStreak.emoji || ''} ${bestStreak.name} streak at ${bestStreak.streak} days — keep it going.`
  } else if (incomplete.length === 0 && tasks.length > 0) {
    momentum = "Clean slate on this week's tasks."
  } else if (incomplete.length > 0) {
    momentum = `${incomplete.length} task${incomplete.length === 1 ? '' : 's'} left this week.`
  } else {
    momentum = 'New week — set some tasks when you get a chance.'
  }

  return [
    `Good morning ☀️ ${format(now, 'EEEE d MMM')}`,
    '',
    `Today's to-dos:`,
    todosText,
    '',
    `Streaks: ${streaksText}`,
    momentum,
    `Focus: ${focusText}`,
  ].join('\n')
}
