// Cron job implementations, run by /api/cron?job=<name> (see vercel.json).
// Each job was previously its own serverless function under /api/cron/* and
// /api/sms/morning-briefing — consolidated here to stay within Vercel's
// Hobby-plan 12 serverless function limit. Each export takes no args and
// returns the JSON body the route handler should respond with.
import { format, startOfWeek } from 'date-fns'
import { supabaseAdmin, getUsersWithPhoneNumber } from './db.js'
import { sendSms, isTwilioConfigured } from './twilio.js'
import { sendPushToSubscriptions, isWebPushConfigured } from './webpush.js'
import { buildMorningBriefing } from './morningBriefing.js'
import { VARIABLE_CATS } from './smsRouter.js'

const RETENTION_DAYS = 30
const REFLECTION_MESSAGE = 'How did today go? Take 2 mins to reflect.'
const REMINDER_LEAD_DAYS = 3
const WEEKLY_SCALE = 12 / 52
const WARN_THRESHOLD = 0.8

export async function runMorningBriefing() {
  if (!isTwilioConfigured()) return { status: 500, body: { error: 'Twilio is not configured' } }

  const users = await getUsersWithPhoneNumber({ requireSmsEnabled: true })

  let sentCount = 0
  for (const u of users) {
    try {
      const briefing = await buildMorningBriefing(u.id)
      await sendSms(u.phone_number, briefing)
      await supabaseAdmin.from('ai_log').insert({
        user_id: u.id,
        type: 'sms',
        title: 'Morning briefing',
        response: briefing,
      })
      sentCount++
    } catch (e) {
      console.error(`Morning briefing failed for user ${u.id}:`, e.message)
    }
  }

  return { status: 200, body: { sent: sentCount, checked: users.length } }
}

export async function runCleanupAiLog() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)

  const { data, error } = await supabaseAdmin
    .from('ai_log')
    .update({ dismissed: true })
    .eq('dismissed', false)
    .eq('pinned', false)
    .lt('created_at', cutoff.toISOString())
    .select('id')

  if (error) return { status: 500, body: { error: error.message } }
  return { status: 200, body: { cleared: (data || []).length } }
}

export async function runDailyReflection() {
  const now = new Date()
  const currentHHMM = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
  const today = now.toISOString().slice(0, 10)

  const { data: prefs } = await supabaseAdmin
    .from('user_preferences')
    .select('user_id, reflection_enabled, reflection_time, reflection_method, reflection_last_sent')
    .eq('reflection_enabled', true)

  const due = (prefs || []).filter(p => {
    if (p.reflection_last_sent === today) return false
    return hasPassed(p.reflection_time, currentHHMM)
  })

  let sentCount = 0
  for (const p of due) {
    const deepLink = `${process.env.PUBLIC_APP_URL || ''}/?reflect=1`
    if ((p.reflection_method === 'push' || p.reflection_method === 'both') && isWebPushConfigured()) {
      await sendPushToSubscriptions(supabaseAdmin, p.user_id, {
        title: 'Daily reflection',
        body: REFLECTION_MESSAGE,
        url: deepLink,
      })
    }
    if ((p.reflection_method === 'sms' || p.reflection_method === 'both') && isTwilioConfigured()) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('phone_number').eq('id', p.user_id).maybeSingle()
      if (profile?.phone_number) {
        await sendSms(profile.phone_number, `${REFLECTION_MESSAGE} ${deepLink}`)
      }
    }
    await supabaseAdmin.from('user_preferences').update({ reflection_last_sent: today }).eq('user_id', p.user_id)
    sentCount++
  }

  return { status: 200, body: { checked: (prefs || []).length, sent: sentCount } }
}

function hasPassed(target, current) {
  const toMinutes = hhmm => {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }
  return toMinutes(current) >= toMinutes(target)
}

export async function runDebtReminders() {
  if (!isTwilioConfigured()) return { status: 500, body: { error: 'Twilio is not configured' } }

  const { data: debts } = await supabaseAdmin
    .from('debts')
    .select('id, user_id, name, minimum_payment, due_day, due_reminder_lead_days, last_due_reminder_sent')
    .not('due_day', 'is', null)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  let sentCount = 0
  for (const debt of debts || []) {
    try {
      const leadDays = debt.due_reminder_lead_days ?? REMINDER_LEAD_DAYS
      const dueDate = nextDueDate(today, debt.due_day)
      const dueDateStr = dueDate.toISOString().slice(0, 10)
      const daysUntil = Math.round((dueDate - today) / (1000 * 60 * 60 * 24))

      if (daysUntil !== leadDays) continue
      if (debt.last_due_reminder_sent === dueDateStr) continue // already reminded for this due cycle

      const { data: profile } = await supabaseAdmin.from('profiles').select('phone_number, sms_enabled').eq('id', debt.user_id).maybeSingle()
      if (!profile?.phone_number || !profile?.sms_enabled) continue

      const amountText = debt.minimum_payment ? ` (£${Number(debt.minimum_payment).toFixed(0)})` : ''
      const message = `Your ${debt.name} minimum payment${amountText} is due in ${leadDays} day${leadDays === 1 ? '' : 's'}.`
      await sendSms(profile.phone_number, message)

      await supabaseAdmin.from('debts').update({ last_due_reminder_sent: dueDateStr }).eq('id', debt.id)
      await supabaseAdmin.from('ai_log').insert({
        user_id: debt.user_id,
        type: 'sms',
        title: 'Debt payment reminder',
        response: message,
      })
      sentCount++
    } catch (e) {
      console.error(`Debt reminder failed for debt ${debt.id}:`, e.message)
    }
  }

  return { status: 200, body: { sent: sentCount, checked: (debts || []).length } }
}

function nextDueDate(today, dueDay) {
  const candidate = clampedDate(today.getUTCFullYear(), today.getUTCMonth(), dueDay)
  if (candidate >= today) return candidate
  return clampedDate(today.getUTCFullYear(), today.getUTCMonth() + 1, dueDay)
}

function clampedDate(year, month, day) {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(day, daysInMonth)))
}

export async function runWeeklyBudgetCheck() {
  if (!isTwilioConfigured()) return { status: 500, body: { error: 'Twilio is not configured' } }

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

  return { status: 200, body: { sent: sentCount, checked: users.length } }
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

export const CRON_JOBS = {
  'morning-briefing': runMorningBriefing,
  'cleanup-ai-log': runCleanupAiLog,
  'daily-reflection': runDailyReflection,
  'debt-reminders': runDebtReminders,
  'weekly-budget-check': runWeeklyBudgetCheck,
}
