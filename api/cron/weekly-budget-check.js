// /api/cron/weekly-budget-check — runs once weekly (Sunday evening, see
// vercel.json) and texts each opted-in user how their spending this week
// compares to their monthly budget scaled down to a weekly figure.
import { format, startOfWeek } from 'date-fns'
import { supabaseAdmin, getUsersWithPhoneNumber } from '../_lib/db.js'
import { sendSms, isTwilioConfigured } from '../_lib/twilio.js'
import { VARIABLE_CATS } from '../_lib/smsRouter.js'

const WEEKLY_SCALE = 12 / 52
const WARN_THRESHOLD = 0.8

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization || ''
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  if (!isTwilioConfigured()) {
    return res.status(500).json({ error: 'Twilio is not configured' })
  }

  const now = new Date()
  const monthYear = format(now, 'yyyy-MM')
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const today = format(now, 'yyyy-MM-dd')

  const users = await getUsersWithPhoneNumber({ requireSmsEnabled: true })

  let sentCount = 0
  for (const u of users) {
    try {
      const message = await buildWeeklyBudgetMessage(u.id, { monthYear, weekStart, today })
      if (!message) continue
      await sendSms(u.phone_number, message)
      await supabaseAdmin.from('ai_log').insert({
        user_id: u.id,
        type: 'sms',
        title: 'Weekly budget check',
        response: message,
      })
      sentCount++
    } catch (e) {
      console.error(`Weekly budget check failed for user ${u.id}:`, e.message)
    }
  }

  return res.status(200).json({ sent: sentCount, checked: users.length })
}

async function buildWeeklyBudgetMessage(userId, { monthYear, weekStart, today }) {
  const [budgetsRes, expensesRes] = await Promise.all([
    supabaseAdmin.from('budgets').select('category, amount').eq('user_id', userId).eq('month_year', monthYear),
    supabaseAdmin.from('variable_expenses').select('amount, category').eq('user_id', userId).gte('date', weekStart).lte('date', today),
  ])

  const budgets = budgetsRes.data || []
  const overallBudget = budgets.find(b => b.category === null)?.amount || 0
  if (!overallBudget) return null // nothing to compare against — skip this user

  const expenses = expensesRes.data || []
  const weeklyOverallBudget = overallBudget * WEEKLY_SCALE
  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0)

  const flagged = []
  for (const cat of VARIABLE_CATS) {
    const catBudget = budgets.find(b => b.category === cat)?.amount || 0
    if (!catBudget) continue
    const weeklyCatBudget = catBudget * WEEKLY_SCALE
    const catSpent = expenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0)
    if (weeklyCatBudget > 0 && catSpent / weeklyCatBudget >= WARN_THRESHOLD) {
      flagged.push(`${cat}: £${catSpent.toFixed(0)}/£${weeklyCatBudget.toFixed(0)}`)
    }
  }

  const pct = weeklyOverallBudget > 0 ? Math.round((totalSpent / weeklyOverallBudget) * 100) : 0
  let line = `Weekly budget check: £${totalSpent.toFixed(0)} of £${weeklyOverallBudget.toFixed(0)} spent (${pct}%).`
  if (flagged.length) line += ` Near/over budget: ${flagged.join(', ')}.`
  else if (pct >= WARN_THRESHOLD * 100) line += ' Heads up — close to your weekly limit.'
  return line
}
