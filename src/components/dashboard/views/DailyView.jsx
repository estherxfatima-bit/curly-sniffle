import { Check, Droplets, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import ArcRing from '../../ui/ArcRing'
import DailyTodos from '../DailyTodos'
import MoodWidget from '../MoodWidget'
import CurrentlyReading from '../CurrentlyReading'
import { SortableCard, DraggableCardList } from '../DraggableCard'

const DEFAULT_ORDER = ['priority', 'todos', 'habits', 'mood', 'water', 'reading']
const HYDRATION_GOAL = 2500

export default function DailyView({
  habits, weekTasks, hydration, onOpenPanel,
  cardOrder, onReorder, user, today,
  onHydrationAdd,
}) {
  const order = (cardOrder?.length ? cardOrder : DEFAULT_ORDER)

  function openPanel(type, data) { onOpenPanel({ type, data }) }

  const priorityTask = weekTasks.find(t => !t.complete) || null

  const CARDS = {
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {habits.map(h => (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className={`toggle-dot ${h.done ? 'done' : ''}`} style={{ borderColor: h.done ? 'var(--success)' : 'var(--personal)', cursor: h.done ? 'default' : 'pointer' }}>
                  {h.done && <Check size={10} color="white" strokeWidth={3} />}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: h.done ? 'var(--text-3)' : 'var(--text)', textDecoration: h.done ? 'line-through' : 'none' }}>
                  {h.emoji} {h.name}
                </span>
                {h.done && h.streak >= 3 && <span style={{ fontSize: 12 }}>🔥 {h.streak}</span>}
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
  }

  return (
    <DraggableCardList cardOrder={order} onReorder={onReorder}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {order.map(id => (
          <SortableCard
            key={id}
            id={id}
            onClick={id !== 'todos' && id !== 'mood' && id !== 'reading' ? () => openPanel(id === 'habits' ? 'habits' : id === 'water' ? 'water' : id === 'priority' ? 'tasks' : id, { habits, tasks: weekTasks, hydration }) : undefined}
          >
            {CARDS[id] || null}
          </SortableCard>
        ))}
      </div>
    </DraggableCardList>
  )
}
