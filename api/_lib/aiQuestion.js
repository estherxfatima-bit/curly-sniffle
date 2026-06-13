// Answers free-form SMS questions via Claude, using the same context as the
// AI planning assistant — kept short for SMS.
import { format, startOfWeek, subDays } from 'date-fns'
import { supabaseAdmin } from './db.js'
import { getTodaysTodos } from './smsRouter.js'

function getQuarter(date) {
  const month = date.getMonth()
  if (month < 3) return 'Q1'
  if (month < 6) return 'Q2'
  if (month < 9) return 'Q3'
  return 'Q4'
}

async function callClaude(prompt, system, maxTokens = 300) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.VITE_CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
  const data = await res.json()
  return data.content[0].text
}

async function buildContext(userId) {
  const now = new Date()
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const monthStart = `${format(now, 'yyyy-MM')}-01`
  const quarter = getQuarter(now)
  const year = now.getFullYear()
  const days = Array.from({ length: 14 }, (_, i) => format(subDays(now, 13 - i), 'yyyy-MM-dd'))

  const [goalsRes, tasksRes, habitsRes, logsRes, moodRes, varRes, budgetRes, todos] = await Promise.all([
    supabaseAdmin.from('goals').select('category, primary_goal').eq('user_id', userId).eq('quarter', quarter).eq('year', year),
    supabaseAdmin.from('weekly_tasks').select('area, specific_task, complete, carried_forward').eq('user_id', userId).eq('week_start', weekStart),
    supabaseAdmin.from('habits').select('id, name').eq('user_id', userId),
    supabaseAdmin.from('habit_logs').select('habit_id, log_date').eq('user_id', userId).gte('log_date', days[0]),
    supabaseAdmin.from('mood_logs').select('mood_score').eq('user_id', userId).gte('log_date', weekStart),
    supabaseAdmin.from('variable_expenses').select('amount, category').eq('user_id', userId).gte('date', monthStart),
    supabaseAdmin.from('budgets').select('amount').eq('user_id', userId).eq('month_year', format(now, 'yyyy-MM')).is('category', null).maybeSingle(),
    getTodaysTodos(userId),
  ])

  const moods = moodRes.data || []
  const moodAvg = moods.length ? moods.reduce((s, m) => s + m.mood_score, 0) / moods.length : null

  const habits = habitsRes.data || []
  const logsByHabit = {}
  habits.forEach(h => { logsByHabit[h.id] = new Set() })
  ;(logsRes.data || []).forEach(l => { logsByHabit[l.habit_id]?.add(l.log_date) })
  const habitStreaks = habits.map(h => {
    let streak = 0
    for (let i = days.length - 1; i >= 0; i--) {
      if (logsByHabit[h.id]?.has(days[i])) streak++
      else break
    }
    return { name: h.name, streak }
  })

  const tasks = tasksRes.data || []
  const totalSpent = (varRes.data || []).reduce((s, v) => s + Number(v.amount), 0)
  const budget = budgetRes.data?.amount || 0

  return {
    goals: goalsRes.data || [],
    tasks,
    habitStreaks,
    moodAvg,
    todos,
    totalSpent,
    budget,
    quarter,
    year,
  }
}

export async function answerSmsQuestion(userId, question) {
  const ctx = await buildContext(userId)

  const system = `You are a direct, grounded personal assistant replying over SMS. Be specific and concise — your reply must fit in a single SMS, ideally under 300 characters. No markdown, no bullet points, plain text only. Never say "great job" or use motivational-poster language.`

  const prompt = `Context:

${ctx.quarter} ${ctx.year} GOALS:
${ctx.goals.map(g => `- [${g.category}] ${g.primary_goal}`).join('\n') || 'None set'}

THIS WEEK'S TASKS (${ctx.tasks.filter(t => !t.complete).length} incomplete, ${ctx.tasks.filter(t => t.complete).length} done):
${ctx.tasks.slice(0, 20).map(t => `- [${t.area}] ${t.specific_task} — ${t.complete ? 'done' : 'incomplete'}`).join('\n') || 'None'}

HABIT STREAKS:
${ctx.habitStreaks.map(h => `- ${h.name}: ${h.streak} day${h.streak === 1 ? '' : 's'}`).join('\n') || 'None'}

MOOD AVERAGE THIS WEEK: ${ctx.moodAvg ? `${ctx.moodAvg.toFixed(1)}/5` : 'Not logged'}

TODAY'S TO-DOS (${ctx.todos.filter(t => !t.complete).length} remaining of ${ctx.todos.length}):
${ctx.todos.slice(0, 8).map(t => `- ${t.text} [${t.category}]${t.complete ? ' done' : ''}`).join('\n') || 'None'}

FINANCE THIS MONTH: £${ctx.totalSpent.toFixed(0)} spent${ctx.budget > 0 ? ` of £${ctx.budget.toFixed(0)} budget` : ''}

QUESTION: ${question}

Reply directly, under 300 characters where possible.`

  const reply = await callClaude(prompt, system, 300)
  return reply.trim()
}
