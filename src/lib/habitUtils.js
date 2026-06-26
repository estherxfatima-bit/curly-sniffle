import { format, addDays, startOfWeek, startOfMonth, endOfMonth, isAfter, differenceInCalendarDays } from 'date-fns'

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function dayName(date) {
  return DAY_NAMES[(date.getDay() + 6) % 7]
}

// Whether this date is one the habit is "expected" on (vs. neutral/not-applicable)
export function isExpectedDay(habit, date) {
  if (habit.frequency_type === 'specific_days') {
    return (habit.frequency_days || []).includes(dayName(date))
  }
  return true
}

// Whether this habit has at least one expected occurrence in the given week
export function isExpectedThisWeek(habit) {
  if (habit.frequency_type === 'specific_days') {
    return (habit.frequency_days || []).length > 0
  }
  return true
}

// Per-habit accent colour, falling back to the section's rose accent
export function habitColor(habit) {
  return habit.color || 'var(--personal)'
}

// Group habits into AM / Anytime / PM buckets for display, preserving the
// original (incoming) order within each bucket. Purely organisational —
// does not affect logging. Returns only non-empty groups, in display order:
// Morning, Anytime, Evening.
export function groupHabitsByTimeOfDay(habits) {
  const am = habits.filter(h => h.time_of_day === 'am')
  const pm = habits.filter(h => h.time_of_day === 'pm')
  const anytime = habits.filter(h => h.time_of_day !== 'am' && h.time_of_day !== 'pm')

  const groups = [
    { key: 'am', label: 'Morning', habits: am },
    { key: 'anytime', label: 'Anytime', habits: anytime },
    { key: 'pm', label: 'Evening', habits: pm },
  ]
  return groups.filter(g => g.habits.length > 0)
}

export function frequencyLabel(habit) {
  if (habit.frequency_type === 'specific_days') {
    return (habit.frequency_days || []).length ? (habit.frequency_days || []).join(' ') : 'Specific days'
  }
  if (habit.frequency_type === 'times_per_week') {
    return `${habit.frequency_count || 1}x per week`
  }
  return 'DAILY'
}

// Count of logged days within the given week (Mon-Sun) for a habit
export function weekCount(logSet, weekStart) {
  let count = 0
  for (let i = 0; i < 7; i++) {
    if (logSet.has(format(addDays(weekStart, i), 'yyyy-MM-dd'))) count++
  }
  return count
}

// Walk a habit's history from creation to today, applying the streak-freeze rules:
// - every 5 consecutive completed occurrences earns a banked freeze
// - a missed occurrence consumes a banked freeze (streak continues, day shown frozen)
// - a missed occurrence with no banked freeze resets the streak to 0
//
// Returns:
//   streak        - current streak count
//   banked        - banked freezes remaining
//   frozenDates   - Set of 'yyyy-MM-dd' occurrence dates that were auto-frozen
//   lastOccurrence- { dateStr, status: 'completed' | 'frozen' | 'missed' } | null
//   pending       - true if today's (or this week's) occurrence is still open
export function simulateHabit(habit, logSet, today = new Date()) {
  const startDate = habit.created_at ? new Date(habit.created_at) : today
  let streak = 0
  let banked = 0
  const frozenDates = new Set()
  let lastOccurrence = null
  let pending = false

  function processOccurrence(dateStr, completed) {
    if (completed) {
      streak++
      if (streak % 5 === 0) banked++
      lastOccurrence = { dateStr, status: 'completed' }
    } else if (banked > 0) {
      banked--
      frozenDates.add(dateStr)
      lastOccurrence = { dateStr, status: 'frozen' }
    } else {
      streak = 0
      lastOccurrence = { dateStr, status: 'missed' }
    }
  }

  if (habit.frequency_type === 'times_per_week') {
    const target = habit.frequency_count || 1
    let ws = startOfWeek(startDate, { weekStartsOn: 1 })
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 })
    while (ws <= currentWeekStart) {
      const count = weekCount(logSet, ws)
      const isCurrentWeek = ws.getTime() === currentWeekStart.getTime()
      const completed = count >= target
      if (isCurrentWeek) {
        if (!completed) { pending = true; break }
      }
      const occDate = format(addDays(ws, 6), 'yyyy-MM-dd')
      processOccurrence(occDate, completed)
      ws = addDays(ws, 7)
    }
    return { streak, banked, frozenDates, lastOccurrence, pending }
  }

  let d = new Date(startDate)
  const todayStr = format(today, 'yyyy-MM-dd')
  while (d <= today) {
    if (!isExpectedDay(habit, d)) { d = addDays(d, 1); continue }
    const ds = format(d, 'yyyy-MM-dd')
    const logged = logSet.has(ds)
    if (ds === todayStr && !logged) { pending = true; break }
    processOccurrence(ds, logged)
    d = addDays(d, 1)
  }
  return { streak, banked, frozenDates, lastOccurrence, pending }
}

