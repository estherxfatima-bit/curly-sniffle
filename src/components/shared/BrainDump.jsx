import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { format, startOfWeek } from 'date-fns'
import { getCurrentQuarter } from '../../lib/constants'
import { Plus, Trash2, Check, ExternalLink, RotateCcw, ChevronDown, Sunrise, CalendarDays, Target } from 'lucide-react'

const CATEGORIES = ['', 'Career', 'Creative', 'Personal', 'Financial', 'Health', 'Other']

// idea_parking_lot.category -> daily_todos.category
const CAT_TO_TODO_CATEGORY = {
  Career: 'Work', Creative: 'Creative', Personal: 'Personal',
  Financial: 'Personal', Health: 'Health', Other: 'Personal',
}

// idea_parking_lot.category -> weekly_tasks.area
const CAT_TO_TASK_AREA = {
  Career: 'Career', Creative: 'Creative', Personal: 'Personal',
  Financial: 'Financial', Health: 'Health/Wellness', Other: 'Other',
}

// idea_parking_lot.category -> goals.category
const CAT_TO_GOAL_CATEGORY = {
  Career: 'Career', Creative: 'Creative', Personal: 'Personal',
  Financial: 'Financial', Health: 'Wellness', Other: 'Personal',
}

export default function BrainDump() {
  const { user } = useAuth()
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [category, setCategory] = useState('')
  const [link, setLink] = useState('')
  const [showExtra, setShowExtra] = useState(false)
  const [showActedOn, setShowActedOn] = useState(false)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [expanded, setExpanded] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('idea_parking_lot').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setIdeas(data || [])
    setLoading(false)
  }

  useEffect(() => { if (user) load() }, [user])

  async function addIdea() {
    const t = text.trim()
    if (!t) return
    const { data } = await supabase.from('idea_parking_lot').insert({
      user_id: user.id, text: t, category: category || null, link: link.trim() || null, acted_on: false,
    }).select().single()
    if (data) setIdeas(prev => [data, ...prev])
    setText(''); setCategory(''); setLink(''); setShowExtra(false)
  }

  async function toggleActedOn(idea) {
    const acted_on = !idea.acted_on
    await supabase.from('idea_parking_lot').update({ acted_on }).eq('id', idea.id)
    setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, acted_on } : i))
  }

  async function removeIdea(id) {
    await supabase.from('idea_parking_lot').delete().eq('id', id)
    setIdeas(prev => prev.filter(i => i.id !== id))
  }

  async function markActedOn(idea) {
    await supabase.from('idea_parking_lot').update({ acted_on: true }).eq('id', idea.id)
    setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, acted_on: true } : i))
    setOpenMenuId(null)
  }

  async function sendToDailyTodo(idea) {
    await supabase.from('daily_todos').insert({
      user_id: user.id, text: idea.text, date: format(new Date(), 'yyyy-MM-dd'),
      category: CAT_TO_TODO_CATEGORY[idea.category] || 'Personal', complete: false,
    })
    await markActedOn(idea)
  }

  async function sendToWeeklyTask(idea) {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    await supabase.from('weekly_tasks').insert({
      user_id: user.id, week_start: weekStart,
      area: CAT_TO_TASK_AREA[idea.category] || 'Personal', action: '', frequency: 'One-off',
      specific_task: idea.text, complete: false, carried_forward: false,
    })
    await markActedOn(idea)
  }

  async function sendToQuarterlyGoal(idea) {
    await supabase.from('goals').insert({
      user_id: user.id, category: CAT_TO_GOAL_CATEGORY[idea.category] || 'Personal',
      primary_goal: idea.text, key_actions: '', success_metrics: '',
      quarter: getCurrentQuarter(), year: new Date().getFullYear(),
      tracking_type: 'tasks', tasks: [],
    })
    await markActedOn(idea)
  }

  const active = ideas.filter(i => !i.acted_on)
  const acted = ideas.filter(i => i.acted_on)

  return (

    <div className="card card-wellness">
      <button
        className="btn btn-ghost"
        style={{ width: '100%', justifyContent: 'space-between', padding: '0 0 4px', marginBottom: expanded ? 12 : 0 }}
        onClick={() => setExpanded(v => !v)}
      >
        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
          Brain dump {active.length > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', fontWeight: 400 }}>{active.length} idea{active.length !== 1 ? 's' : ''}</span>}
        </span>
        <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', color: 'var(--text-3)' }} />
      </button>

      {!expanded && (
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {active.length === 0 ? 'Nothing parked yet — tap to open.' : `${active.length} idea${active.length !== 1 ? 's' : ''} parked — tap to view.`}
        </p>
      )}

      {expanded && (
      <>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
        Things you don't want to lose but don't need to do right now. Send them to today, this week, or a quarterly goal when you're ready.
      </p>

      <div className="flex items-center gap-2 mb-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addIdea() }}
          placeholder="Park an idea or future task…"
          style={{ flex: 1, fontSize: 13 }}
        />
        <button className="btn-icon btn" onClick={() => setShowExtra(v => !v)} title="Add category/link">
          <ChevronDown size={14} style={{ transform: showExtra ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>
        <button className="btn btn-wellness btn-sm" style={{ color: '#fff' }} onClick={addIdea}>
          <Plus size={13} />
        </button>
      </div>

      {showExtra && (
        <div className="flex items-center gap-2 mb-3">
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ fontSize: 12, flex: 1 }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c || 'No category'}</option>)}
          </select>
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="Link (optional)" style={{ fontSize: 12, flex: 1 }} />
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading…</p>
      ) : active.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
          Nothing parked right now.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {active.map(idea => (
            <IdeaRow
              key={idea.id}
              idea={idea}
              menuOpen={openMenuId === idea.id}
              onToggleMenu={() => setOpenMenuId(prev => prev === idea.id ? null : idea.id)}
              onCloseMenu={() => setOpenMenuId(null)}
              onToggle={toggleActedOn}
              onRemove={removeIdea}
              onSendDaily={sendToDailyTodo}
              onSendWeekly={sendToWeeklyTask}
              onSendGoal={sendToQuarterlyGoal}
            />
          ))}
        </div>
      )}

      {acted.length > 0 && (
        <div className="mt-3">
          <button className="btn btn-ghost btn-xs" onClick={() => setShowActedOn(v => !v)}>
            <ChevronDown size={12} style={{ transform: showActedOn ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            {showActedOn ? 'Hide' : 'Show'} acted on ({acted.length})
          </button>
          {showActedOn && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {acted.map(idea => (
                <IdeaRow
                  key={idea.id}
                  idea={idea}
                  menuOpen={false}
                  onToggleMenu={() => {}}
                  onCloseMenu={() => {}}
                  onToggle={toggleActedOn}
                  onRemove={removeIdea}
                  onSendDaily={sendToDailyTodo}
                  onSendWeekly={sendToWeeklyTask}
                  onSendGoal={sendToQuarterlyGoal}
                />
              ))}
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  )
}

function IdeaRow({ idea, menuOpen, onToggleMenu, onCloseMenu, onToggle, onRemove, onSendDaily, onSendWeekly, onSendGoal }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 'var(--radius)', borderLeft: '2px solid var(--wellness)', opacity: idea.acted_on ? 0.6 : 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, textDecoration: idea.acted_on ? 'line-through' : 'none' }}>{idea.text}</p>
        <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
          {idea.category && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--wellness)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{idea.category}</span>}
          {idea.link && (<a href={idea.link} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><ExternalLink size={9} /> link</a>)}
        </div>
      </div>
      {!idea.acted_on && (
        <div style={{ position: 'relative' }}>
          <button className="btn-icon" style={{ padding: 2 }} title="Send to…" onClick={onToggleMenu}>
            <ChevronDown size={12} />
          </button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 89 }} onClick={onCloseMenu} />
              <div className="card" style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 90,
                padding: 6, minWidth: 170, display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <button className="btn btn-ghost btn-xs" style={{ justifyContent: 'flex-start' }} onClick={() => onSendDaily(idea)}>
                  <Sunrise size={12} /> Send to today's to-dos
                </button>
                <button className="btn btn-ghost btn-xs" style={{ justifyContent: 'flex-start' }} onClick={() => onSendWeekly(idea)}>
                  <CalendarDays size={12} /> Send to weekly plan
                </button>
                <button className="btn btn-ghost btn-xs" style={{ justifyContent: 'flex-start' }} onClick={() => onSendGoal(idea)}>
                  <Target size={12} /> Send to quarterly goal
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <button className="btn-icon" style={{ padding: 2 }} title={idea.acted_on ? 'Mark as not acted on' : 'Mark as acted on'} onClick={() => onToggle(idea)}>
        {idea.acted_on ? <RotateCcw size={12} /> : <Check size={12} />}
      </button>
      <button className="btn-icon" style={{ padding: 2 }} onClick={() => onRemove(idea.id)}><Trash2 size={12} /></button>
    </div>
  )
}
