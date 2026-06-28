import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { format, subWeeks, subDays, subMonths, endOfWeek, getDaysInMonth } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { generateFinanceSummary, generateDebtAllocationRecommendation } from '../lib/aiLog'
import ArcRing from '../components/ui/ArcRing'
import BudgetRing from '../components/finance/BudgetRing'
import QuickAddFab from '../components/finance/QuickAddFab'
import SpendingReminderBanner from '../components/finance/SpendingReminderBanner'
import { SortableCard, DraggableCardList } from '../components/dashboard/DraggableCard'
import AddWidgetMenu from '../components/dashboard/AddWidgetMenu'
import { VARIABLE_CATS, CAT_COLORS, CAT_EMOJI, toMonthly, sanitizeAmountInput, shouldShowSpendingReminder, isReminderDismissedToday, dismissReminderToday } from '../lib/financeUtils'
import PeriodNav from '../components/ui/PeriodNav'
import { getCurrentPeriodBounds, getTrailingBounds } from '../lib/periodNav'
import useLockBodyScroll from '../hooks/useLockBodyScroll'
import { Plus, Trash2, Sparkles, Pencil, Check as CheckIcon, X as XIcon, AlertCircle } from 'lucide-react'

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
  const [moneyOwed, setMoneyOwed] = useState([])
  const [newMoneyOwed, setNewMoneyOwed] = useState({ person: '', amount: '', note: '', date: new Date().toISOString().slice(0, 10) })
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

  // Detail panels
  const [selectedDebt, setSelectedDebt]               = useState(null)
  const [selectedSavingsAccount, setSelectedSavingsAccount] = useState(null)
  const [selectedInvestment, setSelectedInvestment]   = useState(null)
  useLockBodyScroll(!!(selectedDebt || selectedSavingsAccount || selectedInvestment))
  const [debtRepayments, setDebtRepayments]           = useState({}) // { debtId: [...] }
  const [savingsTxns, setSavingsTxns]                 = useState({}) // { accountId: [...] }
  const [investmentTxns, setInvestmentTxns]           = useState({}) // { investmentId: [...] }
  const [newRepayment, setNewRepayment]               = useState({ amount: '', date: new Date().toISOString().slice(0, 10), note: '' })
  const [newSavingsTxn, setNewSavingsTxn]             = useState({ type: 'contribution', amount: '', date: new Date().toISOString().slice(0, 10), note: '' })
  const [allocatingSavingsId, setAllocatingSavingsId] = useState(null)
  const [allocationSplits, setAllocationSplits]       = useState({})
  const [newInvestmentTxn, setNewInvestmentTxn]       = useState({ type: 'contribution', amount: '', date: new Date().toISOString().slice(0, 10), note: '' })
  const [editingDebt, setEditingDebt]                 = useState(null)
  const [editDebtDraft, setEditDebtDraft]             = useState({})
  const [editingSavingsAcc, setEditingSavingsAcc]     = useState(null)
  const [editSavingsAccDraft, setEditSavingsAccDraft] = useState({})
  const [editingInvestment, setEditingInvestment]     = useState(null)
  const [editInvestmentDraft, setEditInvestmentDraft] = useState({})
  const [pendingTxns, setPendingTxns]                 = useState([])
  // Allocate to debt
  const [showAllocateDebt, setShowAllocateDebt]       = useState(false)
  const [allocateDebtId, setAllocateDebtId]           = useState('')
  const [allocateDebtAmount, setAllocateDebtAmount]   = useState('')
  const [allocateDebtNote, setAllocateDebtNote]       = useState('')
  const [allocateDebtBudgetType, setAllocateDebtBudgetType] = useState('none')
  const [debtRecommendation, setDebtRecommendation]   = useState('')
  const [debtRecLoading, setDebtRecLoading]           = useState(false)
  const [allocateSuggestions, setAllocateSuggestions] = useState([])
  const [showAllocateSuggest, setShowAllocateSuggest] = useState(false)

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
    const [incRes, fixRes, varRes, savRes, budRes, layoutRes, prefRes, debtsRes, savAccRes, invRes, owedRes] = await Promise.all([
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
      supabase.from('money_owed').select('*').eq('user_id', user.id).order('date', { ascending: false }),
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
    setMoneyOwed(owedRes.data || [])
    // Pending savings transactions older than 3 days
    const threeDaysAgo = format(subDays(new Date(), 3), 'yyyy-MM-dd')
    const { data: pendingData } = await supabase
      .from('savings_transactions')
      .select('*, savings_accounts(name)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .lt('date', threeDaysAgo)
    setPendingTxns(pendingData || [])
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

  // Money owed to me
  async function addMoneyOwed() {
    if (!newMoneyOwed.person || !newMoneyOwed.amount) return
    const { data } = await supabase.from('money_owed').insert({
      user_id: user.id, person: newMoneyOwed.person, amount: parseFloat(newMoneyOwed.amount),
      note: newMoneyOwed.note || null, date: newMoneyOwed.date,
    }).select().single()
    setMoneyOwed(prev => [data, ...prev])
    setNewMoneyOwed({ person: '', amount: '', note: '', date: new Date().toISOString().slice(0, 10) })
  }
  async function toggleMoneyOwedSettled(id, settled) {
    const { data } = await supabase.from('money_owed')
      .update({ settled, settled_at: settled ? new Date().toISOString() : null })
      .eq('id', id).select().single()
    setMoneyOwed(prev => prev.map(i => i.id === id ? data : i))
  }
  async function deleteMoneyOwed(id) {
    await supabase.from('money_owed').delete().eq('id', id)
    setMoneyOwed(prev => prev.filter(i => i.id !== id))
  }

  // Net worth CRUD
  async function addDebt() {
    if (!newDebt.name || !newDebt.current_balance) return
    const bal = parseFloat(newDebt.current_balance)
    const payload = {
      user_id: user.id, name: newDebt.name, category: newDebt.category, current_balance: bal,
      original_balance: newDebt.original_balance ? parseFloat(newDebt.original_balance) : bal,
      interest_rate: newDebt.interest_rate ? parseFloat(newDebt.interest_rate) : null,
      minimum_payment: newDebt.minimum_payment ? parseFloat(newDebt.minimum_payment) : null,
    }
    const { data, error } = await supabase.from('debts').insert(payload).select().single()
    if (error) { alert(`Couldn't add debt: ${error.message}`); return }
    setDebts(prev => [...prev, data])
    setNewDebt({ name: '', category: 'Other', current_balance: '', original_balance: '', interest_rate: '', minimum_payment: '' })
  }
  async function deleteDebt(id) {
    await supabase.from('debts').delete().eq('id', id)
    setDebts(prev => prev.filter(i => i.id !== id))
  }

  async function addSavingsAccount() {
    if (!newSavingsAccount.name || !newSavingsAccount.current_balance) return
    const startBal = parseFloat(newSavingsAccount.current_balance)
    const payload = {
      user_id: user.id,
      name: newSavingsAccount.name,
      current_balance: startBal,
      starting_balance: startBal,
      target_amount: newSavingsAccount.target_amount ? parseFloat(newSavingsAccount.target_amount) : null,
      target_date: newSavingsAccount.target_date || null,
    }
    const { data, error } = await supabase.from('savings_accounts').insert(payload).select().single()
    if (error) { alert(`Couldn't add savings account: ${error.message}`); return }
    setSavingsAccounts(prev => [...prev, data])
    setNewSavingsAccount({ name: '', current_balance: '', target_amount: '', target_date: '' })
  }
  async function deleteSavingsAccount(id) {
    await supabase.from('savings_accounts').delete().eq('id', id)
    setSavingsAccounts(prev => prev.filter(i => i.id !== id))
  }

  async function addInvestment() {
    if (!newInvestment.name || !newInvestment.current_value) return
    const startVal = parseFloat(newInvestment.current_value)
    const payload = {
      user_id: user.id, name: newInvestment.name, type: newInvestment.type,
      current_value: startVal, starting_value: startVal,
    }
    const { data, error } = await supabase.from('investments').insert(payload).select().single()
    if (error) { alert(`Couldn't add investment: ${error.message}`); return }
    setInvestments(prev => [...prev, data])
    setNewInvestment({ name: '', type: 'Other', current_value: '' })
  }
  async function deleteInvestment(id) {
    await supabase.from('investments').delete().eq('id', id)
    setInvestments(prev => prev.filter(i => i.id !== id))
  }

  // ── Net worth snapshot ────────────────────────────────────────
  async function recordNetWorthSnapshot(overrides = {}) {
    const totalSav = (overrides.savingsAccounts ?? savingsAccounts).reduce((s, a) => s + (a.current_balance || 0), 0)
    const totalInv = (overrides.investments ?? investments).reduce((s, i) => s + (i.current_value || 0), 0)
    const totalDbt = (overrides.debts ?? debts).reduce((s, d) => s + (d.current_balance || 0), 0)
    await supabase.from('net_worth_entries').insert({
      user_id: user.id, date: new Date().toISOString().slice(0, 10),
      total_savings: totalSav, total_investments: totalInv,
      total_debt: totalDbt, net_worth: totalSav + totalInv - totalDbt,
    })
  }

  // ── Debt repayments ───────────────────────────────────────────
  async function loadDebtRepayments(debtId) {
    const { data } = await supabase.from('debt_repayments').select('*').eq('debt_id', debtId).order('date', { ascending: false })
    setDebtRepayments(prev => ({ ...prev, [debtId]: data || [] }))
  }
  async function logRepayment(debtId, amount, date, note) {
    const { data: rep } = await supabase.from('debt_repayments').insert({
      user_id: user.id, debt_id: debtId, amount, date, note: note || null,
    }).select().single()
    const debt = debts.find(d => d.id === debtId)
    const newBal = Math.max(0, (debt?.current_balance || 0) - amount)
    await supabase.from('debts').update({ current_balance: newBal, updated_at: new Date().toISOString() }).eq('id', debtId)
    const updatedDebts = debts.map(d => d.id === debtId ? { ...d, current_balance: newBal } : d)
    setDebts(updatedDebts)
    setDebtRepayments(prev => ({ ...prev, [debtId]: [rep, ...(prev[debtId] || [])] }))
    await recordNetWorthSnapshot({ debts: updatedDebts })
  }
  async function saveEditDebt() {
    if (!editingDebt) return
    const payload = {
      name: editDebtDraft.name, category: editDebtDraft.category,
      current_balance: parseFloat(editDebtDraft.current_balance) || 0,
      original_balance: editDebtDraft.original_balance ? parseFloat(editDebtDraft.original_balance) : null,
      interest_rate: editDebtDraft.interest_rate ? parseFloat(editDebtDraft.interest_rate) : null,
      minimum_payment: editDebtDraft.minimum_payment ? parseFloat(editDebtDraft.minimum_payment) : null,
      target_payoff_date: editDebtDraft.target_payoff_date || null,
      target_monthly_payment: editDebtDraft.target_monthly_payment ? parseFloat(editDebtDraft.target_monthly_payment) : null,
      warning_threshold: editDebtDraft.warning_threshold ? parseFloat(editDebtDraft.warning_threshold) : null,
      due_day: editDebtDraft.due_day ? Math.min(31, Math.max(1, parseInt(editDebtDraft.due_day, 10))) : null,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('debts').update(payload).eq('id', editingDebt)
    setDebts(prev => prev.map(d => d.id === editingDebt ? { ...d, ...payload } : d))
    setSelectedDebt(prev => prev ? { ...prev, ...payload } : null)
    setEditingDebt(null)
  }

  // ── Savings transactions ──────────────────────────────────────
  async function loadSavingsTxns(accountId) {
    const { data } = await supabase.from('savings_transactions').select('*').eq('account_id', accountId).order('date', { ascending: false })
    setSavingsTxns(prev => ({ ...prev, [accountId]: data || [] }))
  }
  async function logSavingsTxn(accountId) {
    if (!newSavingsTxn.amount) return
    if (newSavingsTxn.type === 'set_balance') {
      const account = savingsAccounts.find(a => a.id === accountId)
      const target = parseFloat(newSavingsTxn.amount)
      const delta = target - (account?.current_balance || 0)
      if (delta === 0) return
      if (delta < 0 && !newSavingsTxn.note.trim()) { alert('Add a note explaining why the balance decreased.'); return }
      const { data: txn } = await supabase.from('savings_transactions').insert({
        user_id: user.id, account_id: accountId, type: delta > 0 ? 'contribution' : 'withdrawal',
        amount: Math.abs(delta), date: newSavingsTxn.date,
        note: newSavingsTxn.note || null, status: 'confirmed',
      }).select().single()
      await supabase.from('savings_accounts').update({ current_balance: target, updated_at: new Date().toISOString() }).eq('id', accountId)
      const updatedAccounts = savingsAccounts.map(a => a.id === accountId ? { ...a, current_balance: target } : a)
      setSavingsAccounts(updatedAccounts)
      setSavingsTxns(prev => ({ ...prev, [accountId]: [txn, ...(prev[accountId] || [])] }))
      if (selectedSavingsAccount?.id === accountId) setSelectedSavingsAccount(prev => ({ ...prev, current_balance: target }))
      await recordNetWorthSnapshot({ savingsAccounts: updatedAccounts })
      setNewSavingsTxn({ type: 'contribution', amount: '', date: new Date().toISOString().slice(0, 10), note: '' })
      return
    }
    if (newSavingsTxn.type === 'withdrawal' && !newSavingsTxn.note.trim()) { alert('Add a note explaining why the balance decreased.'); return }
    const { data: txn } = await supabase.from('savings_transactions').insert({
      user_id: user.id, account_id: accountId, type: newSavingsTxn.type,
      amount: parseFloat(newSavingsTxn.amount), date: newSavingsTxn.date,
      note: newSavingsTxn.note || null, status: 'pending',
    }).select().single()
    setSavingsTxns(prev => ({ ...prev, [accountId]: [txn, ...(prev[accountId] || [])] }))
    setNewSavingsTxn({ type: 'contribution', amount: '', date: new Date().toISOString().slice(0, 10), note: '' })
  }

  // ── Monthly savings allocation split across accounts ──────────
  function openAllocateSplit(item) {
    setAllocatingSavingsId(item.id)
    const even = savingsAccounts.length ? item.amount / savingsAccounts.length : 0
    setAllocationSplits(Object.fromEntries(savingsAccounts.map(a => [a.id, even ? even.toFixed(2) : ''])))
  }
  function closeAllocateSplit() {
    setAllocatingSavingsId(null)
    setAllocationSplits({})
  }
  async function confirmAllocateSplit(item) {
    const entries = Object.entries(allocationSplits).filter(([, v]) => parseFloat(v) > 0)
    const sum = entries.reduce((s, [, v]) => s + parseFloat(v), 0)
    if (entries.length === 0) return
    if (Math.abs(sum - item.amount) > 0.01) {
      alert(`Split must add up to £${item.amount.toFixed(2)} (currently £${sum.toFixed(2)})`)
      return
    }
    let updatedAccounts = savingsAccounts
    const today = new Date().toISOString().slice(0, 10)
    for (const [accountId, v] of entries) {
      const amount = parseFloat(v)
      await supabase.from('savings_transactions').insert({
        user_id: user.id, account_id: accountId, type: 'contribution', amount, date: today,
        note: `Monthly allocation: ${item.name}`, status: 'confirmed',
      })
      const newBal = (updatedAccounts.find(a => a.id === accountId)?.current_balance || 0) + amount
      updatedAccounts = updatedAccounts.map(a => a.id === accountId ? { ...a, current_balance: newBal } : a)
      await supabase.from('savings_accounts').update({ current_balance: newBal, updated_at: new Date().toISOString() }).eq('id', accountId)
    }
    setSavingsAccounts(updatedAccounts)
    await recordNetWorthSnapshot({ savingsAccounts: updatedAccounts })
    closeAllocateSplit()
  }
  async function confirmSavingsTxn(txn) {
    await supabase.from('savings_transactions').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', txn.id)
    const account = savingsAccounts.find(a => a.id === txn.account_id)
    const delta = txn.type === 'contribution' ? txn.amount : -txn.amount
    const newBal = (account?.current_balance || 0) + delta
    await supabase.from('savings_accounts').update({ current_balance: newBal, updated_at: new Date().toISOString() }).eq('id', txn.account_id)
    const updatedAccounts = savingsAccounts.map(a => a.id === txn.account_id ? { ...a, current_balance: newBal } : a)
    setSavingsAccounts(updatedAccounts)
    setSavingsTxns(prev => ({ ...prev, [txn.account_id]: (prev[txn.account_id] || []).map(t => t.id === txn.id ? { ...t, status: 'confirmed' } : t) }))
    setPendingTxns(prev => prev.filter(t => t.id !== txn.id))
    if (selectedSavingsAccount?.id === txn.account_id) setSelectedSavingsAccount(prev => ({ ...prev, current_balance: newBal }))
    await recordNetWorthSnapshot({ savingsAccounts: updatedAccounts })
  }
  async function cancelSavingsTxn(txn) {
    await supabase.from('savings_transactions').delete().eq('id', txn.id)
    setSavingsTxns(prev => ({ ...prev, [txn.account_id]: (prev[txn.account_id] || []).filter(t => t.id !== txn.id) }))
    setPendingTxns(prev => prev.filter(t => t.id !== txn.id))
  }
  async function saveEditSavingsAcc() {
    if (!editingSavingsAcc) return
    const payload = {
      name: editSavingsAccDraft.name,
      target_amount: editSavingsAccDraft.target_amount ? parseFloat(editSavingsAccDraft.target_amount) : null,
      target_date: editSavingsAccDraft.target_date || null,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('savings_accounts').update(payload).eq('id', editingSavingsAcc)
    setSavingsAccounts(prev => prev.map(a => a.id === editingSavingsAcc ? { ...a, ...payload } : a))
    setSelectedSavingsAccount(prev => prev ? { ...prev, ...payload } : null)
    setEditingSavingsAcc(null)
  }

  // ── Investment transactions ───────────────────────────────────
  async function loadInvestmentTxns(investmentId) {
    const { data } = await supabase.from('investment_transactions').select('*').eq('investment_id', investmentId).order('date', { ascending: false })
    setInvestmentTxns(prev => ({ ...prev, [investmentId]: data || [] }))
  }
  async function logInvestmentTxn(investmentId) {
    if (!newInvestmentTxn.amount) return
    const { data: txn } = await supabase.from('investment_transactions').insert({
      user_id: user.id, investment_id: investmentId, type: newInvestmentTxn.type,
      amount: parseFloat(newInvestmentTxn.amount), date: newInvestmentTxn.date,
      note: newInvestmentTxn.note || null, status: 'pending',
    }).select().single()
    setInvestmentTxns(prev => ({ ...prev, [investmentId]: [txn, ...(prev[investmentId] || [])] }))
    setNewInvestmentTxn({ type: 'contribution', amount: '', date: new Date().toISOString().slice(0, 10), note: '' })
  }
  async function confirmInvestmentTxn(txn) {
    await supabase.from('investment_transactions').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', txn.id)
    const inv = investments.find(i => i.id === txn.investment_id)
    const delta = txn.type === 'contribution' ? txn.amount : -txn.amount
    const newVal = (inv?.current_value || 0) + delta
    await supabase.from('investments').update({ current_value: newVal, updated_at: new Date().toISOString() }).eq('id', txn.investment_id)
    const updatedInvestments = investments.map(i => i.id === txn.investment_id ? { ...i, current_value: newVal } : i)
    setInvestments(updatedInvestments)
    setInvestmentTxns(prev => ({ ...prev, [txn.investment_id]: (prev[txn.investment_id] || []).map(t => t.id === txn.id ? { ...t, status: 'confirmed' } : t) }))
    if (selectedInvestment?.id === txn.investment_id) setSelectedInvestment(prev => ({ ...prev, current_value: newVal }))
    await recordNetWorthSnapshot({ investments: updatedInvestments })
  }
  async function cancelInvestmentTxn(txn) {
    await supabase.from('investment_transactions').delete().eq('id', txn.id)
    setInvestmentTxns(prev => ({ ...prev, [txn.investment_id]: (prev[txn.investment_id] || []).filter(t => t.id !== txn.id) }))
  }
  async function saveEditInvestment() {
    if (!editingInvestment) return
    const payload = { name: editInvestmentDraft.name, type: editInvestmentDraft.type, updated_at: new Date().toISOString() }
    await supabase.from('investments').update(payload).eq('id', editingInvestment)
    setInvestments(prev => prev.map(i => i.id === editingInvestment ? { ...i, ...payload } : i))
    setSelectedInvestment(prev => prev ? { ...prev, ...payload } : null)
    setEditingInvestment(null)
  }

  // ── Allocate to debt ──────────────────────────────────────────
  async function confirmDebtAllocation() {
    if (!allocateDebtId || !allocateDebtAmount) return
    const amt = parseFloat(allocateDebtAmount)
    const today = new Date().toISOString().slice(0, 10)
    await logRepayment(allocateDebtId, amt, today, allocateDebtNote || null)
    await tagDebtPaymentAsBudgetExpense(allocateDebtId, amt, today)
    setShowAllocateDebt(false); setAllocateDebtId(''); setAllocateDebtAmount(''); setAllocateDebtNote(''); setAllocateDebtBudgetType('none')
  }

  // Tag a debt repayment as a fixed or variable budget expense, so it shows up against the monthly budget.
  async function tagDebtPaymentAsBudgetExpense(debtId, amount, date) {
    if (allocateDebtBudgetType === 'none') return
    const debtName = debts.find(d => d.id === debtId)?.name || 'Debt'
    if (allocateDebtBudgetType === 'fixed') {
      const { data } = await supabase.from('fixed_expenses').insert({
        user_id: user.id, name: `${debtName} repayment`, amount, category: 'Other',
      }).select().single()
      if (data) setFixed(prev => [...prev, data])
    } else if (allocateDebtBudgetType === 'variable') {
      const { data } = await supabase.from('variable_expenses').insert({
        user_id: user.id, name: `${debtName} repayment`, amount, category: 'Other', date,
      }).select().single()
      if (data) setVariable(prev => [data, ...prev])
    }
  }

  async function runDebtRecommendation() {
    setDebtRecLoading(true)
    try {
      const byMonth = {}
      variable.forEach(v => {
        const key = v.date.slice(0, 7)
        byMonth[key] = (byMonth[key] || 0) + v.amount
      })
      const recentMonths = Object.entries(byMonth)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(1, 4) // exclude current month, take up to 3 prior
        .map(([key, total]) => ({ label: format(new Date(`${key}-01`), 'MMM yyyy'), total }))
      const rec = await generateDebtAllocationRecommendation(user.id, {
        debts, takeHome, totalIncome, totalFixed, totalVariable, recentMonths,
      })
      setDebtRecommendation(rec)
    } catch (e) {
      setDebtRecommendation('Recommendation unavailable — Claude API key not configured.')
    } finally {
      setDebtRecLoading(false)
    }
  }
  function suggestAllocations() {
    const disposable = periodTakeHome
    if (disposable <= 0 || !debts.length) return
    const sorted = [...debts].sort((a, b) => (b.interest_rate || 0) - (a.interest_rate || 0))
    let remaining = disposable
    const suggestions = []
    for (const d of sorted) {
      if (remaining <= 0) break
      const alloc = Math.min(remaining, d.current_balance)
      if (alloc > 0) { suggestions.push({ debtId: d.id, name: d.name, amount: alloc.toFixed(2) }); remaining -= alloc }
    }
    setAllocateSuggestions(suggestions)
    setShowAllocateSuggest(true)
  }
  async function confirmSuggestedAllocations() {
    for (const s of allocateSuggestions) {
      const amt = parseFloat(s.amount)
      if (!amt || amt <= 0) continue
      await logRepayment(s.debtId, amt, new Date().toISOString().slice(0, 10), 'Auto-allocated')
    }
    setShowAllocateSuggest(false); setAllocateSuggestions([])
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
  const totalOwedToMe = moneyOwed.filter(o => !o.settled).reduce((s, o) => s + o.amount, 0)
  const takeHome      = totalIncome - taxPot - totalFixed - totalSavings - totalVariable + totalOwedToMe

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
  const monthlyDisposableBase = totalIncome - taxPot - totalFixed - totalSavings + totalOwedToMe
  const periodIncome = totalIncome * BUDGET_SCALE[activeView]
  const periodDisposableAllowance = monthlyDisposableBase * BUDGET_SCALE[activeView]
  const periodTakeHome = periodDisposableAllowance - periodTotal

  // Disposable income colour: red if overspent, amber if thin margin, else green
  const disposablePct = periodIncome > 0 ? (periodTakeHome / periodIncome) * 100 : (periodTakeHome >= 0 ? 100 : -1)
  const disposableColor = periodTakeHome < 0 ? 'var(--danger)' : disposablePct < 15 ? 'var(--warning)' : 'var(--success)'

  // Net worth
  const totalSavingsBalance   = savingsAccounts.reduce((s, a) => s + (a.current_balance || 0), 0)
  const totalInvestmentsValue = investments.reduce((s, i) => s + (i.current_value || 0), 0)
  const totalDebtBalance      = debts.reduce((s, d) => s + (d.current_balance || 0), 0)
  const netWorth = totalSavingsBalance + totalInvestmentsValue - totalDebtBalance

  // Financial health score (monthly view)
  const budgetCatsWithBudget = VARIABLE_CATS.filter(c => (categoryBudget[c] || 0) > 0)
  const catsInBudget         = budgetCatsWithBudget.filter(c => (categorySpend[c] || 0) <= (categoryBudget[c] || 0)).length
  const budgetAdherence      = budgetCatsWithBudget.length > 0 ? catsInBudget / budgetCatsWithBudget.length : 0.5
  const savingsRatePct       = totalIncome > 0 ? Math.min(1, totalSavings / totalIncome) : 0
  const thisMonthRepayments  = Object.values(debtRepayments).flat().filter(r => r.date?.startsWith(thisMonth)).reduce((s, r) => s + r.amount, 0)
  const debtTrendScore       = totalDebtBalance === 0 ? 1 : thisMonthRepayments > 0 ? 0.75 : 0.3
  const healthScore  = Math.round(budgetAdherence * 40 + savingsRatePct * 100 * 0.3 + debtTrendScore * 30)
  const healthLabel  = healthScore >= 80 ? 'Strong month' : healthScore >= 60 ? 'Steady' : healthScore >= 40 ? 'Worth a look' : 'Needs attention'
  const healthColor  = healthScore >= 80 ? 'var(--success)' : healthScore >= 60 ? 'var(--finance)' : healthScore >= 40 ? 'var(--warning)' : 'var(--danger)'
  const healthSummary = `Stayed within budget on ${catsInBudget}/${budgetCatsWithBudget.length || 0} categories, saved ${(savingsRatePct * 100).toFixed(0)}% of income${thisMonthRepayments > 0 ? `, made £${thisMonthRepayments.toFixed(0)} in debt repayments` : ''}.`

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
            <div key={i.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="flex items-center justify-between gap-2">
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <p style={{ fontSize: 13 }}>{i.name}</p>
                  <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{i.kind} · {i.frequency}</p>
                </div>
                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    £{toMonthly(i.amount, i.frequency).toFixed(0)}/mo
                  </span>
                  {i.kind === 'Savings' && savingsAccounts.length > 0 && (
                    <button className="btn btn-sm btn-ghost" style={{ fontSize: 11 }} onClick={() => allocatingSavingsId === i.id ? closeAllocateSplit() : openAllocateSplit(i)}>
                      {allocatingSavingsId === i.id ? 'Cancel' : 'Allocate'}
                    </button>
                  )}
                  <button className="btn-icon btn" onClick={() => startEdit('savings', i)}><Pencil size={12} /></button>
                  <button className="btn-icon btn" onClick={() => deleteSavings(i.id)}><Trash2 size={12} /></button>
                </div>
              </div>
              {allocatingSavingsId === i.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, background: 'var(--bg-2)', borderRadius: 8 }}>
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Split this month's £{i.amount.toFixed(2)} contribution across your savings pots, then confirm to update balances.
                  </p>
                  {savingsAccounts.map(acc => (
                    <div key={acc.id} className="flex items-center gap-2">
                      <span style={{ fontSize: 12, flex: 1 }}>{acc.name}</span>
                      <input
                        type="text" inputMode="decimal" placeholder="£0.00"
                        value={allocationSplits[acc.id] ?? ''}
                        onChange={e => setAllocationSplits(p => ({ ...p, [acc.id]: sanitizeAmountInput(e.target.value) }))}
                        style={{ fontSize: 12, width: 90 }}
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    <span>
                      Allocated £{Object.values(allocationSplits).reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(2)} of £{i.amount.toFixed(2)}
                    </span>
                    <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={() => confirmAllocateSplit(i)}>Confirm split</button>
                  </div>
                </div>
              )}
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

  const moneyOwedCard = (
    <div className="card">
      <h3 style={{ fontSize: '0.9rem', marginBottom: 14 }}>
        Owed to me <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>£{totalOwedToMe.toFixed(0)} pending</span>
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {moneyOwed.map(o => (
          <div key={o.id} className="flex items-center justify-between gap-2">
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <p style={{ fontSize: 13, textDecoration: o.settled ? 'line-through' : 'none', color: o.settled ? 'var(--text-3)' : 'var(--text)' }}>{o.person}</p>
              <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{o.note ? `${o.note} · ` : ''}{o.date}</p>
            </div>
            <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: o.settled ? 'var(--text-3)' : 'var(--finance)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                £{o.amount.toFixed(0)}
              </span>
              <button className="btn btn-sm btn-ghost" onClick={() => toggleMoneyOwedSettled(o.id, !o.settled)}>
                {o.settled ? 'Unsettle' : 'Settled'}
              </button>
              <button className="btn-icon btn" onClick={() => deleteMoneyOwed(o.id)}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        {moneyOwed.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>Nobody owes you anything right now.</p>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <input placeholder="Who owes you" value={newMoneyOwed.person} onChange={e => setNewMoneyOwed(p => ({ ...p, person: e.target.value }))} style={{ fontSize: 12 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input type="text" inputMode="decimal" placeholder="Amount £" value={newMoneyOwed.amount} onChange={e => setNewMoneyOwed(p => ({ ...p, amount: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 14, flex: '1 1 90px', minWidth: 80 }} />
          <input type="date" value={newMoneyOwed.date} onChange={e => setNewMoneyOwed(p => ({ ...p, date: e.target.value }))} style={{ fontSize: 12, flex: '1 1 110px' }} />
        </div>
        <input placeholder="What for (optional)" value={newMoneyOwed.note} onChange={e => setNewMoneyOwed(p => ({ ...p, note: e.target.value }))} style={{ fontSize: 12 }} />
        <button className="btn btn-sm btn-ghost" onClick={addMoneyOwed}><Plus size={12} /> Add entry</button>
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
        {totalOwedToMe > 0 && (
          <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)', alignSelf: 'flex-start' }}>
            Includes £{totalOwedToMe.toFixed(0)} pending from unsettled "owed to me"
          </p>
        )}
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

      {/* Pending savings contributions reminder */}
      {pendingTxns.length > 0 && activeView === 'monthly' && (
        <div className="card mb-4" style={{ borderLeft: '3px solid var(--warning)', padding: '12px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <AlertCircle size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)' }}>
              £{pendingTxns.reduce((s, t) => s + t.amount, 0).toFixed(2)} in unconfirmed savings — did this go through?
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {pendingTxns.map(t => (
                <div key={t.id} className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  <span>{t.savings_accounts?.name || 'Savings'}: £{t.amount.toFixed(2)}</span>
                  <button className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff', padding: '2px 8px', fontSize: 11 }} onClick={() => confirmSavingsTxn(t)}>Confirm</button>
                  <button className="btn btn-sm btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => cancelSavingsTxn(t)}>Cancel</button>
                </div>
              ))}
            </div>
          </div>
        </div>
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

      {/* Financial health score */}
      {activeView === 'monthly' && (
        <div className="card mb-6" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 20px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${healthColor}22`, border: `3px solid ${healthColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, color: healthColor }}>{healthScore}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: healthColor, marginBottom: 2 }}>{healthLabel}</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{healthSummary}</p>
          </div>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>Financial health</span>
        </div>
      )}

      {/* Income, fixed expenses & savings — always monthly, only shown in the Monthly view */}
      {activeView === 'monthly' && (
        <div className="mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {incomeCard}
          {fixedCard}
          {savingsCard}
          {moneyOwedCard}
        </div>
      )}

      {/* Net Worth section — Monthly view only */}
      {activeView === 'monthly' && (() => {
        const DEBT_CATS = ['Credit Card', 'Loan', 'Overdraft', 'Borrowing', 'Other']
        const INV_TYPES = ['ISA', 'Pension', 'Stocks', 'Other']
        return (
          <div className="mb-6">
            {/* Net worth headline */}
            <div className="card card-finance mb-4" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20, justifyContent: 'space-between' }}>
                <div>
                  <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Net Worth</p>
                  <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.6rem,7vw,2.4rem)', fontWeight: 700, color: netWorth >= 0 ? 'var(--success)' : 'var(--danger)', letterSpacing: '-0.02em' }}>
                    {netWorth < 0 ? '−' : ''}£{Math.abs(netWorth).toFixed(0)}
                  </p>
                  <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    Savings £{totalSavingsBalance.toFixed(0)} + Investments £{totalInvestmentsValue.toFixed(0)} − Debt £{totalDebtBalance.toFixed(0)}
                  </p>
                </div>
                {totalDebtBalance > 0 && (
                  <div style={{ padding: '8px 14px', background: 'color-mix(in srgb, var(--danger) 10%, transparent)', borderRadius: 8, border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)' }}>
                    <p style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>You have £{totalDebtBalance.toFixed(0)} in debt across {debts.length} account{debts.length !== 1 ? 's' : ''}</p>
                    <button className="btn btn-sm btn-ghost" style={{ fontSize: 11, marginTop: 6, color: 'var(--danger)' }} onClick={() => setShowAllocateDebt(v => !v)}>
                      Allocate to debt
                    </button>
                  </div>
                )}
              </div>

              {showAllocateDebt && (
                <div style={{ marginTop: 16, padding: 14, background: 'var(--bg-2)', borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Debt</p>
                    <select value={allocateDebtId} onChange={e => setAllocateDebtId(e.target.value)} style={{ fontSize: 12 }}>
                      <option value="">Select…</option>
                      {debts.map(d => <option key={d.id} value={d.id}>{d.name} (£{d.current_balance.toFixed(0)})</option>)}
                    </select>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Amount £</p>
                    <input type="text" inputMode="decimal" placeholder="0.00" value={allocateDebtAmount} onChange={e => setAllocateDebtAmount(sanitizeAmountInput(e.target.value))} style={{ fontSize: 13, width: 90 }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Note (optional)</p>
                    <input placeholder="Note" value={allocateDebtNote} onChange={e => setAllocateDebtNote(e.target.value)} style={{ fontSize: 12, width: 140 }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Track against budget</p>
                    <select value={allocateDebtBudgetType} onChange={e => setAllocateDebtBudgetType(e.target.value)} style={{ fontSize: 12 }}>
                      <option value="none">Don't track</option>
                      <option value="fixed">As fixed expense</option>
                      <option value="variable">As variable expense</option>
                    </select>
                  </div>
                  <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={confirmDebtAllocation}>Log repayment</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => { setShowAllocateDebt(false); setShowAllocateSuggest(false) }}>Cancel</button>
                  <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={suggestAllocations}>Auto-suggest split</button>
                  <button className="btn btn-sm btn-ghost" onClick={runDebtRecommendation} disabled={debtRecLoading}>
                    {debtRecLoading ? 'Thinking…' : 'Ask Claude how much'}
                  </button>
                </div>
              )}
              {debtRecommendation && showAllocateDebt && (
                <p style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, color: 'var(--text-2)', padding: 10, background: 'var(--bg-2)', borderRadius: 8 }}>
                  {debtRecommendation}
                </p>
              )}
              {showAllocateSuggest && (
                <div style={{ marginTop: 8, padding: 14, background: 'var(--bg-2)', borderRadius: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Suggested allocation (highest interest first)</p>
                  {allocateSuggestions.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No disposable income to allocate this period.</p>}
                  {allocateSuggestions.map((s, i) => (
                    <div key={s.debtId} className="flex items-center gap-3 mb-2">
                      <span style={{ fontSize: 13, flex: 1 }}>{s.name}</span>
                      <input type="text" inputMode="decimal" value={s.amount} onChange={e => setAllocateSuggestions(prev => prev.map((x, j) => j === i ? { ...x, amount: sanitizeAmountInput(e.target.value) } : x))} style={{ fontSize: 13, width: 90 }} />
                    </div>
                  ))}
                  {allocateSuggestions.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={confirmSuggestedAllocations}>Confirm all</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setShowAllocateSuggest(false)}>Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Debt / Savings / Investments grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

              {/* ── Debt ── */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 style={{ fontSize: '0.9rem' }}>Debt</h3>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--danger)', fontWeight: 700 }}>£{totalDebtBalance.toFixed(0)}</span>
                </div>
                {debts.map(d => {
                  const pct = d.original_balance > 0 ? Math.min(100, ((d.original_balance - d.current_balance) / d.original_balance) * 100) : 0
                  return (
                    <div key={d.id} style={{ position: 'relative', marginBottom: 8 }}>
                      <button
                        onClick={async () => { setSelectedDebt(d); await loadDebtRepayments(d.id) }}
                        style={{ width: '100%', textAlign: 'left', background: 'var(--bg-2)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)', cursor: 'pointer' }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</p>
                            <span className="badge" style={{ fontSize: 9, background: 'color-mix(in srgb, var(--danger) 15%, transparent)', color: 'var(--danger)' }}>{d.category}</span>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0, paddingRight: 24 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>£{d.current_balance.toFixed(0)}</p>
                            {d.original_balance && <p style={{ fontSize: 10, color: 'var(--text-3)' }}>of £{d.original_balance.toFixed(0)}</p>}
                          </div>
                        </div>
                        {d.original_balance > 0 && (
                          <div style={{ marginTop: 6, height: 4, background: 'var(--bg-3)', borderRadius: 2 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--success)', borderRadius: 2 }} />
                          </div>
                        )}
                      </button>
                      <button className="btn-icon btn" style={{ position: 'absolute', top: 8, right: 8 }} onClick={e => { e.stopPropagation(); deleteDebt(d.id) }}><Trash2 size={12} /></button>
                    </div>
                  )
                })}
                {debts.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', marginBottom: 8 }}>No debts tracked.</p>}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input placeholder="Debt name" value={newDebt.name} onChange={e => setNewDebt(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12 }} />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <select value={newDebt.category} onChange={e => setNewDebt(p => ({ ...p, category: e.target.value }))} style={{ fontSize: 11, flex: '1 1 100px' }}>
                        {DEBT_CATS.map(c => <option key={c}>{c}</option>)}
                      </select>
                      <input type="text" inputMode="decimal" placeholder="Balance £" value={newDebt.current_balance} onChange={e => setNewDebt(p => ({ ...p, current_balance: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: '1 1 80px', minWidth: 70 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <input type="text" inputMode="decimal" placeholder="Original £ (opt)" value={newDebt.original_balance} onChange={e => setNewDebt(p => ({ ...p, original_balance: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 11, flex: '1 1 100px', minWidth: 80 }} />
                      <input type="text" inputMode="decimal" placeholder="Rate % (opt)" value={newDebt.interest_rate} onChange={e => setNewDebt(p => ({ ...p, interest_rate: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 11, flex: '1 1 70px', minWidth: 60 }} />
                      <input type="text" inputMode="decimal" placeholder="Min pay £ (opt)" value={newDebt.minimum_payment} onChange={e => setNewDebt(p => ({ ...p, minimum_payment: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 11, flex: '1 1 90px', minWidth: 70 }} />
                    </div>
                    <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={addDebt}><Plus size={12} /> Add debt</button>
                  </div>
                </div>
              </div>

              {/* ── Savings ── */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 style={{ fontSize: '0.9rem' }}>Savings</h3>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--finance)', fontWeight: 700 }}>£{totalSavingsBalance.toFixed(0)}</span>
                </div>
                {savingsAccounts.map(a => {
                  const pct = a.target_amount > 0 ? Math.min(100, (a.current_balance / a.target_amount) * 100) : null
                  return (
                    <div key={a.id} style={{ position: 'relative', marginBottom: 8 }}>
                      <button
                        onClick={async () => { setSelectedSavingsAccount(a); await loadSavingsTxns(a.id) }}
                        style={{ width: '100%', textAlign: 'left', background: 'var(--bg-2)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)', cursor: 'pointer' }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</p>
                          <p style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--finance)', paddingRight: 24 }}>£{a.current_balance.toFixed(0)}</p>
                        </div>
                        {a.target_amount > 0 && (
                          <>
                            <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>Target £{a.target_amount.toFixed(0)}{a.target_date ? ` by ${a.target_date}` : ''}</p>
                            <div style={{ marginTop: 4, height: 4, background: 'var(--bg-3)', borderRadius: 2 }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--finance)', borderRadius: 2 }} />
                            </div>
                          </>
                        )}
                      </button>
                      <button className="btn-icon btn" style={{ position: 'absolute', top: 8, right: 8 }} onClick={e => { e.stopPropagation(); deleteSavingsAccount(a.id) }}><Trash2 size={12} /></button>
                    </div>
                  )
                })}
                {savingsAccounts.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', marginBottom: 8 }}>No savings accounts tracked.</p>}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input placeholder="Account name" value={newSavingsAccount.name} onChange={e => setNewSavingsAccount(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12 }} />
                    <input type="text" inputMode="decimal" placeholder="Starting balance £" value={newSavingsAccount.current_balance} onChange={e => setNewSavingsAccount(p => ({ ...p, current_balance: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12 }} />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <input type="text" inputMode="decimal" placeholder="Target £ (opt)" value={newSavingsAccount.target_amount} onChange={e => setNewSavingsAccount(p => ({ ...p, target_amount: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 11, flex: '1 1 100px', minWidth: 80 }} />
                      <input type="date" value={newSavingsAccount.target_date} onChange={e => setNewSavingsAccount(p => ({ ...p, target_date: e.target.value }))} style={{ fontSize: 11, flex: '1 1 120px', minWidth: 100 }} />
                    </div>
                    <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={addSavingsAccount}><Plus size={12} /> Add savings pot</button>
                  </div>
                </div>
              </div>

              {/* ── Investments ── */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 style={{ fontSize: '0.9rem' }}>Investments</h3>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--career)', fontWeight: 700 }}>£{totalInvestmentsValue.toFixed(0)}</span>
                </div>
                {investments.map(inv => (
                  <div key={inv.id} style={{ position: 'relative', marginBottom: 8 }}>
                    <button
                      onClick={async () => { setSelectedInvestment(inv); await loadInvestmentTxns(inv.id) }}
                      style={{ width: '100%', textAlign: 'left', background: 'var(--bg-2)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)', cursor: 'pointer' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{inv.name}</p>
                          <span className="badge" style={{ fontSize: 9, background: 'color-mix(in srgb, var(--career) 15%, transparent)', color: 'var(--career)' }}>{inv.type}</span>
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--career)', paddingRight: 24 }}>£{inv.current_value.toFixed(0)}</p>
                      </div>
                    </button>
                    <button className="btn-icon btn" style={{ position: 'absolute', top: 8, right: 8 }} onClick={e => { e.stopPropagation(); deleteInvestment(inv.id) }}><Trash2 size={12} /></button>
                  </div>
                ))}
                {investments.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', marginBottom: 8 }}>No investments tracked.</p>}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input placeholder="Investment name" value={newInvestment.name} onChange={e => setNewInvestment(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 12 }} />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <select value={newInvestment.type} onChange={e => setNewInvestment(p => ({ ...p, type: e.target.value }))} style={{ fontSize: 11, flex: '1 1 100px' }}>
                        {INV_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <input type="text" inputMode="decimal" placeholder="Starting value £" value={newInvestment.current_value} onChange={e => setNewInvestment(p => ({ ...p, current_value: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: '1 1 100px', minWidth: 80 }} />
                    </div>
                    <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={addInvestment}><Plus size={12} /> Add investment</button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )
      })()}

      {/* Debt detail panel */}
      {selectedDebt && (() => {
        const d = selectedDebt
        const reps = debtRepayments[d.id] || []
        const isEditing = editingDebt === d.id
        const threeMoAgo = format(subMonths(new Date(), 3), 'yyyy-MM-dd')
        const recentReps = reps.filter(r => r.date >= threeMoAgo)
        const avgMonthly = recentReps.length ? recentReps.reduce((s, r) => s + r.amount, 0) / 3 : 0
        const monthlyRate = d.target_monthly_payment || avgMonthly
        let projectedPayoff = null
        if (d.target_payoff_date) {
          projectedPayoff = d.target_payoff_date
        } else if (monthlyRate > 0 && d.current_balance > 0) {
          const monthsLeft = Math.ceil(d.current_balance / monthlyRate)
          projectedPayoff = format(subMonths(new Date(), -monthsLeft), 'yyyy-MM-dd')
        }
        const overThreshold = d.warning_threshold != null && d.current_balance > d.warning_threshold
        const progressPct = d.original_balance ? Math.max(0, Math.min(100, 100 - (d.current_balance / d.original_balance) * 100)) : 0
        return createPortal(
          <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => { setSelectedDebt(null); setEditingDebt(null) }}>
            <div className="card" style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{d.name}</h3>
                <div className="flex items-center gap-2">
                  <button className="btn-icon btn" onClick={() => { setEditingDebt(isEditing ? null : d.id); setEditDebtDraft({ ...d }) }}><Pencil size={14} /></button>
                  <button className="btn-icon btn" onClick={() => { setSelectedDebt(null); setEditingDebt(null) }}><XIcon size={14} /></button>
                </div>
              </div>

              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <input placeholder="Name" value={editDebtDraft.name || ''} onChange={e => setEditDebtDraft(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 13 }} />
                  <select value={editDebtDraft.category || 'Other'} onChange={e => setEditDebtDraft(p => ({ ...p, category: e.target.value }))} style={{ fontSize: 13 }}>
                    {['Credit Card', 'Loan', 'Overdraft', 'Borrowing', 'Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" inputMode="decimal" placeholder="Current balance £" value={editDebtDraft.current_balance ?? ''} onChange={e => setEditDebtDraft(p => ({ ...p, current_balance: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: 1 }} />
                    <input type="text" inputMode="decimal" placeholder="Original balance £" value={editDebtDraft.original_balance ?? ''} onChange={e => setEditDebtDraft(p => ({ ...p, original_balance: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: 1 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" inputMode="decimal" placeholder="Interest rate %" value={editDebtDraft.interest_rate ?? ''} onChange={e => setEditDebtDraft(p => ({ ...p, interest_rate: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: 1 }} />
                    <input type="text" inputMode="decimal" placeholder="Min payment £" value={editDebtDraft.minimum_payment ?? ''} onChange={e => setEditDebtDraft(p => ({ ...p, minimum_payment: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: 1 }} />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Payoff goal</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="date" value={editDebtDraft.target_payoff_date || ''} onChange={e => setEditDebtDraft(p => ({ ...p, target_payoff_date: e.target.value }))} style={{ fontSize: 12, flex: 1 }} />
                    <input type="text" inputMode="decimal" placeholder="Target £/month" value={editDebtDraft.target_monthly_payment ?? ''} onChange={e => setEditDebtDraft(p => ({ ...p, target_monthly_payment: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: 1 }} />
                  </div>
                  <input type="text" inputMode="decimal" placeholder="Warning threshold £ (alert if balance exceeds)" value={editDebtDraft.warning_threshold ?? ''} onChange={e => setEditDebtDraft(p => ({ ...p, warning_threshold: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12 }} />
                  <input
                    type="number" min="1" max="31"
                    placeholder="Min payment due day of month (opt, for SMS reminders)"
                    value={editDebtDraft.due_day ?? ''}
                    onChange={e => setEditDebtDraft(p => ({ ...p, due_day: e.target.value }))}
                    style={{ fontSize: 12 }}
                  />
                  <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={saveEditDebt}><CheckIcon size={12} /> Save changes</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <ArcRing value={(d.original_balance || d.current_balance) - d.current_balance} max={d.original_balance || d.current_balance || 1} size={64} color="var(--danger)" label={`${Math.round(progressPct)}%`} />
                  <div>
                    <p style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>£{d.current_balance.toFixed(0)}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)' }}>of £{(d.original_balance || d.current_balance).toFixed(0)} original · {d.category}</p>
                    {d.interest_rate != null && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{d.interest_rate}% interest{d.minimum_payment ? ` · £${d.minimum_payment} min/mo` : ''}</p>}
                  </div>
                </div>
              )}

              {!isEditing && (
                <div style={{ background: 'var(--bg-2)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Payoff projection</p>
                  {projectedPayoff ? (
                    <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {d.target_payoff_date ? 'Target date: ' : 'Estimated payoff: '}
                      <strong>{format(new Date(projectedPayoff), 'd MMM yyyy')}</strong>
                      {!d.target_payoff_date && monthlyRate > 0 && ` at ~£${monthlyRate.toFixed(0)}/mo`}
                    </p>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Log repayments or set a target to see a projection.</p>
                  )}
                  {d.due_day != null && (
                    <p style={{ fontSize: 11, marginTop: 6, color: 'var(--text-3)' }}>
                      Minimum payment due day {d.due_day} of each month — SMS reminder 3 days before, if enabled in Settings.
                    </p>
                  )}
                  {d.warning_threshold != null && (
                    <p style={{ fontSize: 11, marginTop: 6, color: overThreshold ? 'var(--danger)' : 'var(--success)' }}>
                      <AlertCircle size={11} style={{ display: 'inline', marginRight: 4 }} />
                      Warning threshold £{d.warning_threshold.toFixed(0)} — {overThreshold ? 'currently above threshold' : 'within threshold'}
                    </p>
                  )}
                </div>
              )}

              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Log a repayment</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                <input type="text" inputMode="decimal" placeholder="Amount £" value={newRepayment.amount} onChange={e => setNewRepayment(p => ({ ...p, amount: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: '1 1 80px' }} />
                <input type="date" value={newRepayment.date} onChange={e => setNewRepayment(p => ({ ...p, date: e.target.value }))} style={{ fontSize: 12, flex: '1 1 110px' }} />
                <input placeholder="Note (optional)" value={newRepayment.note} onChange={e => setNewRepayment(p => ({ ...p, note: e.target.value }))} style={{ fontSize: 12, flex: '2 1 120px' }} />
                <button
                  className="btn btn-sm btn-finance"
                  style={{ color: '#fff' }}
                  onClick={async () => {
                    if (!newRepayment.amount) return
                    await logRepayment(d.id, parseFloat(newRepayment.amount), newRepayment.date, newRepayment.note)
                    setNewRepayment({ amount: '', date: new Date().toISOString().slice(0, 10), note: '' })
                  }}
                >Log repayment</button>
              </div>

              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Repayment history</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {reps.map(r => (
                  <div key={r.id} className="flex items-center justify-between" style={{ fontSize: 12, padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 6 }}>
                    <span>{format(new Date(r.date), 'd MMM yyyy')}{r.note ? ` — ${r.note}` : ''}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>£{r.amount.toFixed(0)}</span>
                  </div>
                ))}
                {reps.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No repayments logged yet.</p>}
              </div>
            </div>
          </div>,
          document.body
        )
      })()}

      {/* Savings account detail panel */}
      {selectedSavingsAccount && (() => {
        const a = selectedSavingsAccount
        const txns = savingsTxns[a.id] || []
        const isEditing = editingSavingsAcc === a.id
        const progressPct = a.target_amount ? Math.max(0, Math.min(100, (a.current_balance / a.target_amount) * 100)) : 0
        return createPortal(
          <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => { setSelectedSavingsAccount(null); setEditingSavingsAcc(null) }}>
            <div className="card" style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{a.name}</h3>
                <div className="flex items-center gap-2">
                  <button className="btn-icon btn" onClick={() => { setEditingSavingsAcc(isEditing ? null : a.id); setEditSavingsAccDraft({ ...a }) }}><Pencil size={14} /></button>
                  <button className="btn-icon btn" onClick={() => { setSelectedSavingsAccount(null); setEditingSavingsAcc(null) }}><XIcon size={14} /></button>
                </div>
              </div>

              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <input placeholder="Name" value={editSavingsAccDraft.name || ''} onChange={e => setEditSavingsAccDraft(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 13 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" inputMode="decimal" placeholder="Target amount £" value={editSavingsAccDraft.target_amount ?? ''} onChange={e => setEditSavingsAccDraft(p => ({ ...p, target_amount: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: 1 }} />
                    <input type="date" value={editSavingsAccDraft.target_date || ''} onChange={e => setEditSavingsAccDraft(p => ({ ...p, target_date: e.target.value }))} style={{ fontSize: 12, flex: 1 }} />
                  </div>
                  <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={saveEditSavingsAcc}><CheckIcon size={12} /> Save changes</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <ArcRing value={a.current_balance} max={a.target_amount || a.current_balance || 1} size={64} color="var(--finance)" label={`${Math.round(progressPct)}%`} />
                  <div>
                    <p style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>£{a.current_balance.toFixed(0)}</p>
                    {a.target_amount && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>of £{a.target_amount.toFixed(0)} target{a.target_date ? ` by ${format(new Date(a.target_date), 'd MMM yyyy')}` : ''}</p>}
                    <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Starting balance £{(a.starting_balance || 0).toFixed(0)}</p>
                  </div>
                </div>
              )}

              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Add contribution / withdrawal / balance update</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                <select value={newSavingsTxn.type} onChange={e => setNewSavingsTxn(p => ({ ...p, type: e.target.value }))} style={{ fontSize: 12, flex: '1 1 110px' }}>
                  <option value="contribution">Contribution (add)</option>
                  <option value="withdrawal">Withdrawal (subtract)</option>
                  <option value="set_balance">Set exact balance</option>
                </select>
                <input type="text" inputMode="decimal" placeholder={newSavingsTxn.type === 'set_balance' ? 'New balance £' : 'Amount £'} value={newSavingsTxn.amount} onChange={e => setNewSavingsTxn(p => ({ ...p, amount: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: '1 1 80px' }} />
                <input type="date" value={newSavingsTxn.date} onChange={e => setNewSavingsTxn(p => ({ ...p, date: e.target.value }))} style={{ fontSize: 12, flex: '1 1 110px' }} />
                <input placeholder={newSavingsTxn.type === 'contribution' ? 'Note (optional)' : 'Note (required if it decreased)'} value={newSavingsTxn.note} onChange={e => setNewSavingsTxn(p => ({ ...p, note: e.target.value }))} style={{ fontSize: 12, flex: '2 1 120px' }} />
                <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={() => logSavingsTxn(a.id)}>
                  {newSavingsTxn.type === 'set_balance' ? 'Update balance' : newSavingsTxn.type === 'withdrawal' ? 'Log withdrawal' : 'Log contribution'}
                </button>
              </div>

              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Transaction history</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                {txns.map(t => (
                  <div key={t.id} className="flex items-center justify-between" style={{ fontSize: 12, padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 6 }}>
                    <span>
                      {format(new Date(t.date), 'd MMM yyyy')} · {t.type}{t.note ? ` — ${t.note}` : ''}
                      {t.status === 'pending' && <span className="badge" style={{ fontSize: 9, marginLeft: 6, background: 'color-mix(in srgb, var(--warning) 20%, transparent)', color: 'var(--warning)' }}>Pending</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{t.type === 'withdrawal' ? '-' : '+'}£{t.amount.toFixed(0)}</span>
                      {t.status === 'pending' && (
                        <>
                          <button className="btn-icon btn" style={{ width: 22, height: 22 }} onClick={() => confirmSavingsTxn(t)}><CheckIcon size={11} /></button>
                          <button className="btn-icon btn" style={{ width: 22, height: 22 }} onClick={() => cancelSavingsTxn(t)}><XIcon size={11} /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {txns.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No transactions yet.</p>}
              </div>
            </div>
          </div>,
          document.body
        )
      })()}

      {/* Investment detail panel */}
      {selectedInvestment && (() => {
        const inv = selectedInvestment
        const txns = investmentTxns[inv.id] || []
        const isEditing = editingInvestment === inv.id
        return createPortal(
          <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => { setSelectedInvestment(null); setEditingInvestment(null) }}>
            <div className="card" style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{inv.name}</h3>
                <div className="flex items-center gap-2">
                  <button className="btn-icon btn" onClick={() => { setEditingInvestment(isEditing ? null : inv.id); setEditInvestmentDraft({ ...inv }) }}><Pencil size={14} /></button>
                  <button className="btn-icon btn" onClick={() => { setSelectedInvestment(null); setEditingInvestment(null) }}><XIcon size={14} /></button>
                </div>
              </div>

              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <input placeholder="Name" value={editInvestmentDraft.name || ''} onChange={e => setEditInvestmentDraft(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 13 }} />
                  <select value={editInvestmentDraft.type || 'Other'} onChange={e => setEditInvestmentDraft(p => ({ ...p, type: e.target.value }))} style={{ fontSize: 13 }}>
                    {['ISA', 'Pension', 'Stocks', 'Other'].map(t => <option key={t}>{t}</option>)}
                  </select>
                  <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={saveEditInvestment}><CheckIcon size={12} /> Save changes</button>
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>£{inv.current_value.toFixed(0)}</p>
                  <span className="badge" style={{ fontSize: 10, background: 'color-mix(in srgb, var(--career) 15%, transparent)', color: 'var(--career)' }}>{inv.type}</span>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Starting value £{(inv.starting_value || 0).toFixed(0)}</p>
                </div>
              )}

              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Add contribution / withdrawal</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                <select value={newInvestmentTxn.type} onChange={e => setNewInvestmentTxn(p => ({ ...p, type: e.target.value }))} style={{ fontSize: 12, flex: '1 1 110px' }}>
                  <option value="contribution">Contribution</option>
                  <option value="withdrawal">Withdrawal</option>
                </select>
                <input type="text" inputMode="decimal" placeholder="Amount £" value={newInvestmentTxn.amount} onChange={e => setNewInvestmentTxn(p => ({ ...p, amount: sanitizeAmountInput(e.target.value) }))} style={{ fontSize: 12, flex: '1 1 80px' }} />
                <input type="date" value={newInvestmentTxn.date} onChange={e => setNewInvestmentTxn(p => ({ ...p, date: e.target.value }))} style={{ fontSize: 12, flex: '1 1 110px' }} />
                <input placeholder="Note (optional)" value={newInvestmentTxn.note} onChange={e => setNewInvestmentTxn(p => ({ ...p, note: e.target.value }))} style={{ fontSize: 12, flex: '2 1 120px' }} />
                <button className="btn btn-sm btn-finance" style={{ color: '#fff' }} onClick={() => logInvestmentTxn(inv.id)}>Log {newInvestmentTxn.type === 'withdrawal' ? 'withdrawal' : 'contribution'}</button>
              </div>

              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Transaction history</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                {txns.map(t => (
                  <div key={t.id} className="flex items-center justify-between" style={{ fontSize: 12, padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 6 }}>
                    <span>
                      {format(new Date(t.date), 'd MMM yyyy')} · {t.type}{t.note ? ` — ${t.note}` : ''}
                      {t.status === 'pending' && <span className="badge" style={{ fontSize: 9, marginLeft: 6, background: 'color-mix(in srgb, var(--warning) 20%, transparent)', color: 'var(--warning)' }}>Pending</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{t.type === 'withdrawal' ? '-' : '+'}£{t.amount.toFixed(0)}</span>
                      {t.status === 'pending' && (
                        <>
                          <button className="btn-icon btn" style={{ width: 22, height: 22 }} onClick={() => confirmInvestmentTxn(t)}><CheckIcon size={11} /></button>
                          <button className="btn-icon btn" style={{ width: 22, height: 22 }} onClick={() => cancelInvestmentTxn(t)}><XIcon size={11} /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {txns.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No transactions yet.</p>}
              </div>
            </div>
          </div>,
          document.body
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
