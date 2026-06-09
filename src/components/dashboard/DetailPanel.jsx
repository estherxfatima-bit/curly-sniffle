import { X, Check, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import ArcRing from '../ui/ArcRing'

const TITLES = {
  habits:          'Today\'s habits',
  todos:           'Daily to-dos',
  priority:        'Priority task',
  mood:            'Mood this week',
  water:           'Hydration',
  quote:           'Weekly quote',
  momentum:        'Momentum breakdown',
  tasks:           'This week\'s tasks',
  'habit-grid':    'Weekly habit grid',
  'habit-rings':   'Monthly habit completion',
  'goal-rings':    'Goal progress',
  'finance-summary':'Monthly finances',
  'content-progress':'Content batches',
  'q-goals':       'Quarterly goals',
  'quarterly-wins':'Quarterly wins',
  books:           'Books this quarter',
  'parking-lot':   'Idea parking lot',
  'mood-trend':    'Mood trend',
}

export default function DetailPanel({ panel, onClose }) {
  if (!panel) return null
  const { type, data } = panel

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(13,8,5,0.28)', zIndex: 199, backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 460, maxWidth: '95vw',
        background: 'var(--card-bg)',
        borderLeft: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 200,
        display: 'flex', flexDirection: 'column',
        animation: 'slideRight 0.22s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h3 style={{ fontSize: '1rem' }}>{TITLES[type] || 'Details'}</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          <PanelContent type={type} data={data} />
        </div>
      </div>
    </>
  )
}

