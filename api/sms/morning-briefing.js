// /api/sms/morning-briefing — triggered daily at 8am by Vercel Cron (see vercel.json).
// Sends every opted-in user their own personalised to-dos, habit streaks,
// momentum, and weekly focus via SMS.
import { supabaseAdmin, getUsersWithPhoneNumber } from '../_lib/db.js'
import { sendSms, isTwilioConfigured } from '../_lib/twilio.js'
import { buildMorningBriefing } from '../_lib/morningBriefing.js'

export default async function handler(req, res) {
  // Vercel Cron requests are GET; allow POST too for manual testing.
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // If CRON_SECRET is set, require it on the Authorization header (Vercel adds this automatically for cron-triggered requests).
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization || ''
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  if (!isTwilioConfigured()) {
    return res.status(500).json({ error: 'Twilio is not configured' })
  }

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

  return res.status(200).json({ sent: sentCount, checked: users.length })
}
