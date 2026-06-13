// /api/sms/status — SMS integration status for the Settings page
// GET, Header: Authorization: Bearer <supabase access token>
import { supabaseAdmin } from '../_lib/db.js'
import { isTwilioConfigured } from '../_lib/twilio.js'
import { HELP_MESSAGE } from '../_lib/smsRouter.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing Authorization header' })

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })

  return res.status(200).json({
    configured: isTwilioConfigured(),
    smsNumber: process.env.TWILIO_PHONE_NUMBER || null,
    examples: [
      "spent £10 on food",
      "£45 groceries",
      "done 1 2",
      "done all",
      "add buy oat milk",
      "what's my focus today?",
      HELP_MESSAGE,
    ],
  })
}
