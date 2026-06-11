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
    return `${habit.frequency_count || 1}x/week`
  }
  return 'Daily'
}

// Count of logged days within the given week (Mon-Sun) for a habit
export function weekCount(logSet, weekStart) {
  let count = 0
  for (let i = 0; i < 7; i++) {
    if (logSet.has(format(addDays(weekStart, i), 'yyyy-MM-dd'))) count++
  }
  return count
}

function dailyOrSpecificStreak(habit, logSet, freezeSet, today) {
  let streak = 0
  let d = new Date(today)
  const todayStr = format(d, 'yyyy-MM-dd')
  // Today not yet logged doesn't break the streak — start counting from yesterday
  if (isExpectedDay(habit, d) && !logSet.has(todayStr) && !freezeSet.has(todayStr)) {
    d = addDays(d, -1)
  }
  while (true) {
    if (!isExpectedDay(habit, d)) { d = addDays(d, -1); continue }
    const ds = format(d, 'yyyy-MM-dd')
    if (logSet.has(ds) || freezeSet.has(ds)) {
      streak++
      d = addDays(d, -1)
    } else {
      break
    }
  }
  return streak
}

function weeklyStreak(habit, logSet, today) {
  const target = habit.frequency_count || 1
  let streak = 0
  let ws = startOfWeek(today, { weekStartsOn: 1 })
  let isCurrentWeek = true
  while (streak < 520) {
    const count = weekCount(logSet, ws)
    if (count >= target) {
      streak++
    } else if (!isCurrentWeek) {
      break
    }
    // current week not yet hitting target doesn't break the streak — it isn't over yet
    isCurrentWeek = false
    ws = addDays(ws, -7)
  }
  return streak
}

// Current streak, respecting the habit's frequency type
export function computeCurrentStreak(habit, logSet, freezeSet, today = new Date()) {
  if (habit.frequency_type === 'times_per_week') return weeklyStreak(habit, logSet, today)
  return dailyOrSpecificStreak(habit, logSet, freezeSet, today)
}

// Best-ever streak, scanning forward across the habit's full log history
export function computeBestStreak(habit, logSet, freezeSet, startDate, endDate) {
  if (habit.frequency_type === 'times_per_week') {
    const target = habit.frequency_count || 1
    let best = 0, current = 0
    let ws = startOfWeek(startDate, { weekStartsOn: 1 })
    const lastWeekStart = startOfWeek(endDate, { weekStartsOn: 1 })
    while (ws <= lastWeekStart) {
      const count = weekCount(logSet, ws)
      if (ws.getTime() === lastWeekStart.getTime()) {
        // current week may still be in progress — only count if already hit
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
    if (ds === todayStr && !logSet.has(ds) && !freezeSet.has(ds)) break // today not done yet
    if (logSet.has(ds) || freezeSet.has(ds)) { current++; best = Math.max(best, current) }
    else current = 0
    d = addDays(d, 1)
  }
  return best
}
