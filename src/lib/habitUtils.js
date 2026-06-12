import { format, addDays, startOfWeek } from 'date-fns'

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
