// /api/sms/morning-briefing — triggered daily at 8am by Vercel Cron (see vercel.json).
// Sends today's to-dos, habit streaks, momentum, and weekly focus via SMS.
import { supabaseAdmin, getPrimaryUserId } from '../_lib/db.js'
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

  const userId = await getPrimaryUserId()
  const briefing = await buildMorningBriefing(userId)

  await sendSms(process.env.MY_PHONE_NUMBER, briefing)

  await supabaseAdmin.from('ai_log').insert({
    user_id: userId,
    type: 'sms',
    title: 'Morning briefing',
    response: briefing,
  })

  return res.status(200).json({ sent: true })
}
