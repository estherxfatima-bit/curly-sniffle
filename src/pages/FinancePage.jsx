import { useState, useEffect } from 'react'
import { format, subWeeks, subDays, subMonths, endOfWeek, getDaysInMonth } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { generateFinanceSummary } from '../lib/aiLog'
import ArcRing from '../components/ui/ArcRing'
import BudgetRing from '../components/finance/BudgetRing'
import QuickAddFab from '../components/finance/QuickAddFab'
import SpendingReminderBanner from '../components/finance/SpendingReminderBanner'
import { SortableCard, DraggableCardList } from '../components/dashboard/DraggableCard'
import AddWidgetMenu from '../components/dashboard/AddWidgetMenu'
import { VARIABLE_CATS, CAT_COLORS, CAT_EMOJI, toMonthly, sanitizeAmountInput, shouldShowSpendingReminder, isReminderDismissedToday, dismissReminderToday } from '../lib/financeUtils'
import PeriodNav from '../components/ui/PeriodNav'
import { getCurrentPeriodBounds, getTrailingBounds } from '../lib/periodNav'
import { Plus, Trash2, Sparkles, Pencil, Check as CheckIcon, X as XIcon } from 'lucide-react'

const TAX_RATE = 0.25 // 25% tax pot estimate for self-employed

const EXPENSE_CATS = ['Housing', 'Transport', 'Food', 'Subscriptions', 'Health', 'Education', 'Entertainment', 'Other']
const FREQUENCIES = ['monthly', 'weekly', 'annual', 'one-off']
const SAVINGS_KINDS = ['Savings', 'Investment']

const CARD_LABELS = {
  'category-budgets': 'Category budgets',
  'variable-list': 'Variable expenses',
  'tax-pot': 'Tax pot & take-home',
  'weekly-chart': 'Spending trend',
  'ai-summary': 'AI summary',
}

const DEFAULT_ORDER = [
  { id: 'category-budgets', size: 'wide' },
  { id: 'variable-list', size: 'wide' },
  { id: 'tax-pot', size: 'square' },
  { id: 'weekly-chart', size: 'square' },
  { id: 'ai-summary', size: 'wide' },
]

function normalizeOrder(order) {
  if (!order?.length) return DEFAULT_ORDER
  return order.map(item => typeof item === 'string' ? { id: item, size: 'wide' } : item)
}

function FinanceDecoration() {
  return (
    <svg width="100" height="70" viewBox="0 0 100 70" fill="none">
      <rect x="8" y="14" width="44" height="32" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
      <rect x="14" y="22" width="28" height="4" rx="2" fill="currentColor" opacity="0.15"/>
      <rect x="14" y="30" width="20" height="4" rx="2" fill="currentColor" opacity="0.1"/>
      <path d="M68 50 L68 20 M78 50 L78 30 M88 50 L88 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.25"/>
    </svg>
  )
}

