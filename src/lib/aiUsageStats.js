import { startOfMonth, startOfWeek, subWeeks } from 'date-fns'
import { supabase } from './supabase'

// Fetches a user's ai_log rows with cost data and rolls them up for display.
export async function fetchUserAiUsage(userId) {
  const { data, error } = await supabase
    .from('ai_log')
    .select('type, estimated_cost, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error

  return summariseUsage(data || [])
}

export function summariseUsage(rows) {
  const now = new Date()
  const monthStart = startOfMonth(now)

  let totalAllTime = 0
  let totalThisMonth = 0
  const byType = {}

  const weekBuckets = Array.from({ length: 8 }, (_, i) => {
    const start = startOfWeek(subWeeks(now, 7 - i), { weekStartsOn: 1 })
    return { start, total: 0 }
  })

  for (const row of rows) {
    const cost = row.estimated_cost || 0
    totalAllTime += cost
    if (new Date(row.created_at) >= monthStart) totalThisMonth += cost
    byType[row.type] = (byType[row.type] || 0) + cost

    const rowDate = new Date(row.created_at)
    const bucket = weekBuckets.find((b, i) => {
      const next = i < weekBuckets.length - 1 ? weekBuckets[i + 1].start : null
      return rowDate >= b.start && (!next || rowDate < next)
    })
    if (bucket) bucket.total += cost
  }

  return { totalAllTime, totalThisMonth, byType, weekBuckets }
}
