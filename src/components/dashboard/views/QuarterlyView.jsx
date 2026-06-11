import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import ArcRing from '../../ui/ArcRing'
import { SortableCard, DraggableCardList } from '../DraggableCard'
import AddWidgetMenu from '../AddWidgetMenu'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { Link } from 'react-router-dom'

export const CARD_LABELS = {
  'q-goals': 'Quarterly goals',
  'quarterly-wins': 'Quarterly wins',
  books: 'Books this quarter',
  'parking-lot': 'Idea parking lot',
  'mood-trend': 'Mood trend',
}

export const DEFAULT_ORDER = [
  { id: 'q-goals', size: 'wide' },
  { id: 'quarterly-wins', size: 'square' },
  { id: 'books', size: 'square' },
  { id: 'parking-lot', size: 'square' },
  { id: 'mood-trend', size: 'wide' },
]

function EditableList({ items, onAdd, onRemove, placeholder, color = 'var(--career)' }) {
  const [input, setInput] = useState('')

  function add() {
    const t = input.trim()
    if (t) { onAdd(t); setInput('') }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={placeholder}
          style={{ flex: 1, fontSize: 13 }}
        />
        <button className="btn btn-sm btn-ghost" onClick={add}><Plus size={12} /></button>
      </div>
      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>Nothing yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 'var(--radius)', borderLeft: `2px solid ${color}` }}>
              <p style={{ flex: 1, fontSize: 13 }}>{item}</p>
              <button className="btn-icon" style={{ padding: 2 }} onClick={() => onRemove(i)}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function QuarterlyView({
  goals, weekTasks, moodTrend,
  quarterlyNotes, userId, quarter,
  onOpenPanel, cardOrder, onReorder,
  onNotesUpdate,
  editing, onResize, onRemoveCard, onAddCard,
}) {
  const order = cardOrder?.length ? cardOrder : DEFAULT_ORDER
  const notes = quarterlyNotes || { wins: [], books: [], parking_lot: [] }

  async function saveNotes(updated) {
    onNotesUpdate(updated)
    await supabase.from('quarterly_notes').upsert(
      { user_id: userId, quarter, ...updated },
      { onConflict: 'user_id,quarter' }
    )
  }

  function addTo(field, item) {
    saveNotes({ ...notes, [field]: [...(notes[field] || []), item] })
  }

  function removeFrom(field, idx) {
    saveNotes({ ...notes, [field]: (notes[field] || []).filter((_, i) => i !== idx) })
  }

  // Goal rings for this quarter
  const qGoals = goals.filter(g => g.quarter === quarter)
  const goalRings = qGoals.map(goal => {
    const linked = weekTasks.filter(t => t.goal_id === goal.id)
    const done   = linked.filter(t => t.complete).length
    return { ...goal, pct: linked.length ? Math.round((done / linked.length) * 100) : 0, done, total: linked.length }
  })

  // Mood trend: group by week
  const trendData = (moodTrend || [])
    .sort((a, b) => a.log_date.localeCompare(b.log_date))
    .slice(-60) // last 60 entries
    .map(m => ({ date: m.log_date.slice(5), mood: m.mood_score }))

  function openPanel(type, data) { onOpenPanel({ type, data }) }

  const CARDS = {
    'q-goals': (
      <div className="card card-career">
        <div className="flex items-center justify-between mb-4">
          <h3>{quarter} Goals</h3>
          <Link to="/goals" style={{ fontSize: 12, color: 'var(--career)', textDecoration: 'none' }}>Manage →</Link>
        </div>
        {goalRings.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
            No goals for {quarter}. <Link to="/goals" style={{ color: 'var(--career)' }}>Set some →</Link>
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {goalRings.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <ArcRing value={g.pct} max={100} size={58} strokeWidth={5} color="var(--career)" label={`${g.pct}%`} fontSize={11} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--career)', textTransform: 'uppercase', marginBottom: 2 }}>{g.category}</p>
                  <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.primary_goal}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{g.done}/{g.total} linked tasks</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),

    'quarterly-wins': (
      <div className="card card-finance">
        <h3 style={{ marginBottom: 16 }}>Quarterly wins</h3>
        <EditableList
          items={notes.wins || []}
          onAdd={item => addTo('wins', item)}
          onRemove={idx => removeFrom('wins', idx)}
          placeholder="Add a win from this quarter…"
          color="var(--finance)"
        />
      </div>
    ),

    'books': (
      <div className="card card-creative">
        <h3 style={{ marginBottom: 16 }}>Books this quarter</h3>
        <EditableList
          items={notes.books || []}
          onAdd={item => addTo('books', item)}
          onRemove={idx => removeFrom('books', idx)}
          placeholder="Book title…"
          color="var(--creative)"
        />
      </div>
    ),

    'parking-lot': (
      <div className="card card-wellness">
        <h3 style={{ marginBottom: 16 }}>Idea parking lot</h3>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>Ideas you don't want to lose but aren't acting on yet.</p>
        <EditableList
          items={notes.parking_lot || []}
          onAdd={item => addTo('parking_lot', item)}
          onRemove={idx => removeFrom('parking_lot', idx)}
          placeholder="Capture an idea…"
          color="var(--wellness)"
        />
      </div>
    ),

    'mood-trend': (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3>Mood trend</h3>
          <p className="mono">Last 60 days</p>
        </div>
        {trendData.length < 2 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>Not enough mood data yet. Log daily to see your trend.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-3)' }} interval="preserveStartEnd" />
              <YAxis domain={[1, 5]} ticks={[1,2,3,4,5]} tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-3)' }} width={20} />
              <Tooltip
                contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                labelStyle={{ color: 'var(--text-3)' }}
                itemStyle={{ color: 'var(--wellness)' }}
              />
              <Line type="monotone" dataKey="mood" stroke="var(--wellness)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
        <Link to="/insights" style={{ display: 'block', marginTop: 12, fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', textAlign: 'center' }}>
          Full insights →
        </Link>
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
            onClick={['quarterly-wins', 'books', 'parking-lot'].includes(id) ? () => openPanel(id === 'quarterly-wins' ? 'quarterly-wins' : id === 'books' ? 'books' : 'parking-lot', { items: notes[id === 'quarterly-wins' ? 'wins' : id === 'books' ? 'books' : 'parking_lot'] }) : undefined}
          >
            {CARDS[id] || null}
          </SortableCard>
        ))}
      </DraggableCardList>
    </div>
  )
}
