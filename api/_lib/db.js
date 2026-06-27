// Shared Supabase service-role client for /api/sms routes.
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Looks up which user a given E.164 phone number belongs to, for the
// inbound SMS webhook. Returns null if no profile has this number on file.
export async function getUserIdByPhone(phone) {
  if (!phone) return null
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('phone_number', phone)
    .maybeSingle()
  if (error) throw error
  return data?.id || null
}

// Returns every profile with an SMS-eligible phone number on file, for the
// morning-briefing cron. `requireSmsEnabled` filters to users who've opted
// into the automated briefing (vs. just two-way texting).
export async function getUsersWithPhoneNumber({ requireSmsEnabled = false } = {}) {
  let query = supabaseAdmin.from('profiles').select('id, phone_number').not('phone_number', 'is', null)
  if (requireSmsEnabled) query = query.eq('sms_enabled', true)
  const { data, error } = await query
  if (error) throw error
  return data || []
}
