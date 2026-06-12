// Shared helpers for the Insights page — date ranges, streaks, day-of-week stats.
import { subDays, startOfQuarter, parseISO, differenceInCalendarDays, format } from 'date-fns'

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const DATE_RANGE_OPTIONS = [
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: '90', label: 'Last 90 days' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'custom', label: 'Custom range' },
]

// Returns { start: Date, end: Date } for the selected range.
export function getRangeDates(rangeKey, customStart, customEnd) {
  const now = new Date()
  if (rangeKey === '7')  return { start: subDays(now, 6), end: now }
  if (rangeKey === '30') return { start: subDays(now, 29), end: now }
  if (rangeKey === '90') return { start: subDays(now, 89), end: now }
  if (rangeKey === 'quarter') return { start: startOfQuarter(now), end: now }
  if (rangeKey === 'custom' && customStart && customEnd) {
    return { start: parseISO(customStart), end: parseISO(customEnd) }
  }
  return { start: subDays(now, 29), end: now }
}

// Longest run of consecutive calendar days in a list of 'yyyy-MM-dd' date strings.
export function longestStreak(dateStrings) {
  if (!dateStrings.length) return 0
  const sorted = [...new Set(dateStrings)].sort()
  let longest = 1, current = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = differenceInCalendarDays(parseISO(sorted[i]), parseISO(sorted[i - 1]))
    if (diff === 1) {
      current++
      longest = Math.max(longest, current)
    } else if (diff > 1) {
      current = 1
    }
  }
  return longest
}

// Day of week ('Sun'..'Sat') with the most entries in a list of 'yyyy-MM-dd' date strings.
export function bestDayOfWeek(dateStrings) {
  if (!dateStrings.length) return null
  const counts = new Array(7).fill(0)
  dateStrings.forEach(d => counts[parseISO(d).getDay()]++)
  const max = Math.max(...counts)
  if (max === 0) return null
  return DAY_NAMES[counts.indexOf(max)]
}

export function fmtDay(date) {
  return format(date, 'yyyy-MM-dd')
}