export default function FinancePage() {
  const { user } = useAuth()
  const [income, setIncome]     = useState([])
  const [fixed, setFixed]       = useState([])
  const [variable, setVariable] = useState([])
  const [savings, setSavings]   = useState([])
  const [budgets, setBudgets]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState('')

  // Net worth tracker state
  const [debts, setDebts]                   = useState([])
  const [savingsAccounts, setSavingsAccounts] = useState([])
  const [investments, setInvestments]       = useState([])
  const [newDebt, setNewDebt]               = useState({ name: '', category: 'Other', current_balance: '', original_balance: '', interest_rate: '', minimum_payment: '' })
  const [newSavingsAccount, setNewSavingsAccount] = useState({ name: '', current_balance: '', target_amount: '', target_date: '' })
  const [newInvestment, setNewInvestment]   = useState({ name: '', type: 'Other', current_value: '' })

  // New item forms
  const [newIncome, setNewIncome]     = useState({ name: '', amount: '', frequency: 'monthly', is_self_employed: false })
  const [newFixed, setNewFixed]       = useState({ name: '', amount: '', category: 'Other' })
  const [newVariable, setNewVariable] = useState({ name: '', amount: '', category: 'Other', date: new Date().toISOString().slice(0, 10) })
  const [newSavings, setNewSavings]   = useState({ name: '', amount: '', frequency: 'monthly', kind: 'Savings' })

  // Inline row editing (income/fixed/variable/savings)
  const [editingRow, setEditingRow] = useState(null) // { type, id }
  const [editDraft, setEditDraft] = useState({})

  // Card layout
  const [cardOrder, setCardOrder] = useState(null)
  const [editing, setEditing] = useState(false)

  // Budget editing
  const [editingBudgets, setEditingBudgets] = useState(false)
  const [budgetInputs, setBudgetInputs] = useState({})
  const [hiddenCats, setHiddenCats] = useState([])

  // Category filter for variable expenses list
  const [filterCat, setFilterCat] = useState(null)

  // Spending reminder banner
  const [reminderDismissed, setReminderDismissed] = useState(isReminderDismissedToday())

  // Daily / weekly / monthly period navigation — same pattern as the Dashboard
  const [activeView, setActiveView] = useState('monthly')
  const [refDate, setRefDate] = useState(new Date())

  const thisMonth = new Date().toISOString().slice(0, 7)
  const todayStr = new Date().toISOString().slice(0, 10)
  const refMonthYear = format(refDate, 'yyyy-MM')

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const [incRes, fixRes, varRes, savRes, budRes, layoutRes, prefRes, debtsRes, savAccRes, invRes] = await Promise.all([
      supabase.from('income_sources').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('fixed_expenses').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('variable_expenses').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('savings_allocations').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('budgets').select('*').eq('user_id', user.id),
      supabase.from('dashboard_layout').select('card_order').eq('user_id', user.id).eq('view', 'finance').maybeSingle(),
      supabase.from('user_preferences').select('hidden_budget_categories').eq('user_id', user.id).maybeSingle(),
      supabase.from('debts').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('savings_accounts').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('investments').select('*').eq('user_id', user.id).order('created_at'),
    ])
    setIncome(incRes.data || [])
    setFixed(fixRes.data || [])
    setVariable(varRes.data || [])
    setSavings(savRes.data || [])
    setBudgets(budRes.data || [])
    setCardOrder(normalizeOrder(layoutRes.data?.card_order))
    setHiddenCats(prefRes.data?.hidden_budget_categories || [])
    setDebts(debtsRes.data || [])
    setSavingsAccounts(savAccRes.data || [])
    setInvestments(invRes.data || [])
    setLoading(false)
  }

  async function addIncome() {
    if (!newIncome.name || !newIncome.amount) return
    const { data } = await supabase.from('income_sources').insert({
      user_id: user.id, name: newIncome.name, amount: parseFloat(newIncome.amount),
      frequency: newIncome.frequency, is_self_employed: newIncome.is_self_employed,
    }).select().single()
    setIncome(prev => [...prev, data])
    setNewIncome({ name: '', amount: '', frequency: 'monthly', is_self_employed: false })
  }

  async function addFixed() {
    if (!newFixed.name || !newFixed.amount) return
    const { data } = await supabase.from('fixed_expenses').insert({
      user_id: user.id, name: newFixed.name, amount: parseFloat(newFixed.amount), category: newFixed.category,
    }).select().single()
    setFixed(prev => [...prev, data])
    setNewFixed({ name: '', amount: '', category: 'Other' })
  }

  async function addVariable() {
    if (!newVariable.name || !newVariable.amount) return
    const { data } = await supabase.from('variable_expenses').insert({
      user_id: user.id, name: newVariable.name, amount: parseFloat(newVariable.amount),
      category: newVariable.category, date: newVariable.date,
    }).select().single()
    setVariable(prev => [data, ...prev])
    setNewVariable({ name: '', amount: '', category: 'Other', date: new Date().toISOString().slice(0, 10) })
  }

  // Quick-add from FAB — single tap on a category pill (after entering an amount)
  async function addVariableQuick({ amount, category, name }) {
    const { data } = await supabase.from('variable_expenses').insert({
      user_id: user.id, name, amount, category, date: new Date().toISOString().slice(0, 10),
    }).select().single()
    setVariable(prev => [data, ...prev])
  }

  // Log a £0 "no spend" entry for today so the spending reminder doesn't nag and the day is on record.
  async function logNoSpendToday() {
    const { data } = await supabase.from('variable_expenses').insert({
      user_id: user.id, name: 'No spend day', amount: 0, category: 'Other', date: new Date().toISOString().slice(0, 10),
    }).select().single()
    setVariable(prev => [data, ...prev])
  }

  async function addSavings() {
    if (!newSavings.name || !newSavings.amount) return
    const { data } = await supabase.from('savings_allocations').insert({
      user_id: user.id, name: newSavings.name, amount: parseFloat(newSavings.amount),
      frequency: newSavings.frequency, kind: newSavings.kind,
    }).select().single()
    setSavings(prev => [...prev, data])
    setNewSavings({ name: '', amount: '', frequency: 'monthly', kind: 'Savings' })
  }

  async function deleteIncome(id) {
    await supabase.from('income_sources').delete().eq('id', id)
    setIncome(prev => prev.filter(i => i.id !== id))
  }
  async function deleteFixed(id) {
    await supabase.from('fixed_expenses').delete().eq('id', id)
    setFixed(prev => prev.filter(i => i.id !== id))
  }
  async function deleteVariable(id) {
    await supabase.from('variable_expenses').delete().eq('id', id)
    setVariable(prev => prev.filter(i => i.id !== id))
  }
  async function deleteSavings(id) {
    await supabase.from('savings_allocations').delete().eq('id', id)
    setSavings(prev => prev.filter(i => i.id !== id))
  }

  // Net worth CRUD
  async function addDebt() {
    if (!newDebt.name || !newDebt.current_balance) return
    const payload = {
      user_id: user.id,
      name: newDebt.name,
      category: newDebt.category,
      current_balance: parseFloat(newDebt.current_balance),
      original_balance: newDebt.original_balance ? parseFloat(newDebt.original_balance) : null,
      interest_rate: newDebt.interest_rate ? parseFloat(newDebt.interest_rate) : null,
      minimum_payment: newDebt.minimum_payment ? parseFloat(newDebt.minimum_payment) : null,
    }
    const { data } = await supabase.from('debts').insert(payload).select().single()
    setDebts(prev => [...prev, data])
    setNewDebt({ name: '', category: 'Other', current_balance: '', original_balance: '', interest_rate: '', minimum_payment: '' })
  }
  async function deleteDebt(id) {
    await supabase.from('debts').delete().eq('id', id)
    setDebts(prev => prev.filter(i => i.id !== id))
  }

  async function addSavingsAccount() {
    if (!newSavingsAccount.name || !newSavingsAccount.current_balance) return
    const payload = {
      user_id: user.id,
      name: newSavingsAccount.name,
      current_balance: parseFloat(newSavingsAccount.current_balance),
      target_amount: newSavingsAccount.target_amount ? parseFloat(newSavingsAccount.target_amount) : null,
      target_date: newSavingsAccount.target_date || null,
    }
    const { data } = await supabase.from('savings_accounts').insert(payload).select().single()
    setSavingsAccounts(prev => [...prev, data])
    setNewSavingsAccount({ name: '', current_balance: '', target_amount: '', target_date: '' })
  }
  async function deleteSavingsAccount(id) {
    await supabase.from('savings_accounts').delete().eq('id', id)
    setSavingsAccounts(prev => prev.filter(i => i.id !== id))
  }

  async function addInvestment() {
    if (!newInvestment.name || !newInvestment.current_value) return
    const payload = {
      user_id: user.id,
      name: newInvestment.name,
      type: newInvestment.type,
      current_value: parseFloat(newInvestment.current_value),
    }
    const { data } = await supabase.from('investments').insert(payload).select().single()
    setInvestments(prev => [...prev, data])
    setNewInvestment({ name: '', type: 'Other', current_value: '' })
  }
  async function deleteInvestment(id) {
    await supabase.from('investments').delete().eq('id', id)
    setInvestments(prev => prev.filter(i => i.id !== id))
  }

  // Inline row editing — income/fixed/variable/savings
  function startEdit(type, item) {
    setEditingRow({ type, id: item.id })
    if (type === 'income') setEditDraft({ name: item.name, amount: item.amount.toString(), frequency: item.frequency, is_self_employed: item.is_self_employed })
    else if (type === 'fixed') setEditDraft({ name: item.name, amount: item.amount.toString(), category: item.category })
    else if (type === 'variable') setEditDraft({ name: item.name, amount: item.amount.toString(), category: item.category, date: item.date })
    else if (type === 'savings') setEditDraft({ name: item.name, amount: item.amount.toString(), frequency: item.frequency, kind: item.kind })
  }

  function cancelEdit() {
    setEditingRow(null)
    setEditDraft({})
  }

  async function saveEdit() {
    const { type, id } = editingRow
    const amount = parseFloat(editDraft.amount) || 0
    if (type === 'income') {
      const payload = { name: editDraft.name, amount, frequency: editDraft.frequency, is_self_employed: editDraft.is_self_employed }
      await supabase.from('income_sources').update(payload).eq('id', id)
      setIncome(prev => prev.map(i => i.id === id ? { ...i, ...payload } : i))
    } else if (type === 'fixed') {
      const payload = { name: editDraft.name, amount, category: editDraft.category }
      await supabase.from('fixed_expenses').update(payload).eq('id', id)
      setFixed(prev => prev.map(i => i.id === id ? { ...i, ...payload } : i))
    } else if (type === 'variable') {
      const payload = { name: editDraft.name, amount, category: editDraft.category, date: editDraft.date }
      await supabase.from('variable_expenses').update(payload).eq('id', id)
      setVariable(prev => prev.map(i => i.id === id ? { ...i, ...payload } : i))
    } else if (type === 'savings') {
      const payload = { name: editDraft.name, amount, frequency: editDraft.frequency, kind: editDraft.kind }
      await supabase.from('savings_allocations').update(payload).eq('id', id)
      setSavings(prev => prev.map(i => i.id === id ? { ...i, ...payload } : i))
    }
    cancelEdit()
  }

  // Show/hide a variable-expense category from the Category budgets card
  async function toggleCategoryHidden(cat) {
    const next = hiddenCats.includes(cat) ? hiddenCats.filter(c => c !== cat) : [...hiddenCats, cat]
    setHiddenCats(next)
    await supabase.from('user_preferences').upsert(
      { user_id: user.id, hidden_budget_categories: next },
      { onConflict: 'user_id' }
    )
  }

  async function runAISummary() {
    setAiLoading(true)
    try {
      const summary = await generateFinanceSummary(user.id, { income, fixed, variable, totalIncome, totalFixed, totalVariable, taxPot, takeHome })
      setAiSummary(summary)
    } catch (e) {
      setAiSummary('Summary unavailable — Claude API key not configured.')
    } finally {
      setAiLoading(false)
    }
  }

  // Budget settings — apply to the month currently being viewed
  function startEditBudgets() {
    const monthBudgets = budgets.filter(b => b.month_year === refMonthYear)
    const inputs = { overall: monthBudgets.find(b => b.category === null)?.amount?.toString() ?? '' }
    VARIABLE_CATS.forEach(c => { inputs[c] = monthBudgets.find(b => b.category === c)?.amount?.toString() ?? '' })
    setBudgetInputs(inputs)
    setEditingBudgets(true)
  }

  async function saveBudgets() {
    const monthBudgets = budgets.filter(b => b.month_year === refMonthYear)
    const entries = [{ category: null, key: 'overall' }, ...VARIABLE_CATS.map(c => ({ category: c, key: c }))]
    for (const { category, key } of entries) {
      const raw = budgetInputs[key]
      if (raw === undefined || raw === '') continue
      const amt = parseFloat(raw) || 0
      const existing = monthBudgets.find(b => b.category === category)
      if (existing) {
        if (existing.amount !== amt) {
          await supabase.from('budgets').update({ amount: amt }).eq('id', existing.id)
        }
      } else {
        await supabase.from('budgets').insert({ user_id: user.id, category, amount: amt, month_year: refMonthYear })
      }
    }
    const { data } = await supabase.from('budgets').select('*').eq('user_id', user.id)
    setBudgets(data || [])
    setEditingBudgets(false)
  }

  // Card layout persistence
  async function saveCardOrder(newOrder) {
    setCardOrder(newOrder)
    await supabase.from('dashboard_layout').upsert(
      { user_id: user.id, view: 'finance', card_order: newOrder },
      { onConflict: 'user_id,view' }
    )
  }
  function resizeCard(id, size) { saveCardOrder(normalizeOrder(cardOrder).map(c => c.id === id ? { ...c, size } : c)) }
  function removeCard(id) { saveCardOrder(normalizeOrder(cardOrder).filter(c => c.id !== id)) }
  function addCard(id) { saveCardOrder([...normalizeOrder(cardOrder), { id, size: 'wide' }]) }

  // Calculations
  const totalIncome   = income.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0)
  const selfEmpIncome = income.filter(i => i.is_self_employed).reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0)
  const taxPot        = selfEmpIncome * TAX_RATE
  const totalFixed    = fixed.reduce((s, i) => s + i.amount, 0)
  const totalSavings  = savings.reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0)
  const varThisMonth  = variable.filter(v => v.date.startsWith(thisMonth))
  const totalVariable = varThisMonth.reduce((s, i) => s + i.amount, 0)
  const takeHome      = totalIncome - taxPot - totalFixed - totalSavings - totalVariable

  const monthBudgets = budgets.filter(b => b.month_year === refMonthYear)
  const overallBudget = monthBudgets.find(b => b.category === null)?.amount || 0
  const categorySpend = {}
  VARIABLE_CATS.forEach(c => { categorySpend[c] = varThisMonth.filter(v => v.category === c).reduce((s, v) => s + v.amount, 0) })
  const categoryBudget = {}
  VARIABLE_CATS.forEach(c => { categoryBudget[c] = monthBudgets.find(b => b.category === c)?.amount || 0 })

  // Daily / weekly / monthly period scaling — budgets (and income/fixed costs,
  // which are monthly constants) are stored as monthly amounts.
  const BUDGET_SCALE = { daily: 1 / getDaysInMonth(refDate), weekly: 12 / 52, monthly: 1 }
  const { start: periodStart, end: periodEnd } = getCurrentPeriodBounds(refDate, activeView)
  const periodStartStr = format(periodStart, 'yyyy-MM-dd')
  const periodEndStr = format(periodEnd, 'yyyy-MM-dd')

  const periodVariable = variable.filter(v => v.date >= periodStartStr && v.date <= periodEndStr)
  const periodTotal = periodVariable.reduce((s, i) => s + i.amount, 0)
  const periodOverallBudget = overallBudget * BUDGET_SCALE[activeView]
  const periodCategorySpend = {}
  VARIABLE_CATS.forEach(c => { periodCategorySpend[c] = periodVariable.filter(v => v.category === c).reduce((s, v) => s + v.amount, 0) })
  const periodCategoryBudget = {}
  VARIABLE_CATS.forEach(c => { periodCategoryBudget[c] = categoryBudget[c] * BUDGET_SCALE[activeView] })

  // Disposable income for the selected period: income/tax/fixed costs are monthly
  // constants, scaled to the period, minus that period's actual variable spending.
  const monthlyDisposableBase = totalIncome - taxPot - totalFixed - totalSavings
  const periodIncome = totalIncome * BUDGET_SCALE[activeView]
  const periodDisposableAllowance = monthlyDisposableBase * BUDGET_SCALE[activeView]
  const periodTakeHome = periodDisposableAllowance - periodTotal

  // Disposable income colour: red if overspent, amber if thin margin, else green
  const disposablePct = periodIncome > 0 ? (periodTakeHome / periodIncome) * 100 : (periodTakeHome >= 0 ? 100 : -1)
  const disposableColor = periodTakeHome < 0 ? 'var(--danger)' : disposablePct < 15 ? 'var(--warning)' : 'var(--success)'

  // Reminder banner
  const reminderDays = shouldShowSpendingReminder(variable)

  // Spending trend chart — trailing window + granularity follow the period view
  const { start: trailStart, end: trailEnd } = getTrailingBounds(refDate, activeView)
  const spendChartData = []
  let spendChartTitle
  if (activeView === 'daily') {
    spendChartTitle = 'Daily spending — last 14 days'
    for (let d = trailStart; d <= trailEnd; d = subDays(d, -1)) {
      const dStr = format(d, 'yyyy-MM-dd')
      const total = variable.filter(v => v.date === dStr).reduce((s, v) => s + v.amount, 0)
      spendChartData.push({ week: format(d, 'd MMM'), total })
    }
  } else if (activeView === 'weekly') {
    spendChartTitle = 'Weekly spending — last 4 weeks'
    for (let ws = trailStart; ws <= trailEnd; ws = subWeeks(ws, -1)) {
      const we = endOfWeek(ws, { weekStartsOn: 1 })
      const wsStr = format(ws, 'yyyy-MM-dd')
      const weStr = format(we, 'yyyy-MM-dd')
      const total = variable.filter(v => v.date >= wsStr && v.date <= weStr).reduce((s, v) => s + v.amount, 0)
      spendChartData.push({ week: format(ws, 'd MMM'), total })
    }
  } else {
    spendChartTitle = 'Monthly spending — last 6 months'
    for (let ms = trailStart; ms <= trailEnd; ms = subMonths(ms, -1)) {
      const key = format(ms, 'yyyy-MM')
      const total = variable.filter(v => v.date.startsWith(key)).reduce((s, v) => s + v.amount, 0)
      spendChartData.push({ week: format(ms, 'MMM yy'), total })
    }
  }

  if (loading) return <p style={{ padding: 40, color: 'var(--text-3)', textAlign: 'center' }}>Loading…</p>

  const order = normalizeOrder(cardOrder).filter(o => o.id !== 'income' && o.id !== 'fixed')
  const available = Object.entries(CARD_LABELS)
    .filter(([id]) => !order.some(o => o.id === id))
    .map(([id, label]) => ({ id, label }))

  const filteredVariable = filterCat ? periodVariable.filter(v => v.category === filterCat) : periodVariable
  const periodLabel = activeView === 'daily' ? 'today' : activeView === 'weekly' ? 'this week' : 'this month'

  const monthlyBadge = (
    <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400, border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1px 6px', marginLeft: 8 }}>
      Monthly
    </span>
  )

  const incomeCard = (
    <div className="card">
      <h3 style={{ fontSize: '0.9rem', marginBottom: 14 }}>Income sources {monthlyBadge}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {income.map(i => (
          editingRow?.type === 'income' && editingRow.id === i.id ? (
            <div key={i.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <input placeholder="Source name" value={editDraft.name} onChange={e => setEditDraft(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12 }} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <input type="text" inputMode="decimal" placeholder="Amount £" value={editDraft.amount} onChange={e => setEditDraft(p => ({ ...p, amount: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 14, flex: '1 1 90px', minWidth: 80 }} />
                <select value={editDraft.frequency} onChange={e => setEditDraft(p => ({ ...p, frequency: e.target.value }))} style={{ fontSize: 12 }}>
                  {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)' }}>
                <input type="checkbox" checked={editDraft.is_self_employed} onChange={e => setEditDraft(p => ({ ...p, is_self_employed: e.target.checked }))} />
                Self-employed (tax pot applies)
              </label>
              <div className="flex items-center gap-2 justify-end">
                <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={saveEdit}><CheckIcon size={12} /> Save</button>
                <button className="btn-icon btn" onClick={cancelEdit}><XIcon size={12} /></button>
              </div>
            </div>
          ) : (
            <div key={i.id} className="flex items-center justify-between gap-2">
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <p style={{ fontSize: 13 }}>{i.name}</p>
                <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>
                  £{i.amount.toFixed(2)} / {i.frequency}{i.is_self_employed ? ' · self-emp' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--finance)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  £{toMonthly(i.amount, i.frequency).toFixed(0)}/mo
                </span>
                <button className="btn-icon btn" onClick={() => startEdit('income', i)}><Pencil size={12} /></button>
                <button className="btn-icon btn" onClick={() => deleteIncome(i.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          )
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <input placeholder="Source name" value={newIncome.name} onChange={e => setNewIncome(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input type="text" inputMode="decimal" placeholder="Amount £" value={newIncome.amount} onChange={e => setNewIncome(p => ({ ...p, amount: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 14, flex: '1 1 90px', minWidth: 80 }} />
          <select value={newIncome.frequency} onChange={e => setNewIncome(p => ({ ...p, frequency: e.target.value }))} style={{ fontSize: 12 }}>
            {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)' }}>
          <input type="checkbox" checked={newIncome.is_self_employed} onChange={e => setNewIncome(p => ({ ...p, is_self_employed: e.target.checked }))} />
          Self-employed (tax pot applies)
        </label>
        <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={addIncome}><Plus size={12} /> Add income</button>
      </div>
    </div>
  )

  const fixedCard = (
    <div className="card">
      <h3 style={{ fontSize: '0.9rem', marginBottom: 14 }}>Fixed expenses <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>£{totalFixed.toFixed(0)}/mo</span> {monthlyBadge}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {fixed.map(i => (
          editingRow?.type === 'fixed' && editingRow.id === i.id ? (
            <div key={i.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <input placeholder="Expense name" value={editDraft.name} onChange={e => setEditDraft(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12 }} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <input type="text" inputMode="decimal" placeholder="Amount £" value={editDraft.amount} onChange={e => setEditDraft(p => ({ ...p, amount: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 14, flex: '1 1 90px', minWidth: 80 }} />
                <select value={editDraft.category} onChange={e => setEditDraft(p => ({ ...p, category: e.target.value }))} style={{ fontSize: 12 }}>
                  {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={saveEdit}><CheckIcon size={12} /> Save</button>
                <button className="btn-icon btn" onClick={cancelEdit}><XIcon size={12} /></button>
              </div>
            </div>
          ) : (
            <div key={i.id} className="flex items-center justify-between gap-2">
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <p style={{ fontSize: 13 }}>{i.name}</p>
                <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{i.category}</p>
              </div>
              <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap' }}>£{i.amount.toFixed(2)}</span>
                <button className="btn-icon btn" onClick={() => startEdit('fixed', i)}><Pencil size={12} /></button>
                <button className="btn-icon btn" onClick={() => deleteFixed(i.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          )
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <input placeholder="Expense name" value={newFixed.name} onChange={e => setNewFixed(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input type="text" inputMode="decimal" placeholder="Amount £" value={newFixed.amount} onChange={e => setNewFixed(p => ({ ...p, amount: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 14, flex: '1 1 90px', minWidth: 80 }} />
          <select value={newFixed.category} onChange={e => setNewFixed(p => ({ ...p, category: e.target.value }))} style={{ fontSize: 12 }}>
            {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={addFixed}><Plus size={12} /> Add fixed expense</button>
      </div>
    </div>
  )

  const savingsCard = (
    <div className="card">
      <h3 style={{ fontSize: '0.9rem', marginBottom: 14 }}>Savings &amp; investments <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>£{totalSavings.toFixed(0)}/mo</span> {monthlyBadge}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {savings.map(i => (
          editingRow?.type === 'savings' && editingRow.id === i.id ? (
            <div key={i.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <input placeholder="Name" value={editDraft.name} onChange={e => setEditDraft(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12 }} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <input type="text" inputMode="decimal" placeholder="Amount £" value={editDraft.amount} onChange={e => setEditDraft(p => ({ ...p, amount: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 14, flex: '1 1 90px', minWidth: 80 }} />
                <select value={editDraft.frequency} onChange={e => setEditDraft(p => ({ ...p, frequency: e.target.value }))} style={{ fontSize: 12 }}>
                  {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                </select>
                <select value={editDraft.kind} onChange={e => setEditDraft(p => ({ ...p, kind: e.target.value }))} style={{ fontSize: 12 }}>
                  {SAVINGS_KINDS.map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={saveEdit}><CheckIcon size={12} /> Save</button>
                <button className="btn-icon btn" onClick={cancelEdit}><XIcon size={12} /></button>
              </div>
            </div>
          ) : (
            <div key={i.id} className="flex items-center justify-between gap-2">
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <p style={{ fontSize: 13 }}>{i.name}</p>
                <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{i.kind} · {i.frequency}</p>
              </div>
              <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  £{toMonthly(i.amount, i.frequency).toFixed(0)}/mo
                </span>
                <button className="btn-icon btn" onClick={() => startEdit('savings', i)}><Pencil size={12} /></button>
                <button className="btn-icon btn" onClick={() => deleteSavings(i.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          )
        ))}
        {savings.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>Nothing allocated yet.</p>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <input placeholder="e.g. ISA, pension top-up" value={newSavings.name} onChange={e => setNewSavings(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input type="text" inputMode="decimal" placeholder="Amount £" value={newSavings.amount} onChange={e => setNewSavings(p => ({ ...p, amount: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 14, flex: '1 1 90px', minWidth: 80 }} />
          <select value={newSavings.frequency} onChange={e => setNewSavings(p => ({ ...p, frequency: e.target.value }))} style={{ fontSize: 12 }}>
            {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
          </select>
          <select value={newSavings.kind} onChange={e => setNewSavings(p => ({ ...p, kind: e.target.value }))} style={{ fontSize: 12 }}>
            {SAVINGS_KINDS.map(k => <option key={k}>{k}</option>)}
          </select>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={addSavings}><Plus size={12} /> Add allocation</button>
      </div>
    </div>
  )

  const CARDS = {
    'category-budgets': (
      <div className="card card-finance">
        <div className="flex items-center justify-between mb-4">
          <h3>Category budgets <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>({format(refDate, 'MMM yyyy')})</span></h3>
          {editingBudgets ? (
            <div className="flex items-center gap-2">
              <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={e => { e.stopPropagation(); saveBudgets() }}><CheckIcon size={12} /> Save</button>
              <button className="btn-icon btn" onClick={e => { e.stopPropagation(); setEditingBudgets(false) }}><XIcon size={12} /></button>
            </div>
          ) : (
            <button className="btn btn-sm btn-ghost" onClick={e => { e.stopPropagation(); startEditBudgets() }}><Pencil size={12} /> Edit budgets</button>
          )}
        </div>
        {editingBudgets ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              <div onClick={e => e.stopPropagation()}>
                <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Overall monthly limit</label>
                <input type="text" inputMode="decimal" placeholder="£" value={budgetInputs.overall || ''} onChange={e => setBudgetInputs(p => ({ ...p, overall: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, width: '100%' }} />
              </div>
              {VARIABLE_CATS.map(cat => (
                <div key={cat} onClick={e => e.stopPropagation()} style={{ opacity: hiddenCats.includes(cat) ? 0.45 : 1 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>{CAT_EMOJI[cat]} {cat}</span>
                    <button
                      className="btn-icon"
                      style={{ padding: 1 }}
                      title={hiddenCats.includes(cat) ? 'Show this category again' : 'Remove this category from budgets'}
                      onClick={() => toggleCategoryHidden(cat)}
                    >
                      {hiddenCats.includes(cat) ? <Plus size={11} /> : <XIcon size={11} />}
                    </button>
                  </label>
                  <input type="text" inputMode="decimal" placeholder="£" value={budgetInputs[cat] || ''} onChange={e => setBudgetInputs(p => ({ ...p, [cat]: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, width: '100%' }} disabled={hiddenCats.includes(cat)} />
                </div>
              ))}
            </div>
            {budgetInputs.overall && (
              <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12 }}>
                {(() => {
                  const overallVal = parseFloat(budgetInputs.overall) || 0
                  const allocated = VARIABLE_CATS.filter(c => !hiddenCats.includes(c)).reduce((s, c) => s + (parseFloat(budgetInputs[c]) || 0), 0)
                  const remaining = overallVal - allocated
                  return `£${allocated.toFixed(0)} allocated of £${overallVal.toFixed(0)} — £${remaining.toFixed(0)} ${remaining >= 0 ? 'left to allocate' : 'over the overall limit'}`
                })()}
              </p>
            )}
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {VARIABLE_CATS.filter(cat => !hiddenCats.includes(cat)).map(cat => (
              <div key={cat} onClick={e => { e.stopPropagation(); setFilterCat(filterCat === cat ? null : cat) }} style={{ outline: filterCat === cat ? `2px solid ${CAT_COLORS[cat]}` : 'none', borderRadius: 'var(--radius)' }}>
                <BudgetRing label={`${CAT_EMOJI[cat]} ${cat}`} spent={periodCategorySpend[cat]} budget={periodCategoryBudget[cat]} size={84} />
              </div>
            ))}
          </div>
        )}
      </div>
    ),

    'variable-list': (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: '0.9rem' }}>Variable expenses <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>{periodLabel}: £{periodTotal.toFixed(2)}</span></h3>
          {filterCat && (
            <button className="btn btn-xs btn-ghost" onClick={e => { e.stopPropagation(); setFilterCat(null) }}>
              {CAT_EMOJI[filterCat]} {filterCat} ✕
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
          <input placeholder="Description" value={newVariable.name} onChange={e => setNewVariable(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12, flex: 2, minWidth: 120 }} />
          <input type="text" inputMode="decimal" placeholder="£" value={newVariable.amount} onChange={e => setNewVariable(p => ({ ...p, amount: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, width: 80 }} />
          <select value={newVariable.category} onChange={e => setNewVariable(p => ({ ...p, category: e.target.value }))} style={{ fontSize: 12 }}>
            {VARIABLE_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
          <input type="date" value={newVariable.date} onChange={e => setNewVariable(p => ({ ...p, date: e.target.value }))} style={{ fontSize: 12 }} />
          <button className="btn btn-sm btn-ghost" onClick={addVariable}><Plus size={12} /> Add</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={e => e.stopPropagation()}>
          {filteredVariable.slice(0, 20).map(i => (
            editingRow?.type === 'variable' && editingRow.id === i.id ? (
              <div key={i.id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '4px 0' }}>
                <input value={editDraft.name} onChange={e => setEditDraft(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12, flex: 2, minWidth: 120 }} />
                <input type="text" inputMode="decimal" value={editDraft.amount} onChange={e => setEditDraft(p => ({ ...p, amount: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 14, width: 80 }} />
                <select value={editDraft.category} onChange={e => setEditDraft(p => ({ ...p, category: e.target.value }))} style={{ fontSize: 12 }}>
                  {VARIABLE_CATS.map(c => <option key={c}>{c}</option>)}
                </select>
                <input type="date" value={editDraft.date} onChange={e => setEditDraft(p => ({ ...p, date: e.target.value }))} style={{ fontSize: 12 }} />
                <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={saveEdit}><CheckIcon size={12} /></button>
                <button className="btn-icon btn" onClick={cancelEdit}><XIcon size={12} /></button>
              </div>
            ) : (
              <div key={i.id} className="flex items-center justify-between gap-2" style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--text-2)' }}>{CAT_EMOJI[i.category] || '📦'} {i.name}</span>
                <div className="flex items-center gap-3">
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{i.category} · {i.date}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>£{i.amount.toFixed(2)}</span>
                  <button className="btn-icon btn" onClick={() => startEdit('variable', i)}><Pencil size={12} /></button>
                  <button className="btn-icon btn" onClick={() => deleteVariable(i.id)}><Trash2 size={12} /></button>
                </div>
              </div>
            )
          ))}
          {filteredVariable.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No expenses logged{filterCat ? ` for ${filterCat}` : ''}.</p>
          )}
        </div>
      </div>
    ),

    'tax-pot': (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <h3 style={{ fontSize: '0.9rem', alignSelf: 'flex-start' }}>Tax pot &amp; take-home</h3>
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <ArcRing value={taxPot} max={totalIncome || 1} size={84} color="var(--creative)" label={`£${taxPot.toFixed(0)}`} sublabel="Tax pot" />
            <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>25% self-emp</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <ArcRing value={Math.max(0, takeHome)} max={totalIncome || 1} size={84} color={takeHome >= 0 ? 'var(--finance)' : 'var(--danger)'} label={`£${takeHome.toFixed(0)}`} sublabel="Take-home" />
            <p className="mono" style={{ fontSize: 10, color: takeHome >= 0 ? 'var(--finance)' : 'var(--danger)' }}>
              {takeHome >= 0 ? 'surplus' : 'deficit'}
            </p>
          </div>
        </div>
      </div>
    ),

    'weekly-chart': (
      <div className="card">
        <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>{spendChartTitle}</h3>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={spendChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="week" tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-3)' }} />
            <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-3)' }} width={30} />
            <Tooltip
              contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}
              labelStyle={{ color: 'var(--text-3)' }}
              itemStyle={{ color: 'var(--finance)' }}
              formatter={v => `£${v.toFixed(2)}`}
            />
            <Bar dataKey="total" fill="var(--finance)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    ),

    'ai-summary': (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: '0.9rem' }}>AI finance summary</h3>
          <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={e => { e.stopPropagation(); runAISummary() }} disabled={aiLoading || income.length === 0}>
            <Sparkles size={12} />
            {aiLoading ? 'Generating…' : 'Generate summary'}
          </button>
        </div>
        {aiSummary ? (
          <p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{aiSummary}</p>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
            Add income and expenses, then generate an AI analysis of your financial picture.
          </p>
        )}
      </div>
    ),
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header header-finance mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>Finance</h1>
            <p>Monthly overview — income, expenses, budgets, and tax pot</p>
          </div>
          <button
            className={`btn btn-sm ${editing ? 'btn-finance' : 'btn-ghost'}`}
            style={editing ? { color: '#fff' } : {}}
            onClick={() => setEditing(v => !v)}
          >
            {editing ? <><CheckIcon size={13} /> Done</> : <><Pencil size={13} /> Edit layout</>}
          </button>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--finance)' }}><FinanceDecoration /></div>
      </div>

      {/* Spending reminder banner */}
      {reminderDays !== false && !reminderDismissed && (
        <SpendingReminderBanner days={reminderDays} onDismiss={() => { dismissReminderToday(); setReminderDismissed(true) }} />
      )}

      {/* Period view switcher + navigation */}
      <div className="mb-6 flex items-center justify-between gap-3 wrap">
        <PeriodNav activeView={activeView} onViewChange={setActiveView} refDate={refDate} onRefDateChange={setRefDate} accentColor="var(--finance)" />
        {activeView === 'daily' && format(refDate, 'yyyy-MM-dd') === todayStr && (
          <button
            className="btn btn-sm btn-ghost"
            onClick={logNoSpendToday}
            disabled={variable.some(v => v.date === todayStr && v.name === 'No spend day')}
          >
            {variable.some(v => v.date === todayStr && v.name === 'No spend day') ? 'No spend day logged ✓' : 'No spend today'}
          </button>
        )}
      </div>

      {/* Hero section */}
      <div className="card card-finance mb-6" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 28, padding: '24px 28px' }}>
        <div>
          <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Total spent {periodLabel}</p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.7rem, 8vw, 2.6rem)', fontWeight: 700, letterSpacing: '-0.02em' }}>£{periodTotal.toFixed(0)}</p>
        </div>
        <BudgetRing label="Budget" spent={periodTotal} budget={periodOverallBudget} size={120} />
        <div>
          <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Disposable income remaining</p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.5rem, 7vw, 2.2rem)', fontWeight: 700, letterSpacing: '-0.02em', color: disposableColor }}>£{periodTakeHome.toFixed(0)}</p>
          <p className="mono" style={{ fontSize: 11, color: disposableColor, marginTop: 4 }}>
            {periodOverallBudget > 0
              ? (periodTotal <= periodOverallBudget ? `£${(periodOverallBudget - periodTotal).toFixed(0)} left of budget` : `£${(periodTotal - periodOverallBudget).toFixed(0)} over budget`)
              : (periodTakeHome >= 0 ? `£${periodTakeHome.toFixed(0)} left ${periodLabel}` : `£${Math.abs(periodTakeHome).toFixed(0)} over budget ${periodLabel}`)}
          </p>
        </div>
      </div>

      {/* Income, fixed expenses & savings — always monthly, only shown in the Monthly view */}
      {activeView === 'monthly' && (
        <div className="mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {incomeCard}
          {fixedCard}
          {savingsCard}
        </div>
      )}

      {/* Net Worth section */}
      {(() => {
        const totalDebt = debts.reduce((s, d) => s + (parseFloat(d.current_balance) || 0), 0)
        const totalSavingsAccounts = savingsAccounts.reduce((s, a) => s + (parseFloat(a.current_balance) || 0), 0)
        const totalInvestments = investments.reduce((s, i) => s + (parseFloat(i.current_value) || 0), 0)
        const netWorth = totalSavingsAccounts + totalInvestments - totalDebt
        const DEBT_CATS = ['Credit Card', 'Loan', 'Overdraft', 'Borrowing', 'Other']
        const INV_TYPES = ['ISA', 'Pension', 'Stocks', 'Other']
        return (
          <div className="card mb-6" style={{ padding: '24px 28px' }}>
            {/* Net Worth headline */}
            <div style={{ marginBottom: 24 }}>
              <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Net Worth</p>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.7rem, 8vw, 2.6rem)', fontWeight: 700, letterSpacing: '-0.02em', color: netWorth >= 0 ? 'var(--finance)' : 'var(--danger)' }}>
                {netWorth < 0 ? '-' : ''}£{Math.abs(netWorth).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                £{totalSavingsAccounts.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} savings + £{totalInvestments.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} investments − £{totalDebt.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} debt
              </p>
            </div>

            {/* 3-column grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>

              {/* Debt column */}
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                  <h3 style={{ fontSize: '0.9rem' }}>Debt</h3>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: totalDebt > 0 ? 'var(--danger)' : 'var(--text-3)' }}>
                    £{totalDebt.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {totalDebt > 0 && (
                  <div style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--danger)' }}>
                    You have £{totalDebt.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in debt across {debts.length} account{debts.length !== 1 ? 's' : ''}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {debts.map(d => (
                    <div key={d.id} className="flex items-center justify-between gap-2">
                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        <p style={{ fontSize: 13 }}>{d.name}</p>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                          <span className="badge" style={{ fontSize: 10, background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)', borderRadius: 4, padding: '1px 6px' }}>{d.category}</span>
                          {d.interest_rate && <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{d.interest_rate}% APR</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>£{parseFloat(d.current_balance).toFixed(2)}</span>
                        <button className="btn-icon btn" onClick={() => deleteDebt(d.id)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                  {debts.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No debts tracked.</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <input placeholder="Debt name (e.g. Visa card)" value={newDebt.name} onChange={e => setNewDebt(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12 }} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <select value={newDebt.category} onChange={e => setNewDebt(p => ({ ...p, category: e.target.value }))} style={{ fontSize: 12 }}>
                      {DEBT_CATS.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <input type="text" inputMode="decimal" placeholder="Balance £" value={newDebt.current_balance} onChange={e => setNewDebt(p => ({ ...p, current_balance: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: '1 1 80px', minWidth: 70 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <input type="text" inputMode="decimal" placeholder="Original balance £ (opt)" value={newDebt.original_balance} onChange={e => setNewDebt(p => ({ ...p, original_balance: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: '1 1 100px' }} />
                    <input type="text" inputMode="decimal" placeholder="Interest % (opt)" value={newDebt.interest_rate} onChange={e => setNewDebt(p => ({ ...p, interest_rate: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: '1 1 80px' }} />
                    <input type="text" inputMode="decimal" placeholder="Min payment £ (opt)" value={newDebt.minimum_payment} onChange={e => setNewDebt(p => ({ ...p, minimum_payment: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: '1 1 80px' }} />
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={addDebt}><Plus size={12} /> Add debt</button>
                </div>
              </div>

              {/* Savings Accounts column */}
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                  <h3 style={{ fontSize: '0.9rem' }}>Savings</h3>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--finance)' }}>
                    £{totalSavingsAccounts.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {savingsAccounts.map(a => {
                    const bal = parseFloat(a.current_balance) || 0
                    const target = a.target_amount ? parseFloat(a.target_amount) : null
                    const pct = target ? Math.min(100, (bal / target) * 100) : null
                    const r = 16
                    const circ = 2 * Math.PI * r
                    return (
                      <div key={a.id} className="flex items-center justify-between gap-2">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                          {pct !== null && (
                            <svg width={40} height={40} style={{ flexShrink: 0 }}>
                              <circle cx={20} cy={20} r={r} fill="none" stroke="var(--border)" strokeWidth={3} />
                              <circle cx={20} cy={20} r={r} fill="none" stroke="var(--finance)" strokeWidth={3}
                                strokeDasharray={circ}
                                strokeDashoffset={circ * (1 - pct / 100)}
                                strokeLinecap="round"
                                transform="rotate(-90 20 20)"
                              />
                              <text x={20} y={24} textAnchor="middle" style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--text-3)' }}>{Math.round(pct)}%</text>
                            </svg>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13 }}>{a.name}</p>
                            {target && <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>target £{target.toLocaleString('en-GB')}{a.target_date ? ` by ${a.target_date}` : ''}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                          <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--finance)' }}>£{bal.toFixed(2)}</span>
                          <button className="btn-icon btn" onClick={() => deleteSavingsAccount(a.id)}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    )
                  })}
                  {savingsAccounts.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No savings accounts tracked.</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <input placeholder="Account name (e.g. Emergency fund)" value={newSavingsAccount.name} onChange={e => setNewSavingsAccount(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12 }} />
                  <input type="text" inputMode="decimal" placeholder="Current balance £" value={newSavingsAccount.current_balance} onChange={e => setNewSavingsAccount(p => ({ ...p, current_balance: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12 }} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <input type="text" inputMode="decimal" placeholder="Target amount £ (opt)" value={newSavingsAccount.target_amount} onChange={e => setNewSavingsAccount(p => ({ ...p, target_amount: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: '1 1 120px' }} />
                    <input type="date" placeholder="Target date (opt)" value={newSavingsAccount.target_date} onChange={e => setNewSavingsAccount(p => ({ ...p, target_date: e.target.value }))} style={{ fontSize: 12, flex: '1 1 120px' }} />
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={addSavingsAccount}><Plus size={12} /> Add savings account</button>
                </div>
              </div>

              {/* Investments column */}
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                  <h3 style={{ fontSize: '0.9rem' }}>Investments</h3>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--career)' }}>
                    £{totalInvestments.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {investments.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between gap-2">
                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        <p style={{ fontSize: 13 }}>{inv.name}</p>
                        <span className="badge" style={{ fontSize: 10, background: 'color-mix(in srgb, var(--career) 12%, transparent)', color: 'var(--career)', border: '1px solid color-mix(in srgb, var(--career) 25%, transparent)', borderRadius: 4, padding: '1px 6px', display: 'inline-block', marginTop: 2 }}>{inv.type}</span>
                      </div>
                      <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--career)' }}>£{parseFloat(inv.current_value).toFixed(2)}</span>
                        <button className="btn-icon btn" onClick={() => deleteInvestment(inv.id)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                  {investments.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No investments tracked.</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <input placeholder="Investment name (e.g. Vanguard ISA)" value={newInvestment.name} onChange={e => setNewInvestment(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12 }} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <select value={newInvestment.type} onChange={e => setNewInvestment(p => ({ ...p, type: e.target.value }))} style={{ fontSize: 12 }}>
                      {INV_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                    <input type="text" inputMode="decimal" placeholder="Current value £" value={newInvestment.current_value} onChange={e => setNewInvestment(p => ({ ...p, current_value: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: '1 1 100px' }} />
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={addInvestment}><Plus size={12} /> Add investment</button>
                </div>
              </div>

            </div>
          </div>
        )
      })()}

      {/* Customisable card grid */}
      {editing && (
        <div className="mb-4">
          <AddWidgetMenu available={available} onAdd={addCard} />
        </div>
      )}
      <DraggableCardList cardOrder={order} onReorder={saveCardOrder}>
        {order.map(({ id, size }) => (
          <SortableCard
            key={id}
            id={id}
            size={size}
            editing={editing}
            onResize={s => resizeCard(id, s)}
            onRemove={() => removeCard(id)}
          >
            {CARDS[id] || null}
          </SortableCard>
        ))}
      </DraggableCardList>

      <QuickAddFab onAdd={addVariableQuick} />
    </div>
  )
}
