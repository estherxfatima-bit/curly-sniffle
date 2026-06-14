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
import { VARIABLE_CATS, CAT_COLORS, CAT_EMOJI, toMonthly, shouldShowSpendingReminder, isReminderDismissedToday, dismissReminderToday } from '../lib/financeUtils'
import PeriodNav from '../components/ui/PeriodNav'
import { getCurrentPeriodBounds, getTrailingBounds } from '../lib/periodNav'
import { Plus, Trash2, Sparkles, Pencil, Check as CheckIcon, X as XIcon } from 'lucide-react'

const TAX_RATE = 0.25 // 25% tax pot estimate for self-employed

const EXPENSE_CATS = ['Housing', 'Transport', 'Food', 'Subscriptions', 'Health', 'Education', 'Entertainment', 'Other']
const FREQUENCIES = ['monthly', 'weekly', 'annual', 'one-off']

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
  const [budgets, setBudgets]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState('')

  // New item forms
  const [newIncome, setNewIncome]     = useState({ name: '', amount: '', frequency: 'monthly', is_self_employed: false })
  const [newFixed, setNewFixed]       = useState({ name: '', amount: '', category: 'Other' })
  const [newVariable, setNewVariable] = useState({ name: '', amount: '', category: 'Other', date: new Date().toISOString().slice(0, 10) })

  // Card layout
  const [cardOrder, setCardOrder] = useState(null)
  const [editing, setEditing] = useState(false)

  // Budget editing
  const [editingBudgets, setEditingBudgets] = useState(false)
  const [budgetInputs, setBudgetInputs] = useState({})

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
    const [incRes, fixRes, varRes, budRes, layoutRes] = await Promise.all([
      supabase.from('income_sources').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('fixed_expenses').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('variable_expenses').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('budgets').select('*').eq('user_id', user.id),
      supabase.from('dashboard_layout').select('card_order').eq('user_id', user.id).eq('view', 'finance').maybeSingle(),
    ])
    setIncome(incRes.data || [])
    setFixed(fixRes.data || [])
    setVariable(varRes.data || [])
    setBudgets(budRes.data || [])
    setCardOrder(normalizeOrder(layoutRes.data?.card_order))
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
  const varThisMonth  = variable.filter(v => v.date.startsWith(thisMonth))
  const totalVariable = varThisMonth.reduce((s, i) => s + i.amount, 0)
  const takeHome      = totalIncome - taxPot - totalFixed - totalVariable

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
  const monthlyDisposableBase = totalIncome - taxPot - totalFixed
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
          <div key={i.id} className="flex items-center justify-between gap-2">
            <div>
              <p style={{ fontSize: 13 }}>{i.name}</p>
              <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>
                £{i.amount.toFixed(2)} / {i.frequency}{i.is_self_employed ? ' · self-emp' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--finance)', fontWeight: 500 }}>
                £{toMonthly(i.amount, i.frequency).toFixed(0)}/mo
              </span>
              <button className="btn-icon btn" onClick={() => deleteIncome(i.id)}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <input placeholder="Source name" value={newIncome.name} onChange={e => setNewIncome(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="Amount £" value={newIncome.amount} onChange={e => setNewIncome(p => ({ ...p, amount: e.target.value }))} style={{ fontSize: 12, flex: 1 }} />
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
          <div key={i.id} className="flex items-center justify-between gap-2">
            <div>
              <p style={{ fontSize: 13 }}>{i.name}</p>
              <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{i.category}</p>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>£{i.amount.toFixed(2)}</span>
              <button className="btn-icon btn" onClick={() => deleteFixed(i.id)}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <input placeholder="Expense name" value={newFixed.name} onChange={e => setNewFixed(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="Amount £" value={newFixed.amount} onChange={e => setNewFixed(p => ({ ...p, amount: e.target.value }))} style={{ fontSize: 12, flex: 1 }} />
          <select value={newFixed.category} onChange={e => setNewFixed(p => ({ ...p, category: e.target.value }))} style={{ fontSize: 12 }}>
            {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={addFixed}><Plus size={12} /> Add fixed expense</button>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            <div onClick={e => e.stopPropagation()}>
              <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Overall monthly limit</label>
              <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="£" value={budgetInputs.overall || ''} onChange={e => setBudgetInputs(p => ({ ...p, overall: e.target.value }))} style={{ fontSize: 12, width: '100%' }} />
            </div>
            {VARIABLE_CATS.map(cat => (
              <div key={cat} onClick={e => e.stopPropagation()}>
                <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>{CAT_EMOJI[cat]} {cat}</label>
                <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="£" value={budgetInputs[cat] || ''} onChange={e => setBudgetInputs(p => ({ ...p, [cat]: e.target.value }))} style={{ fontSize: 12, width: '100%' }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {VARIABLE_CATS.map(cat => (
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
          <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="£" value={newVariable.amount} onChange={e => setNewVariable(p => ({ ...p, amount: e.target.value }))} style={{ fontSize: 12, width: 80 }} />
          <select value={newVariable.category} onChange={e => setNewVariable(p => ({ ...p, category: e.target.value }))} style={{ fontSize: 12 }}>
            {VARIABLE_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
          <input type="date" value={newVariable.date} onChange={e => setNewVariable(p => ({ ...p, date: e.target.value }))} style={{ fontSize: 12 }} />
          <button className="btn btn-sm btn-ghost" onClick={addVariable}><Plus size={12} /> Add</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={e => e.stopPropagation()}>
          {filteredVariable.slice(0, 20).map(i => (
            <div key={i.id} className="flex items-center justify-between gap-2" style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--text-2)' }}>{CAT_EMOJI[i.category] || '📦'} {i.name}</span>
              <div className="flex items-center gap-3">
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{i.category} · {i.date}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>£{i.amount.toFixed(2)}</span>
                <button className="btn-icon btn" onClick={() => deleteVariable(i.id)}><Trash2 size={12} /></button>
              </div>
            </div>
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
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '2.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>£{periodTotal.toFixed(0)}</p>
        </div>
        <BudgetRing label="Budget" spent={periodTotal} budget={periodOverallBudget} size={120} />
        <div>
          <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Disposable income remaining</p>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.02em', color: disposableColor }}>£{periodTakeHome.toFixed(0)}</p>
          <p className="mono" style={{ fontSize: 11, color: disposableColor, marginTop: 4 }}>
            {periodOverallBudget > 0
              ? (periodTotal <= periodOverallBudget ? `£${(periodOverallBudget - periodTotal).toFixed(0)} left of budget` : `£${(periodTotal - periodOverallBudget).toFixed(0)} over budget`)
              : (periodTakeHome >= 0 ? `£${periodTakeHome.toFixed(0)} left ${periodLabel}` : `£${Math.abs(periodTakeHome).toFixed(0)} over budget ${periodLabel}`)}
          </p>
        </div>
      </div>

      {/* Income & Fixed expenses — always monthly, only shown in the Monthly view */}
      {activeView === 'monthly' && (
        <div className="mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {incomeCard}
          {fixedCard}
        </div>
      )}

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
