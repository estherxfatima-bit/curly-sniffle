// Shared Daily/Weekly/Monthly period navigation — same pattern as the Dashboard's view switcher.
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from 'date-fns'

export const PERIOD_VIEWS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

export function shiftRefDate(date, view, dir) {
  if (view === 'daily')  return addDays(date, dir)
  if (view === 'weekly') return addWeeks(date, dir)
  return addMonths(date, dir)
}

// The single period (day/week/month) containing refDate.
export function getCurrentPeriodBounds(refDate, view) {
  if (view === 'daily')  return { start: refDate, end: refDate }
  if (view === 'weekly') return { start: startOfWeek(refDate, { weekStartsOn: 1 }), end: endOfWeek(refDate, { weekStartsOn: 1 }) }
  return { start: startOfMonth(refDate), end: endOfMonth(refDate) }
}

// A trailing window of periods ending at the current period — used for trend charts.
export function getTrailingBounds(refDate, view) {
  const { end } = getCurrentPeriodBounds(refDate, view)
  if (view === 'daily')  return { start: subDays(end, 13), end }
  if (view === 'weekly') return { start: startOfWeek(subWeeks(refDate, 3), { weekStartsOn: 1 }), end }
  return { start: startOfMonth(subMonths(refDate, 5)), end }
}

export function getPeriodLabel(refDate, view) {
  if (view === 'daily') return format(refDate, 'EEEE, d MMMM yyyy')
  if (view === 'weekly') {
    const { start, end } = getCurrentPeriodBounds(refDate, view)
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }
  return format(refDate, 'MMMM yyyy')
}

export function isCurrentPeriod(refDate, view) {
  const now = new Date()
  if (view === 'daily')  return format(refDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')
  if (view === 'weekly') return format(startOfWeek(refDate, { weekStartsOn: 1 }), 'yyyy-MM-dd') === format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  return format(refDate, 'yyyy-MM') === format(now, 'yyyy-MM')
}