// Best-ever streak, scanning forward across the habit's full log history.
// `frozenSet` should be the frozenDates set from simulateHabit.
export function computeBestStreak(habit, logSet, frozenSet, startDate, endDate) {
  if (habit.frequency_type === 'times_per_week') {
    const target = habit.frequency_count || 1
    let best = 0, current = 0
    let ws = startOfWeek(startDate, { weekStartsOn: 1 })
    const lastWeekStart = startOfWeek(endDate, { weekStartsOn: 1 })
    while (ws <= lastWeekStart) {
      const count = weekCount(logSet, ws)
      if (ws.getTime() === lastWeekStart.getTime()) {
        if (count >= target) { current++; best = Math.max(best, current) }
        break
      }
      if (count >= target) { current++; best = Math.max(best, current) }
      else current = 0
      ws = addDays(ws, 7)
    }
    return best
  }

  let best = 0, current = 0
  let d = new Date(startDate)
  const todayStr = format(endDate, 'yyyy-MM-dd')
  while (d <= endDate) {
    if (!isExpectedDay(habit, d)) { d = addDays(d, 1); continue }
    const ds = format(d, 'yyyy-MM-dd')
    if (ds === todayStr && !logSet.has(ds) && !frozenSet.has(ds)) break // today not done yet
    if (logSet.has(ds) || frozenSet.has(ds)) { current++; best = Math.max(best, current) }
    else current = 0
    d = addDays(d, 1)
  }
  return best
}

// Number of Mon-Sun weeks that overlap with the given month
export function weeksInMonth(monthDate) {
  const monthEnd = endOfMonth(monthDate)
  let count = 0
  let ws = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 })
  while (ws <= monthEnd) {
    count++
    ws = addDays(ws, 7)
  }
  return count
}

// Status of a single day for a habit: 'done' | 'frozen' | 'missed' | 'na' | 'future'
export function dayStatus(habit, logSet, frozenSet, date, today) {
  const ds = format(date, 'yyyy-MM-dd')
  if (isAfter(date, today)) return 'future'
  if (!isExpectedDay(habit, date)) return 'na'
  if (logSet.has(ds)) return 'done'
  if (frozenSet.has(ds)) return 'frozen'
  return 'missed'
}

// Expected number of occurrences for a habit within [periodStart, periodEnd] (inclusive),
// clamped so that any time before the habit's creation date doesn't count.
//   - 'specific_days'   -> count of matching weekdays in the (clamped) period
//   - 'times_per_week'  -> (days in period ÷ 7) × frequency_count, rounded down (Math.floor)
//   - 'daily' (default) -> number of days in the (clamped) period
export function calculateExpectedOccurrences(habit, periodStart, periodEnd) {
  let start = periodStart
  const end = periodEnd
  if (habit.created_at) {
    const createdAt = new Date(habit.created_at)
    if (createdAt > start) start = createdAt
  }
  if (start > end) return 0

  if (habit.frequency_type === 'specific_days') {
    const days = (habit.frequency_days || [])
    if (!days.length) return 0
    let count = 0
    for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= end; d = addDays(d, 1)) {
      if (days.includes(dayName(d))) count++
    }
    return count
  }

  const daysInPeriod = differenceInCalendarDays(end, start) + 1
  if (daysInPeriod <= 0) return 0

  if (habit.frequency_type === 'times_per_week') {
    const target = habit.frequency_count || 1
    return Math.floor((daysInPeriod / 7) * target)
  }

  // 'daily' (default)
  return daysInPeriod
}

// Goal completion % for a habit over [periodStart, periodEnd], given its logs (array of
// objects with a log_date / date string field) or a Set of 'yyyy-MM-dd' strings.
// Returns a number 0-100, or null if there are no expected occurrences (avoids NaN/Infinity).
export function calculateGoalCompletion(habit, logs, periodStart, periodEnd, dateField = 'log_date') {
  const expected = calculateExpectedOccurrences(habit, periodStart, periodEnd)
  if (!expected) return null

  const startStr = format(periodStart, 'yyyy-MM-dd')
  const endStr = format(periodEnd, 'yyyy-MM-dd')

  let actual
  if (logs instanceof Set) {
    actual = 0
    for (const ds of logs) {
      if (ds >= startStr && ds <= endStr) actual++
    }
  } else {
    actual = (logs || []).filter(l => {
      const ds = typeof l === 'string' ? l : l[dateField]
      return ds >= startStr && ds <= endStr
    }).length
  }

  return Math.round((actual / expected) * 100)
}

// Per-day status across a given month, plus completion stats for that month.
// Returns:
//   days          - array of { date, ds, status } for status in 'done'|'frozen'|'missed'|'na'|'future'
//   completionPct - % of expected (non-future) days completed
//   loggedCount   - count of logged days in the month
//   longestStreak - longest run of done/frozen days within the month
//   monthlyGoal   - { target, current } for times_per_week habits, else null
export function monthStats(habit, logSet, frozenSet, monthDate, today) {
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)

  const days = []
  let loggedCount = 0, expectedCount = 0
  let longest = 0, current = 0

  for (let d = new Date(monthStart); d <= monthEnd; d = addDays(d, 1)) {
    const ds = format(d, 'yyyy-MM-dd')
    const status = dayStatus(habit, logSet, frozenSet, d, today)
    days.push({ date: new Date(d), ds, status })

    if (status !== 'future' && status !== 'na') {
      expectedCount++
      if (status === 'done') loggedCount++
      if (status === 'done' || status === 'frozen') { current++; longest = Math.max(longest, current) }
      else current = 0
    }
  }

  // Goal completion % uses the shared frequency-aware calculation (expected occurrences
  // for this exact month, clamped to the habit's creation date) rather than the raw
  // day-grid expectedCount above (which also excludes future days for display purposes).
  const periodEnd = today < monthEnd ? today : monthEnd
  const completionPct = calculateGoalCompletion(habit, logSet, monthStart, periodEnd) ?? 0

  let monthlyGoal = null
  if (habit.frequency_type === 'times_per_week') {
    const target = calculateExpectedOccurrences(habit, monthStart, monthEnd)
    monthlyGoal = { target, current: loggedCount }
  }

  return { days, completionPct, loggedCount, longestStreak: longest, monthlyGoal }
}
