// /api/cron/cleanup-ai-log — runs nightly via Vercel Cron (see vercel.json).
// Dismisses ai_log entries older than 30 days so the log doesn't grow forever.
// Pinned entries are exempt — pinning is how users say "keep this one".
import { supabaseAdmin } from '../_lib/db.js'

const RETENTION_DAYS = 30

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

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)

  const { data, error } = await supabaseAdmin
    .from('ai_log')
    .update({ dismissed: true })
    .eq('dismissed', false)
    .eq('pinned', false)
    .lt('created_at', cutoff.toISOString())
    .select('id')

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ cleared: (data || []).length })
}
