// Shared finance helpers — categories, colours, monthly conversion, budget status
import { differenceInCalendarDays, parseISO } from 'date-fns'

export const VARIABLE_CATS = ['Food', 'Travel', 'Outings', 'Shopping', 'Business', 'Personal Care', 'Other']

export const CAT_COLORS = {
  Food: 'var(--wellness)',
  Travel: 'var(--career)',
  Outings: 'var(--creative)',
  Shopping: 'var(--personal)',
  Business: 'var(--finance)',
  'Personal Care': '#8a5cd4',
  Other: 'var(--text-3)',
}

export const CAT_EMOJI = {
  Food: '🍔',
  Travel: '🚆',
  Outings: '🎉',
  Shopping: '🛍️',
  Business: '💼',
  'Personal Care': '💆',
  Other: '📦',
}

// Filters free-typed input down to a valid decimal amount (digits + one '.').
// Used instead of type="number" since some mobile keyboards (depending on
// locale/inputMode support) won't let you type a decimal point into a
// number input, making amount fields appear broken.
export function sanitizeAmountInput(value) {
  let v = value.replace(/[^0-9.]/g, '')
  const dot = v.indexOf('.')
  if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '')
  return v
}

export function toMonthly(amount, frequency) {
  if (frequency === 'monthly')  return amount
  if (frequency === 'weekly')   return amount * 52 / 12
  if (frequency === 'annual')   return amount / 12
  if (frequency === 'one-off')  return 0
  return amount
}

// Colour for a budget ring based on percentage spent: green <80%, amber 80-100%, red >100%
export function budgetColor(pct) {
  if (pct > 100) return 'var(--danger)'
  if (pct >= 80)  return 'var(--warning)'
  return 'var(--success)'
}

const DISMISS_KEY = 'financeReminderDismissed'

// Number of days since the most recent variable expense, or null if there's no history.
export function daysSinceLastExpense(variable) {
  if (!variable || variable.length === 0) return null
  const latest = variable.reduce((max, v) => v.date > max ? v.date : max, variable[0].date)
  return differenceInCalendarDays(new Date(), parseISO(latest))
}

// Returns the number of days since the last logged expense if it's been 2+
// days (or there's no expense at all, returning 'a while'), otherwise false.
export function shouldShowSpendingReminder(variable) {
  if (!variable || variable.length === 0) return 'a while'
  const days = daysSinceLastExpense(variable)
  return days >= 2 ? days : false
}

export function isReminderDismissedToday() {
  try {
    return localStorage.getItem(DISMISS_KEY) === new Date().toISOString().slice(0, 10)
  } catch {
    return false
  }
}

export function dismissReminderToday() {
  try { localStorage.setItem(DISMISS_KEY, new Date().toISOString().slice(0, 10)) } catch { /* ignore */ }
}
