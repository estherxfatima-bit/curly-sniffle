// Shared Supabase service-role client for /api/sms routes.
// This is a single-user app — getPrimaryUserId() returns the one account on file.
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

let cachedUserId = null

export async function getPrimaryUserId() {
  if (cachedUserId) return cachedUserId
  const { data, error } = await supabaseAdmin.auth.admin.listUsers()
  if (error) throw error
  const userId = data?.users?.[0]?.id
  if (!userId) throw new Error('No user account found')
  cachedUserId = userId
  return userId
}
