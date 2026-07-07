// /api/notify — insert an in-app notification + optional push notification for a user.
// Called by the frontend after partner task assignment (or any future server-originated event).
// POST { to_user_id, type, title, body, link, source_id }
// Header: Authorization: Bearer <supabase access token>
import { createClient } from '@supabase/supabase-js'
import { sendPushToSubscriptions } from './_lib/webpush.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing Authorization header' })

  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })

  const { to_user_id, type, title, body, link, source_id } = req.body || {}
  if (!to_user_id || !type || !title) {
    return res.status(400).json({ error: 'to_user_id, type, and title are required' })
  }

  // Insert in-app notification (upsert so duplicate source_ids are silently ignored)
  const row = {
    user_id: to_user_id,
    type,
    title,
    body: body || null,
    link: link || null,
    source_id: source_id || `${type}:${Date.now()}`,
  }
  const { error: insertErr } = await supabase
    .from('notifications')
    .upsert([row], { onConflict: 'user_id,type,source_id', ignoreDuplicates: true })

  if (insertErr) console.error('[api/notify] insert error', insertErr)

  // Best-effort push notification
  const pushResult = await sendPushToSubscriptions(supabase, to_user_id, {
    title,
    body: body || '',
    url: link || '/',
  })

  return res.status(200).json({ ok: true, pushSent: pushResult.sent })
}
