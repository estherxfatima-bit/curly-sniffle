// /api/cron/debt-reminders — runs daily (see vercel.json). For every debt
// with a `due_day` set, texts the owner 3 days before their minimum payment
// is due. Dedupes via `last_due_reminder_sent` so each due cycle only sends once.
import { supabaseAdmin } from '../_lib/db.js'
import { sendSms, isTwilioConfigured } from '../_lib/twilio.js'

const REMINDER_LEAD_DAYS = 3

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

  const { data: debts } = await supabaseAdmin
    .from('debts')
    .select('id, user_id, name, minimum_payment, due_day, last_due_reminder_sent')
    .not('due_day', 'is', null)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  let sentCount = 0
  for (const debt of debts || []) {
    try {
      const dueDate = nextDueDate(today, debt.due_day)
      const dueDateStr = dueDate.toISOString().slice(0, 10)
      const daysUntil = Math.round((dueDate - today) / (1000 * 60 * 60 * 24))

      if (daysUntil !== REMINDER_LEAD_DAYS) continue
      if (debt.last_due_reminder_sent === dueDateStr) continue // already reminded for this due cycle

      const { data: profile } = await supabaseAdmin.from('profiles').select('phone_number, sms_enabled').eq('id', debt.user_id).maybeSingle()
      if (!profile?.phone_number || !profile?.sms_enabled) continue

      const amountText = debt.minimum_payment ? ` (£${Number(debt.minimum_payment).toFixed(0)})` : ''
      const message = `Your ${debt.name} minimum payment${amountText} is due in ${REMINDER_LEAD_DAYS} days.`
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

  return res.status(200).json({ sent: sentCount, checked: (debts || []).length })
}

// Returns the next occurrence of `dueDay` (1-31, clamped to the month's
// actual length) on/after `today`.
function nextDueDate(today, dueDay) {
  const candidate = clampedDate(today.getUTCFullYear(), today.getUTCMonth(), dueDay)
  if (candidate >= today) return candidate
  return clampedDate(today.getUTCFullYear(), today.getUTCMonth() + 1, dueDay)
}

function clampedDate(year, month, day) {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(day, daysInMonth)))
}
