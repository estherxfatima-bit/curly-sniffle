import ArcRing from '../../ui/ArcRing'
import { Link } from 'react-router-dom'
import { startOfMonth, endOfMonth } from 'date-fns'
import { SortableCard, DraggableCardList } from '../DraggableCard'
import AddWidgetMenu from '../AddWidgetMenu'
import { calculateGoalCompletion, calculateExpectedOccurrences } from '../../../lib/habitUtils'

export const CARD_LABELS = {
  'habit-rings': 'Habit completion',
  'goal-rings': 'Goal progress',
  'finance-summary': 'Finances',
  'content-progress': 'Content batches',
}

export const DEFAULT_ORDER = [
  { id: 'habit-rings', size: 'wide' },
  { id: 'goal-rings', size: 'wide' },
  { id: 'finance-summary', size: 'wide' },
  { id: 'content-progress', size: 'wide' },
]

export default function MonthlyView({
  habits, monthHabitLogs, goals, weekTasks,
  income, fixed, variable, savings,
  contentBatches,
  onOpenPanel, cardOrder, onReorder,
  editing, onResize, onRemoveCard, onAddCard,
}) {
  const order = cardOrder?.length ? cardOrder : DEFAULT_ORDER

  // Calculate monthly completion per habit, based on each habit's expected frequency
  // for the current month (not a flat day count).
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const habitRings = habits.map(h => {
    const logs = (monthHabitLogs || []).filter(l => l.habit_id === h.id)
    const count = logs.length
    const expected = calculateExpectedOccurrences(h, monthStart, monthEnd)
    const pct = calculateGoalCompletion(h, logs, monthStart, monthEnd) ?? 0
    return { ...h, count, expected, pct }
  })

  // Finance summary
  function toMonthly(amount, frequency) {
    if (frequency === 'monthly') return amount
    if (frequency === 'weekly')  return amount * 52 / 12
    if (frequency === 'annual')  return amount / 12
    return 0
  }
  const totalIncome   = (income   || []).reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0)
  const totalFixed    = (fixed    || []).reduce((s, i) => s + i.amount, 0)
  const selfEmp       = (income   || []).filter(i => i.is_self_employed).reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0)
  const taxPot        = selfEmp * 0.25
  const totalVariable = (variable || []).reduce((s, i) => s + i.amount, 0)
  const totalSavings  = (savings  || []).reduce((s, i) => s + toMonthly(i.amount, i.frequency), 0)
  const takeHome      = totalIncome - taxPot - totalFixed - totalSavings - totalVariable

  // Goal rings
  const goalRings = goals.filter(g => g.quarter).map(goal => {
    const linked = weekTasks.filter(t => t.goal_id === goal.id)
    const done   = linked.filter(t => t.complete).length
    return { ...goal, pct: linked.length ? Math.round((done / linked.length) * 100) : 0, done, total: linked.length }
  })

  function openPanel(type, data) { onOpenPanel({ type, data }) }

  const CARDS = {
    'habit-rings': (
      <div className="card card-personal">
        <div className="flex items-center justify-between mb-4">
          <h3>Habit completion</h3>
          <p className="mono">This month</p>
        </div>
        {habitRings.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No habits tracked.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 16 }}>
            {habitRings.map(h => (
              <div key={h.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <ArcRing value={h.pct} max={100} size={72} strokeWidth={6} color="var(--personal)" label={`${h.pct}%`} fontSize={12} />
                <p style={{ fontSize: 11, textAlign: 'center', color: 'var(--text-2)', lineHeight: 1.3 }}>{h.emoji} {h.name}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>{h.count}/{h.expected}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    ),

    'goal-rings': (
      <div className="card card-career">
        <div className="flex items-center justify-between mb-4">
          <h3>Goal progress</h3>
          <Link to="/goals" style={{ fontSize: 12, color: 'var(--career)', textDecoration: 'none' }}>Manage →</Link>
        </div>
        {goalRings.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No goals set.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {goalRings.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <ArcRing value={g.pct} max={100} size={52} strokeWidth={5} color="var(--career)" label={`${g.pct}%`} fontSize={10} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--career)', textTransform: 'uppercase' }}>{g.category}</p>
                  <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.primary_goal}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{g.done}/{g.total} tasks</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),

    'finance-summary': (
      <div className="card card-finance">
        <div className="flex items-center justify-between mb-4">
          <h3>Finances</h3>
          <p className="mono">This month</p>
        </div>
        {totalIncome === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
            <Link to="/finance" style={{ color: 'var(--finance)' }}>Set up your finances →</Link>
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Income', value: totalIncome, color: 'var(--finance)' },
              { label: 'Spend', value: totalFixed + totalVariable, color: 'var(--text)' },
              { label: 'Tax pot', value: taxPot, color: 'var(--creative)' },
              { label: 'Take-home', value: takeHome, color: takeHome >= 0 ? 'var(--finance)' : 'var(--danger)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', marginBottom: 4, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</p>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontWeight: 700, color, letterSpacing: '-0.02em' }}>£{Math.abs(value).toFixed(0)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    ),

    'content-progress': (
      <div className="card card-creative">
        <div className="flex items-center justify-between mb-4">
          <h3>Content batches</h3>
          <Link to="/content" style={{ fontSize: 12, color: 'var(--creative)', textDecoration: 'none' }}>View all →</Link>
        </div>
        {(!contentBatches || contentBatches.length === 0) ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No batches yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {contentBatches.slice(0, 4).map(b => {
              const ideas  = b.ideas || []
              const done   = ideas.filter(i => i.status === 'published' || i.status === 'filmed').length
              const pct    = ideas.length ? Math.round((done / ideas.length) * 100) : 0
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ArcRing value={pct} max={100} size={44} strokeWidth={4} color="var(--creative)" label={`${pct}%`} fontSize={9} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{done}/{ideas.length} ideas done</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    ),
  }

  const available = Object.entries(CARD_LABELS)
    .filter(([id]) => !order.some(o => o.id === id))
    .map(([id, label]) => ({ id, label }))

  return (
    <div>
      {editing && (
        <div className="mb-4">
          <AddWidgetMenu available={available} onAdd={onAddCard} />
        </div>
      )}
      <DraggableCardList cardOrder={order} onReorder={onReorder}>
        {order.map(({ id, size }) => (
          <SortableCard
            key={id}
            id={id}
            size={size}
            editing={editing}
            onResize={s => onResize(id, s)}
            onRemove={() => onRemoveCard(id)}
            onClick={() => openPanel(
              id === 'finance-summary' ? 'finance-summary' :
              id === 'goal-rings'      ? 'goals'           : id,
              { habits, tasks: weekTasks, goals: goalRings,
                totalIncome, totalFixed, totalVariable, taxPot, takeHome }
            )}
          >
            {CARDS[id] || null}
          </SortableCard>
        ))}
      </DraggableCardList>
    </div>
  )
}
