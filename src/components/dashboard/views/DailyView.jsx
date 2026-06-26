import { Check, Droplets, Star, Calendar as CalendarIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import ArcRing from '../../ui/ArcRing'
import DailyTodos from '../DailyTodos'
import MoodWidget from '../MoodWidget'
import CurrentlyReading from '../CurrentlyReading'
import DailyAgenda from '../../calendar/DailyAgenda'
import { SortableCard, DraggableCardList } from '../DraggableCard'
import AddWidgetMenu from '../AddWidgetMenu'
import BudgetRing from '../../finance/BudgetRing'
import QuickAddExpense from '../../finance/QuickAddExpense'
import DailyQuote from '../DailyQuote'
import BrainDump from '../../shared/BrainDump'
import NoteForTomorrow from '../NoteForTomorrow'
import { groupHabitsByTimeOfDay } from '../../../lib/habitUtils'

export const CARD_LABELS = {
  quote: 'Daily quote',
  priority: 'One priority',
  todos: "Today's to-dos",
  habits: 'Habits',
  mood: 'Mood',
  water: 'Hydration',
  reading: 'Currently reading',
  calendar: "Today's calendar",
  'finance-snapshot': 'Finance snapshot',
  'quick-add-expense': 'Quick add expense',
  'brain-dump': 'Brain dump',
  'note-tomorrow': 'Note for tomorrow',
}

export const DEFAULT_ORDER = [
  { id: 'quote', size: 'wide' },
  { id: 'priority', size: 'square' },
  { id: 'todos', size: 'wide' },
  { id: 'habits', size: 'wide' },
  { id: 'mood', size: 'square' },
  { id: 'water', size: 'square' },
  { id: 'reading', size: 'square' },
  { id: 'calendar', size: 'wide' },
  { id: 'brain-dump', size: 'wide' },
  { id: 'note-tomorrow', size: 'square' },
]
const HYDRATION_GOAL = 2500

export default function DailyView({
  habits, weekTasks, hydration, onOpenPanel,
  cardOrder, onReorder, user, today,
  onHydrationAdd,
  financeTotalVariable, financeOverallBudget, onAddExpense,
  savedDailyQuote, onSaveDailyQuote, onToggleHabit,
  editing, onResize, onRemoveCard, onAddCard,
}) {
  const order = (cardOrder?.length ? cardOrder : DEFAULT_ORDER)

  function openPanel(type, data) { onOpenPanel({ type, data }) }

  const priorityTask = weekTasks.find(t => t.priority && !t.complete) || weekTasks.find(t => !t.complete) || null

  const CARDS = {
    quote: (
      <div className="card" style={{ textAlign: 'center' }}>
        <DailyQuote
          userId={user.id}
          date={today}
          savedQuote={savedDailyQuote}
          onSave={onSaveDailyQuote}
        />
      </div>
    ),

    priority: (
      <div className="card card-career">
        <div className="flex items-center justify-between mb-3">
          <p className="mono">One priority</p>
          <Star size={13} color="var(--career)" />
        </div>
        {priorityTask ? (
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>{priorityTask.specific_task}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{priorityTask.area}</p>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
            All tasks done. <Link to="/weekly" style={{ color: 'var(--career)' }}>Add more →</Link>
          </p>
        )}
      </div>
    ),

    todos: (
      <div className="card">
        <DailyTodos />
      </div>
    ),

    habits: (
      <div className="card card-personal">
        <div className="flex items-center justify-between mb-3">
          <h3>Habits</h3>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
            {habits.filter(h => h.done).length}/{habits.length} today
          </p>
        </div>
        {habits.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
            No habits. <Link to="/habits" style={{ color: 'var(--personal)' }}>Add some →</Link>
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groupHabitsByTimeOfDay(habits).map(group => (
              <div key={group.key}>
                <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6 }}>{group.label}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {group.habits.map(h => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        onClick={e => { e.stopPropagation(); onToggleHabit(h) }}
                        className={`toggle-dot ${h.done ? 'done' : ''}`}
                        style={{ borderColor: h.done ? 'var(--success)' : 'var(--personal)', cursor: 'pointer' }}
                      >
                        {h.done && <Check size={10} color="white" strokeWidth={3} />}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, color: h.done ? 'var(--text-3)' : 'var(--text)', textDecoration: h.done ? 'line-through' : 'none' }}>
                        {h.emoji} {h.name}
                      </span>
                      {h.done && h.streak >= 3 && <span style={{ fontSize: 12 }}>🔥 {h.streak}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),

    mood: (
      <div className="card card-wellness">
        <MoodWidget />
      </div>
    ),

    water: (
      <div className="card card-wellness">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Droplets size={14} color="var(--wellness)" />
            <p className="mono">Hydration</p>
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--wellness)', fontWeight: 500 }}>
            {hydration}/{HYDRATION_GOAL}ml
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <ArcRing value={hydration} max={HYDRATION_GOAL} size={80} strokeWidth={8} color="var(--wellness)" label={`${Math.round((hydration / HYDRATION_GOAL) * 100)}%`} fontSize={14} />
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[150, 250, 500].map(ml => (
            <button key={ml} className="btn btn-xs btn-ghost" onClick={e => { e.stopPropagation(); onHydrationAdd(ml) }}>+{ml}ml</button>
          ))}
        </div>
      </div>
    ),

    reading: <CurrentlyReading />,

    calendar: (
      <div className="card card-finance">
        <Link to="/calendar" className="flex items-center justify-between mb-3" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3>Today's calendar</h3>
          <CalendarIcon size={14} color="var(--finance)" />
        </Link>
        <DailyAgenda />
      </div>
    ),

    'finance-snapshot': (
      <div className="card card-finance">
        <div className="flex items-center justify-between mb-3">
          <h3>Finance snapshot</h3>
          <Link to="/finance" style={{ fontSize: 12, color: 'var(--finance)', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>Open →</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <BudgetRing label="This month" spent={financeTotalVariable || 0} budget={financeOverallBudget || 0} size={84} />
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {financeOverallBudget > 0
              ? (financeTotalVariable <= financeOverallBudget
                  ? `£${(financeOverallBudget - financeTotalVariable).toFixed(0)} left this month`
                  : `£${(financeTotalVariable - financeOverallBudget).toFixed(0)} over budget this month`)
              : `£${(financeTotalVariable || 0).toFixed(0)} spent this month`}
          </p>
        </div>
      </div>
    ),

    'quick-add-expense': (
      <div className="card card-finance">
        <h3 style={{ marginBottom: 10 }}>Quick add expense</h3>
        <div onClick={e => e.stopPropagation()}>
          <QuickAddExpense onAdd={onAddExpense} compact />
        </div>
      </div>
    ),

    'brain-dump': (
      <div onClick={e => e.stopPropagation()}>
        <BrainDump />
      </div>
    ),

    'note-tomorrow': (
      <div onClick={e => e.stopPropagation()}>
        <NoteForTomorrow today={today} />
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
            onClick={id !== 'quote' && id !== 'todos' && id !== 'mood' && id !== 'reading' && id !== 'calendar' && id !== 'finance-snapshot' && id !== 'quick-add-expense' && id !== 'brain-dump' && id !== 'note-tomorrow' ? () => openPanel(id === 'habits' ? 'habits' : id === 'water' ? 'water' : id === 'priority' ? 'tasks' : id, { habits, tasks: weekTasks, hydration }) : undefined}
          >
            {CARDS[id] || null}
          </SortableCard>
        ))}
      </DraggableCardList>
    </div>
  )
}
