// Parses incoming SMS text and routes it to the right handler.
import { format } from 'date-fns'
import { supabaseAdmin } from './db.js'

export const VARIABLE_CATS = ['Food', 'Travel', 'Outings', 'Shopping', 'Business', 'Personal Care', 'Other']

const CATEGORY_KEYWORDS = {
  Food: ['food', 'lunch', 'dinner', 'breakfast', 'brunch', 'coffee', 'snack', 'groceries', 'grocery', 'takeaway', 'restaurant', 'meal', 'supermarket'],
  Travel: ['travel', 'train', 'tube', 'bus', 'taxi', 'uber', 'lyft', 'flight', 'petrol', 'fuel', 'parking', 'tfl', 'cab'],
  Outings: ['cinema', 'movie', 'film', 'concert', 'drinks', 'bar', 'club', 'event', 'tickets', 'outing', 'gig'],
  Shopping: ['shopping', 'clothes', 'clothing', 'shoes', 'amazon', 'asos', 'zara', 'shop'],
  Business: ['business', 'work', 'office', 'subscription', 'software', 'supplies', 'client'],
  'Personal Care': ['haircut', 'nails', 'beauty', 'skincare', 'spa', 'massage', 'salon'],
}

export const HELP_MESSAGE = "Try: 'spent £10 on food', 'done 1 2', 'add buy oat milk', or just ask me anything."

// ── Parsers ──────────────────────────────────────────────────────────────

// "spent £12 on lunch" / "spent 12.50 on dinner with friends" / "£45 groceries" / "£45 on groceries"
export function parseExpense(text) {
  const t = text.trim()
  let m = t.match(/^(?:spent|spend)\s+£?\s*(\d+(?:\.\d{1,2})?)\s*(?:on\s+)?(.+)$/i)
  if (!m) m = t.match(/^£\s*(\d+(?:\.\d{1,2})?)\s+(.+)$/)
  if (!m) return null
  const amount = parseFloat(m[1])
  const description = m[2].trim().replace(/^on\s+/i, '').trim()
  if (!description || !(amount > 0)) return null
  return { amount, description }
}

// "done 1 2" / "done 1, 3" / "done all"
export function parseTodoComplete(text) {
  const m = text.trim().match(/^done\s+(.+)$/i)
  if (!m) return null
  const arg = m[1].trim().toLowerCase()
  if (arg === 'all') return { all: true }
  const nums = [...new Set(arg.split(/[\s,]+/).map(n => parseInt(n, 10)).filter(n => Number.isInteger(n) && n > 0))]
  if (!nums.length) return null
  return { nums }
}

// "add buy oat milk" / "todo: call dentist" / "todo call dentist"
export function parseTodoAdd(text) {
  const m = text.trim().match(/^(?:add|todo:?)\s+(.+)$/i)
  if (!m) return null
  const todoText = m[1].trim()
  if (!todoText) return null
  return { text: todoText }
}

// Anything that reads like a question/request — routed to Claude.
// Short, non-question-shaped fragments fall through to the help message.
const QUESTION_WORDS = ['what', 'whats', "what's", 'how', 'hows', 'when', 'where', 'why', 'who', 'which', 'is', 'are', 'can', 'should', 'do', 'does', 'did', 'will', 'tell', 'help', 'give']
export function looksLikeQuestion(text) {
  const t = text.trim()
  if (t.length < 3) return false
  if (t.endsWith('?')) return true
  const words = t.toLowerCase().split(/\s+/)
  if (words.length >= 3) return true
  return QUESTION_WORDS.includes(words[0].replace(/[^a-z']/g, ''))
}

export function matchCategory(description) {
  const lower = description.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return cat
  }
  return 'Other'
}

// ── Shared data access ──────────────────────────────────────────────────

export async function getTodaysTodos(userId) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data } = await supabaseAdmin
    .from('daily_todos')
    .select('id, text, complete, category')
    .eq('user_id', userId)
    .eq('date', today)
    .eq('archived', false)
    .order('created_at')
  return data || []
}

// ── Handlers ─────────────────────────────────────────────────────────────

export async function handleExpense(userId, { amount, description }) {
  const category = matchCategory(description)
  const today = format(new Date(), 'yyyy-MM-dd')

  await supabaseAdmin.from('variable_expenses').insert({
    user_id: userId, name: description, amount, category, date: today,
  })

  const monthYear = format(new Date(), 'yyyy-MM')
  const [budgetRes, expensesRes] = await Promise.all([
    supabaseAdmin.from('budgets').select('amount').eq('user_id', userId).eq('month_year', monthYear).is('category', null).maybeSingle(),
    supabaseAdmin.from('variable_expenses').select('amount').eq('user_id', userId).gte('date', `${monthYear}-01`),
  ])

  const totalSpent = (expensesRes.data || []).reduce((s, e) => s + Number(e.amount), 0)
  const budget = budgetRes.data?.amount || 0

  let tail
  if (budget > 0) {
    const left = budget - totalSpent
    tail = left >= 0 ? `£${left.toFixed(0)} left this month.` : `£${Math.abs(left).toFixed(0)} over budget this month.`
  } else {
    tail = `£${totalSpent.toFixed(0)} spent this month.`
  }

  return `Logged £${amount.toFixed(2).replace(/\.00$/, '')} — ${category}. ${tail}`
}

export async function handleTodoComplete(userId, { all, nums }) {
  const todos = await getTodaysTodos(userId)
  if (!todos.length) return "No to-dos found for today."

  const targets = (all ? todos : nums.map(n => todos[n - 1]).filter(Boolean)).filter(t => t && !t.complete)
  if (!targets.length) return "Nothing to mark complete — check the numbers from your morning briefing."

  await supabaseAdmin.from('daily_todos').update({ complete: true }).in('id', targets.map(t => t.id))

  const names = targets.map(t => t.text)
  const shown = names.length > 5 ? `${names.slice(0, 5).join(', ')} +${names.length - 5} more` : names.join(', ')
  return `Completed: ${shown}`
}

export async function handleTodoAdd(userId, { text }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  await supabaseAdmin.from('daily_todos').insert({
    user_id: userId, text, date: today, category: 'Personal', complete: false,
  })
  return `Added to today's to-dos: "${text}"`
}

// Routes a message to the right handler. Returns the SMS reply text.
export async function routeMessage(userId, text, { handleQuestion }) {
  if (!text) return HELP_MESSAGE

  const expense = parseExpense(text)
  if (expense) return handleExpense(userId, expense)

  const complete = parseTodoComplete(text)
  if (complete) return handleTodoComplete(userId, complete)

  const add = parseTodoAdd(text)
  if (add) return handleTodoAdd(userId, add)

  if (looksLikeQuestion(text)) return handleQuestion(userId, text)

  return HELP_MESSAGE
}
