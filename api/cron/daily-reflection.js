// /api/cron/daily-reflection — runs once nightly via Vercel Cron (see vercel.json;
// Hobby plan only allows once-per-day cron schedules). For each user with the
// daily reflection nudge enabled whose reflection_time has passed and who hasn't
// been sent today, sends a push notification and/or SMS.
import { supabaseAdmin } from '../_lib/db.js'
import { sendSms, isTwilioConfigured } from '../_lib/twilio.js'
import { sendPushToSubscriptions, isWebPushConfigured } from '../_lib/webpush.js'

const REFLECTION_MESSAGE = 'How did today go? Take 2 mins to reflect.'

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

  return res.status(200).json({ checked: (prefs || []).length, sent: sentCount })
}

// Returns true if `target` (HH:MM) is at-or-before `current` (HH:MM).
function hasPassed(target, current) {
  const toMinutes = hhmm => {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }
  return toMinutes(current) >= toMinutes(target)
}