function PanelContent({ type, data }) {
  if (!data) return <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No data available.</p>

  if (type === 'habits') {
    const { habits, toggleHabit } = data
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {habits.length === 0 && <p style={{ color: 'var(--text-3)', fontSize: 13, fontStyle: 'italic' }}>No habits yet. <Link to="/habits" style={{ color: 'var(--personal)' }}>Add some →</Link></p>}
        {habits.map(h => (
          <div key={h.id} onClick={() => !h.done && toggleHabit(h)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 'var(--radius)', cursor: h.done ? 'default' : 'pointer' }}>
            <div className={`toggle-dot ${h.done ? 'done' : ''}`} style={{ borderColor: 'var(--personal)' }}>
              {h.done && <Check size={11} color="white" strokeWidth={3} />}
            </div>
            <span style={{ fontSize: 14, flex: 1, textDecoration: h.done ? 'line-through' : 'none', color: h.done ? 'var(--text-3)' : 'var(--text)' }}>
              {h.emoji} {h.name}
            </span>
            {h.streak >= 3 && <span style={{ fontSize: 13 }}>🔥 {h.streak}</span>}
            {h.streak > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>{h.streak}d</span>}
          </div>
        ))}
        <Link to="/habits" className="btn btn-ghost w-full mt-3" style={{ justifyContent: 'center' }}>
          Manage habits <ArrowRight size={13} />
        </Link>
      </div>
    )
  }

  if (type === 'tasks') {
    const { tasks, toggleTask } = data
    const incomplete = tasks.filter(t => !t.complete)
    const complete   = tasks.filter(t => t.complete)
    return (
      <div>
        {incomplete.length === 0 && complete.length === 0 && (
          <p style={{ color: 'var(--text-3)', fontSize: 13, fontStyle: 'italic' }}>No tasks this week. <Link to="/weekly" style={{ color: 'var(--career)' }}>Plan your week →</Link></p>
        )}
        {incomplete.length > 0 && (
          <>
            <p className="mono mb-3">Remaining ({incomplete.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {incomplete.map(t => (
                <TaskRow key={t.id} task={t} onToggle={() => toggleTask(t)} />
              ))}
            </div>
          </>
        )}
        {complete.length > 0 && (
          <>
            <p className="mono mb-3">Done ({complete.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {complete.map(t => <TaskRow key={t.id} task={t} onToggle={() => toggleTask(t)} />)}
            </div>
          </>
        )}
        <Link to="/weekly" className="btn btn-ghost w-full mt-4" style={{ justifyContent: 'center' }}>
          Weekly plan <ArrowRight size={13} />
        </Link>
      </div>
    )
  }

  if (type === 'goals') {
    const { goals, tasks } = data
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {goals.map(g => {
          const linked = tasks.filter(t => t.goal_id === g.id)
          const done   = linked.filter(t => t.complete).length
          const pct    = linked.length ? Math.round((done / linked.length) * 100) : 0
          return (
            <div key={g.id} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 'var(--radius)' }}>
              <ArcRing value={pct} max={100} size={56} strokeWidth={5} color="var(--career)" label={`${pct}%`} fontSize={11} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--career)', textTransform: 'uppercase', marginBottom: 3 }}>{g.category}</p>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{g.primary_goal}</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{done}/{linked.length} tasks done</p>
              </div>
            </div>
          )
        })}
        <Link to="/goals" className="btn btn-ghost w-full mt-2" style={{ justifyContent: 'center' }}>Manage goals <ArrowRight size={13} /></Link>
      </div>
    )
  }

  if (type === 'momentum') {
    const { momentum, habitScore, taskScore, moodScore, moodAvg, habits, weekTasks } = data
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <ArcRing value={momentum} max={100} size={140} strokeWidth={11}
            color={momentum >= 70 ? 'var(--finance)' : momentum >= 40 ? 'var(--creative)' : 'var(--personal)'}
            label={momentum} sublabel="this week" />
        </div>
        {[
          { label: 'Habits', score: Math.round(habitScore), max: 40, note: `${habits.filter(h=>h.done).length}/${habits.length} today`, color: 'var(--personal)' },
          { label: 'Tasks', score: Math.round(taskScore), max: 40, note: `${weekTasks.filter(t=>t.complete).length}/${weekTasks.length} this week`, color: 'var(--career)' },
          { label: 'Mood', score: Math.round(moodScore), max: 20, note: moodAvg ? `avg ${moodAvg.toFixed(1)}/5` : 'not logged', color: 'var(--wellness)' },
        ].map(({ label, score, max, note, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 'var(--radius)' }}>
            <ArcRing value={score} max={max} size={52} strokeWidth={5} color={color} label={score} fontSize={11} />
            <div>
              <p style={{ fontWeight: 500, fontSize: 13 }}>{label}</p>
              <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{note} · worth {max} pts</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'mood') {
    const { moodWeek } = data
    const avg = moodWeek.length ? (moodWeek.reduce((s,m) => s + m.mood_score, 0) / moodWeek.length).toFixed(1) : null
    const EMOJIS = { 1: '😔', 2: '😐', 3: '🙂', 4: '😊', 5: '🤩' }
    return (
      <div>
        {avg && <p style={{ fontSize: '2rem', fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--wellness)', marginBottom: 4 }}>{avg}<span style={{ fontSize: '1rem', color: 'var(--text-3)' }}>/5</span></p>}
        <p className="mono mb-4">Weekly average</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {moodWeek.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 'var(--radius)' }}>
              <span style={{ fontSize: 20 }}>{EMOJIS[m.mood_score]}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{m.log_date}</p>
              </div>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--wellness)' }}>{m.mood_score}</span>
            </div>
          ))}
        </div>
        <Link to="/insights" className="btn btn-ghost w-full mt-4" style={{ justifyContent: 'center' }}>Full insights <ArrowRight size={13} /></Link>
      </div>
    )
  }

  if (type === 'water') {
    const { hydration } = data
    const goal = 2500
    const pct = Math.min(100, Math.round((hydration / goal) * 100))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 20 }}>
        <ArcRing value={hydration} max={goal} size={140} strokeWidth={11} color="var(--wellness)" label={hydration} sublabel="ml today" />
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{pct}% of {goal}ml goal</p>
        <Link to="/wellness" className="btn btn-ghost" style={{ justifyContent: 'center' }}>Log hydration <ArrowRight size={13} /></Link>
      </div>
    )
  }

  if (type === 'finance-summary') {
    const { totalIncome, totalFixed, totalVariable, taxPot, takeHome } = data
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { label: 'Monthly income', value: totalIncome, color: 'var(--finance)' },
          { label: 'Fixed expenses', value: totalFixed, color: 'var(--text)' },
          { label: 'Variable (this month)', value: totalVariable, color: 'var(--text)' },
          { label: 'Tax pot (25%)', value: taxPot, color: 'var(--creative)' },
          { label: 'Take-home', value: takeHome, color: takeHome >= 0 ? 'var(--finance)' : 'var(--danger)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 'var(--radius)' }}>
            <p style={{ fontSize: 13 }}>{label}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color }}>£{value.toFixed(0)}</p>
          </div>
        ))}
        <Link to="/finance" className="btn btn-ghost w-full mt-2" style={{ justifyContent: 'center' }}>Finance details <ArrowRight size={13} /></Link>
      </div>
    )
  }

  // Fallback for list-type panels (quarterly wins, books, parking-lot, etc.)
  if (['quarterly-wins', 'books', 'parking-lot'].includes(type)) {
    const items = data.items || []
    return (
      <div>
        {items.length === 0 && <p style={{ color: 'var(--text-3)', fontSize: 13, fontStyle: 'italic' }}>Nothing here yet — add from the dashboard card.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, i) => (
            <div key={i} style={{ padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 'var(--radius)', fontSize: 13 }}>
              {item}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Open the full section for more details.</p>
  )
}

function TaskRow({ task, onToggle }) {
  return (
    <div onClick={onToggle} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div className={`toggle-dot ${task.complete ? 'done' : ''}`} style={{ marginTop: 1, flexShrink: 0 }}>
        {task.complete && <Check size={11} color="white" strokeWidth={3} />}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, textDecoration: task.complete ? 'line-through' : 'none', color: task.complete ? 'var(--text-3)' : 'var(--text)' }}>{task.specific_task}</p>
        <p className="mono" style={{ marginTop: 2 }}>{task.area}</p>
      </div>
    </div>
  )
}
