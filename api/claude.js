// /api/claude — authenticated proxy to the Anthropic Messages API, plus a
// status check. Consolidated from /api/claude/messages and /api/claude/status
// to stay within Vercel's Hobby-plan 12-serverless-function limit.
// Keeps CLAUDE_API_KEY server-only; the frontend never talks to api.anthropic.com directly.
// GET                                                  — { configured: boolean }
// POST { model, max_tokens, system, messages }          — forwarded as-is to Anthropic
// Header: Authorization: Bearer <supabase access token>
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing Authorization header' })

  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid token' })

  if (req.method === 'GET') {
    return res.status(200).json({ configured: !!process.env.CLAUDE_API_KEY })
  }

  if (!process.env.CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY is not configured on the server' })
  }

  const { model, max_tokens, system, messages } = req.body || {}
  if (!model || !max_tokens || !messages) {
    return res.status(400).json({ error: 'model, max_tokens, and messages are required' })
  }

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens, system, messages }),
  })

  const data = await anthropicRes.json()
  if (!anthropicRes.ok) {
    console.error('[api/claude] Anthropic error', data)
    return res.status(anthropicRes.status).json({ error: data.error?.message || 'Claude API error' })
  }

  return res.status(200).json(data)
}
