import { Check } from 'lucide-react'
import { format, addDays } from 'date-fns'
import ArcRing from '../../ui/ArcRing'
import WeeklyQuote from '../WeeklyQuote'
import WeeklyAgenda from '../../calendar/WeeklyAgenda'
import { SortableCard, DraggableCardList } from '../DraggableCard'
import AddWidgetMenu from '../AddWidgetMenu'

export const CARD_LABELS = {
  quote: 'Weekly quote',
  momentum: 'Momentum',
  tasks: 'This week',
  'habit-grid': 'Habit week',
  calendar: "This week's calendar",
}

export const DEFAULT_ORDER = [
  { id: 'quote', size: 'wide' },
  { id: 'momentum', size: 'wide' },
  { id: 'tasks', size: 'wide' },
  { id: 'habit-grid', size: 'wide' },
  { id: 'calendar', size: 'wide' },
]

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function WeeklyView({
  habits, weekTasks, momentum, habitScore, taskScore, moodScore, moodAvg, moodWeek,
  weekStart, savedQuote, userId,
  onSaveQuote, onOpenPanel, cardOrder, onReorder, onToggleTask,
  editing, onResize, onRemoveCard, onAddCard,
}) {
  const order = cardOrder?.length ? cardOrder : DEFAULT_ORDER

  // Build 7-day habit grid
  const today = format(new Date(), 'yyyy-MM-dd')
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(weekStart), i)
    return format(d, 'yyyy-MM-dd')
  })

  function openPanel(type, data) { onOpenPanel({ type, data }) }

  const CARDS = {
    quote: (
      <div className="card" style={{ textAlign: 'center' }}>
        <WeeklyQuote
          userId={userId}
          weekStart={weekStart}
          savedQuote={savedQuote}
          onSave={onSaveQuote}
        />
      </div>
    ),

    momentum: (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3>Momentum</h3>
          {momentum >= 80 && <span style={{ fontSize: 13 }}>🔥 On fire</span>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <ArcRing
            value={momentum}
            max={100}
            size={120}
            strokeWidth={10}
            color={momentum >= 70 ? 'var(--finance)' : momentum >= 40 ? 'var(--creative)' : 'var(--personal)'}
            label={momentum}
            sublabel="this week"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Habits', pts: Math.round(habitScore), max: 40, color: 'var(--personal)' },
              { label: 'Tasks',  pts: Math.round(taskScore),  max: 40, color: 'var(--career)'   },
              { label: 'Mood',   pts: Math.round(moodScore),  max: 20, color: 'var(--wellness)'  },
            ].map(({ label, pts, max, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-2)', width: 44 }}>{label}</span>
                <div style={{ height: 4, width: 90, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((pts/max)*100)}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', width: 30 }}>{pts}/{max}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),

    tasks: (
      <div className="card card-career">
        <div className="flex items-center justify-between mb-4">
          <h3>This week</h3>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>
            {weekTasks.filter(t => t.complete).length}/{weekTasks.length} done
          </p>
        </div>
        {weekTasks.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No tasks this week.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {weekTasks.slice(0, 8).map(task => (
              <div key={task.id} onClick={e => { e.stopPropagation(); onToggleTask(task) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <div className={`toggle-dot ${task.complete ? 'done' : ''}`} style={{ flexShrink: 0 }}>
                  {task.complete && <Check size={10} color="white" strokeWidth={3} />}
                </div>
                <span style={{ flex: 1, fontSize: 13, textDecoration: task.complete ? 'line-through' : 'none', color: task.complete ? 'var(--text-3)' : 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.specific_task}
                </span>
                <span className="mono">{task.area}</span>
              </div>
            ))}
            {weekTasks.length > 8 && <p style={{ fontSize: 11, color: 'var(--text-3)', paddingTop: 2 }}>+{weekTasks.length - 8} more</p>}
          </div>
        )}
      </div>
    ),

    'habit-grid': (
      <div className="card card-personal">
        <div className="flex items-center justify-between mb-4">
          <h3>Habit week</h3>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>Mon → Sun</p>
        </div>
        {habits.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No habits tracked yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0 8px 8px 0', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.06em' }}>Habit</th>
                  {DAYS.map((d, i) => (
                    <th key={i} style={{ textAlign: 'center', padding: '0 4px 8px', fontFamily: 'var(--font-mono)', fontSize: 9, color: weekDays[i] === today ? 'var(--personal)' : 'var(--text-3)' }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {habits.map(h => (
                  <tr key={h.id}>
                    <td style={{ padding: '4px 8px 4px 0', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {h.emoji} {h.name}
                    </td>
                    {weekDays.map((date, i) => {
                      const logged = h.weekLogs?.has(date)
                      return (
                        <td key={i} style={{ textAlign: 'center', padding: '4px' }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: '50%', margin: '0 auto',
                            background: logged ? 'var(--personal)' : 'var(--bg-3)',
                            transition: 'background 0.15s',
                          }} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    ),
    calendar: (
      <div className="card card-finance">
        <div className="flex items-center justify-between mb-4">
          <h3>This week's calendar</h3>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>Mon → Sun</p>
        </div>
        <WeeklyAgenda weekStart={weekStart} />
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
            onClick={id !== 'quote' && id !== 'calendar' ? () => openPanel(
              id === 'momentum' ? 'momentum' :
              id === 'tasks'    ? 'tasks'    :
              id === 'habit-grid' ? 'habits' : id,
              { habits, tasks: weekTasks, momentum, habitScore, taskScore, moodScore, moodAvg, moodWeek, weekTasks, toggleTask: () => {} }
            ) : undefined}
          >
            {CARDS[id] || null}
          </SortableCard>
        ))}
      </DraggableCardList>
    </div>
  )
}
