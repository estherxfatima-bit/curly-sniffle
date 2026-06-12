// /api/auth/google/start — kicks off the Google OAuth flow for Calendar access
// Call as /api/auth/google/start?token=<supabase access token>

export default async function handler(req, res) {
  const { token } = req.query

  if (!token) {
    return res.status(400).json({ error: 'Missing token' })
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REDIRECT_URI) {
    return res.status(500).json({ error: 'Google OAuth is not configured' })
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/calendar.readonly email profile',
    state: token,
  })

  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` })
  res.end()
}
