// /api/cron?job=<name> — single entry point for all scheduled jobs (see
// vercel.json). Consolidated from separate /api/cron/* and
// /api/sms/morning-briefing functions to stay within Vercel's Hobby-plan
// 12-serverless-function limit; job logic lives in api/_lib/cronJobs.js.
import { CRON_JOBS } from './_lib/cronJobs.js'

export default async function handler(req, res) {
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

  const job = req.query.job
  const run = CRON_JOBS[job]
  if (!run) return res.status(400).json({ error: `Unknown job "${job}"` })

  const { status, body } = await run()
  return res.status(status).json(body)
}
