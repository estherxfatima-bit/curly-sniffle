import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { format, subDays } from 'date-fns'
import { Plus, Trash2, ChevronDown, ChevronRight, Check, Clock } from 'lucide-react'

const DEFAULT_CATS = ['Work', 'Personal', 'Errands', 'Creative', 'Health']
const TIME_OPTS = ['15 min', '30 min', '45 min', '1 hr', '1.5 hr', '2 hr', '3 hr']

const CAT_COLOR = {
  Work: 'var(--career)',
  Personal: 'var(--personal)',
  Errands: 'var(--creative)',
  Creative: 'var(--creative)',
  Health: 'var(--wellness)',
}
function catColor(c) { return CAT_COLOR[c] || 'var(--career)' }

export default function DailyTodos({ compact = false }) {
  const { user } = useAuth()
  const today     = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  const [todos,   setTodos]   = useState([])
  const [loading, setLoading] = useState(true)
  const [input,   setInput]   = useState('')
  const [statusFilter,   setStatusFilter]   = useState('all')    // all | active | done
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categories, setCategories] = useState(DEFAULT_CATS)
  const [newCatInput, setNewCatInput] = useState('')
  const [showAddCat,  setShowAddCat]  = useState(false)
  const inputRef = useRef(null)

  // Load todos, carrying over yesterday's incomplete tasks atomically
  useEffect(() => {
    if (user) init()
  }, [user])

  async function init() {
    setLoading(true)
    // 1. Carry over yesterday's incomplete (idempotent guard via carried_from)
    const { data: yd } = await supabase
      .from('daily_todos')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', yesterday)
      .eq('complete', false)
      .eq('archived', false)

    if (yd?.length) {
      const { data: alreadyDone } = await supabase
        .from('daily_todos')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', today)
        .eq('carried_from', yesterday)
        .limit(1)

      if (!alreadyDone?.length) {
        // Insert carry-overs then archive yesterday
        await supabase.from('daily_todos').insert(
          yd.map(t => ({
            user_id: user.id,
            text: t.text,
            date: today,
            complete: false,
            category: t.category || 'Personal',
            time_allocation: t.time_allocation,
            subtasks: t.subtasks,
            carried_from: yesterday,
          }))
        )
        await supabase.from('daily_todos')
          .update({ archived: true })
          .eq('user_id', user.id)
          .eq('date', yesterday)
          .eq('complete', false)
      }
    }

    // 2. Load today's todos
    const { data: td } = await supabase
      .from('daily_todos')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('archived', false)
      .order('created_at')

    setTodos(td || [])
    setLoading(false)
  }

  async function addTodo() {
    const text = input.trim()
    if (!text) return
    const { data } = await supabase.from('daily_todos').insert({
      user_id: user.id, text, date: today,
      category: categoryFilter || 'Personal',
      complete: false,
    }).select().single()
    if (data) setTodos(prev => [...prev, data])
    setInput('')
    inputRef.current?.focus()
  }

  async function toggle(todo) {
    const newVal = !todo.complete
    await supabase.from('daily_todos').update({ complete: newVal }).eq('id', todo.id)
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, complete: newVal } : t))
  }

  async function remove(id) {
    await supabase.from('daily_todos').delete().eq('id', id)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  async function updateField(id, field, value) {
    await supabase.from('daily_todos').update({ [field]: value }).eq('id', id)
    setTodos(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  async function toggleSubtask(todo, subId) {
    const subs = (todo.subtasks || []).map(s => s.id === subId ? { ...s, complete: !s.complete } : s)
    const allDone = subs.every(s => s.complete)
    await supabase.from('daily_todos').update({ subtasks: subs, complete: allDone }).eq('id', todo.id)
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks: subs, complete: allDone } : t))
  }

  async function addSubtask(todo, text) {
    const subs = [...(todo.subtasks || []), { id: String(Date.now()), text, complete: false }]
    await supabase.from('daily_todos').update({ subtasks: subs }).eq('id', todo.id)
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks: subs } : t))
  }

  function addCategory() {
    const c = newCatInput.trim()
    if (c && !categories.includes(c)) setCategories(prev => [...prev, c])
    setNewCatInput('')
    setShowAddCat(false)
  }

  const filtered = todos.filter(t => {
    if (statusFilter === 'active' && t.complete) return false
    if (statusFilter === 'done'   && !t.complete) return false
    if (categoryFilter && t.category !== categoryFilter) return false
    return true
  })

  const done  = todos.filter(t => t.complete).length
  const total = todos.length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3>Today's to-dos</h3>
          {!loading && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {done}/{total} done · {format(new Date(), 'EEE d MMM')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'done']).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`btn btn-xs ${statusFilter === f ? 'btn-career' : 'btn-ghost'}`}
              style={statusFilter === f ? { color: '#fff' } : {}}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Quick-add input */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTodo()}
          placeholder="Add task… Enter to save"
          style={{ flex: 1 }}
        />
        <button className="btn btn-career btn-sm" style={{ color: '#fff', flexShrink: 0 }} onClick={addTodo}>
          <Plus size={13} />
        </button>
      </div>

      {/* Category filter chips */}
      <div className="flex items-center gap-2 mb-4 wrap">
        <button
          onClick={() => setCategoryFilter('')}
          className={`btn btn-xs ${!categoryFilter ? 'btn-career' : 'btn-ghost'}`}
          style={!categoryFilter ? { color: '#fff' } : {}}
        >All</button>
        {categories.map(c => (
          <button key={c} onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)}
            className={`btn btn-xs ${categoryFilter === c ? '' : 'btn-ghost'}`}
            style={categoryFilter === c ? { background: catColor(c), color: '#fff', border: 'none' } : {}}
          >
            {c}
          </button>
        ))}
        {showAddCat ? (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <input value={newCatInput} onChange={e => setNewCatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') setShowAddCat(false) }}
              placeholder="Category name" style={{ fontSize: 11, padding: '3px 8px', width: 110 }} autoFocus />
            <button className="btn btn-xs btn-career" style={{ color: '#fff' }} onClick={addCategory}>+</button>
          </div>
        ) : (
          <button className="btn btn-xs btn-ghost" onClick={() => setShowAddCat(true)} title="Add custom category" style={{ color: 'var(--text-3)' }}>+ cat</button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)' }}>
          <p style={{ fontSize: 13, fontStyle: 'italic' }}>
            {statusFilter === 'done' ? 'Nothing completed yet today.' : 'Nothing here — add something above.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              categories={categories}
              onToggle={() => toggle(todo)}
              onRemove={() => remove(todo.id)}
              onUpdateField={(f, v) => updateField(todo.id, f, v)}
              onToggleSubtask={sid => toggleSubtask(todo, sid)}
              onAddSubtask={text => addSubtask(todo, text)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TodoItem({ todo, categories, onToggle, onRemove, onUpdateField, onToggleSubtask, onAddSubtask }) {
  const [expanded,     setExpanded]     = useState(false)
  const [addingSub,    setAddingSub]    = useState(false)
  const [subInput,     setSubInput]     = useState('')
  const [editingTime,  setEditingTime]  = useState(false)
  const [editingCat,   setEditingCat]   = useState(false)
  const subtasks = todo.subtasks || []
  const cc = catColor(todo.category)

  function submitSub() {
    if (subInput.trim()) { onAddSubtask(subInput.trim()); setSubInput('') }
    setAddingSub(false)
  }

  return (
    <div style={{
      background: todo.complete ? 'var(--bg-2)' : 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${todo.complete ? 'var(--border)' : cc}`,
      borderRadius: 'var(--radius)',
      padding: '9px 12px',
      transition: 'opacity 0.2s, transform 0.2s',
      opacity: todo.complete ? 0.62 : 1,
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        {/* Expand chevron */}
        {subtasks.length > 0 ? (
          <button className="btn-icon" style={{ padding: 2, flexShrink: 0, color: 'var(--text-3)' }} onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : <div style={{ width: 18, flexShrink: 0 }} />}

        {/* Toggle dot */}
        <div className={`toggle-dot ${todo.complete ? 'done' : ''}`} onClick={onToggle}
          style={{ borderColor: todo.complete ? 'var(--success)' : cc, flexShrink: 0, cursor: 'pointer' }}>
          {todo.complete && <Check size={10} color="white" strokeWidth={3} />}
        </div>

        {/* Text */}
        <span style={{
          flex: 1,
          fontSize: 13,
          fontWeight: 500,
          color: todo.complete ? 'var(--text-3)' : 'var(--text)',
          textDecoration: todo.complete ? 'line-through' : 'none',
          transition: 'all 0.18s',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {todo.text}
        </span>

        {/* Carried-from label */}
        {todo.carried_from && (
          <span className="badge badge-warning" style={{ fontSize: 9, flexShrink: 0 }}>yesterday</span>
        )}

        {/* Time pill — click to cycle */}
        {editingTime ? (
          <select
            autoFocus
            value={todo.time_allocation || ''}
            onChange={e => { onUpdateField('time_allocation', e.target.value || null); setEditingTime(false) }}
            onBlur={() => setEditingTime(false)}
            style={{ fontSize: 11, padding: '2px 6px', width: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}
          >
            <option value="">No time</option>
            {TIME_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        ) : todo.time_allocation ? (
          <span
            onClick={() => setEditingTime(true)}
            title="Click to change"
            style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-3)', background: 'var(--bg-3)', borderRadius: 10, padding: '2px 7px', cursor: 'pointer', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
            <Clock size={9} /> {todo.time_allocation}
          </span>
        ) : (
          <button onClick={() => setEditingTime(true)} className="btn-icon" style={{ padding: 2, color: 'var(--border)', flexShrink: 0 }} title="Set time">
            <Clock size={12} />
          </button>
        )}

        {/* Category pill — click to cycle */}
        {editingCat ? (
          <select
            autoFocus
            value={todo.category || 'Personal'}
            onChange={e => { onUpdateField('category', e.target.value); setEditingCat(false) }}
            onBlur={() => setEditingCat(false)}
            style={{ fontSize: 11, padding: '2px 6px', width: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <span
            onClick={() => setEditingCat(true)}
            title="Click to change category"
            style={{ fontSize: 9, color: cc, background: `${cc}1a`, borderRadius: 10, padding: '2px 7px', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0 }}>
            {todo.category}
          </span>
        )}

        {/* Add subtask */}
        <button className="btn-icon" style={{ padding: 2, color: 'var(--text-3)', flexShrink: 0 }} onClick={() => setAddingSub(v => !v)} title="Add subtask">
          <Plus size={12} />
        </button>

        {/* Delete */}
        <button className="btn-icon" style={{ padding: 2, flexShrink: 0 }} onClick={onRemove}>
          <Trash2 size={12} />
        </button>
      </div>

      {/* Subtasks */}
      {expanded && subtasks.length > 0 && (
        <div style={{ marginTop: 8, paddingLeft: 42, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {subtasks.map(s => (
            <div key={s.id} onClick={() => onToggleSubtask(s.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <div className={`toggle-dot ${s.complete ? 'done' : ''}`} style={{ width: 16, height: 16, borderColor: cc, flexShrink: 0 }}>
                {s.complete && <Check size={8} color="white" strokeWidth={3} />}
              </div>
              <span style={{ fontSize: 12, color: s.complete ? 'var(--text-3)' : 'var(--text-2)', textDecoration: s.complete ? 'line-through' : 'none' }}>
                {s.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add-subtask input */}
      {addingSub && (
        <div style={{ marginTop: 8, paddingLeft: 42, display: 'flex', gap: 7 }}>
          <input
            value={subInput}
            onChange={e => setSubInput(e.target.value)}
            placeholder="Subtask…"
            style={{ fontSize: 12, flex: 1 }}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') submitSub(); if (e.key === 'Escape') setAddingSub(false) }}
          />
          <button className="btn btn-career btn-xs" style={{ color: '#fff' }} onClick={submitSub}>Add</button>
        </div>
      )}
    </div>
  )
}
