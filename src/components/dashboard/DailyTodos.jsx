import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { format } from 'date-fns'
import { Plus, Trash2, ChevronDown, ChevronRight, Check, Clock } from 'lucide-react'

const DEFAULT_CATEGORIES = ['Work', 'Personal', 'Errands', 'Creative', 'Sanctum', 'Health']

const TIME_OPTIONS = ['15 mins', '30 mins', '45 mins', '1 hour', '1.5 hours', '2 hours', '3 hours']

const CATEGORY_COLORS = {
  Work:     'var(--career)',
  Personal: 'var(--personal)',
  Errands:  'var(--creative)',
  Creative: 'var(--creative)',
  Sanctum:  'var(--wellness)',
  Health:   'var(--wellness)',
}

export default function DailyTodos() {
  const { user } = useAuth()
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState('all') // all | incomplete | complete
  const [categoryFilter, setCategoryFilter] = useState('')
  const [expanded, setExpanded] = useState({})
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const inputRef = useRef(null)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => { if (user) loadTodos() }, [user])

  // Carry over incomplete from yesterday at midnight (simple: check if any incomplete yesterday tasks exist)
  useEffect(() => {
    if (user) carryOver()
  }, [user])

  async function carryOver() {
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')
    const { data: yesterdayTodos } = await supabase
      .from('daily_todos')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', yesterday)
      .eq('complete', false)
      .eq('archived', false)

    if (!yesterdayTodos?.length) return

    // Check if we already carried over (avoid double carry)
    const { data: alreadyCarried } = await supabase
      .from('daily_todos')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('carried_from', yesterday)
      .limit(1)

    if (alreadyCarried?.length) return

    await supabase.from('daily_todos').insert(
      yesterdayTodos.map(t => ({
        user_id: user.id,
        text: t.text,
        complete: false,
        category: t.category,
        time_allocation: t.time_allocation,
        subtasks: t.subtasks,
        date: today,
        carried_from: yesterday,
      }))
    )
    // Archive the yesterday ones
    await supabase.from('daily_todos').update({ archived: true })
      .eq('user_id', user.id).eq('date', yesterday).eq('complete', false)
  }

  async function loadTodos() {
    setLoading(true)
    const { data } = await supabase
      .from('daily_todos')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('archived', false)
      .order('sort_order')
      .order('created_at')
    setTodos(data || [])
    setLoading(false)
  }

  async function addTodo() {
    const text = input.trim()
    if (!text) return
    const { data } = await supabase.from('daily_todos').insert({
      user_id: user.id, text, date: today, category: 'Personal', complete: false,
    }).select().single()
    if (data) setTodos(prev => [...prev, data])
    setInput('')
    inputRef.current?.focus()
  }

  async function toggleTodo(todo) {
    // If all subtasks exist, check if all done
    const newVal = !todo.complete
    await supabase.from('daily_todos').update({ complete: newVal }).eq('id', todo.id)
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, complete: newVal } : t))
  }

  async function deleteTodo(id) {
    await supabase.from('daily_todos').delete().eq('id', id)
    setTodos(prev => prev.filter(t => t.id !== id))
  }

  async function updateField(id, field, value) {
    await supabase.from('daily_todos').update({ [field]: value }).eq('id', id)
    setTodos(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  async function toggleSubtask(todo, subtaskId) {
    const subtasks = (todo.subtasks || []).map(s =>
      s.id === subtaskId ? { ...s, complete: !s.complete } : s
    )
    // Auto-complete parent if all subtasks done
    const allDone = subtasks.every(s => s.complete)
    await supabase.from('daily_todos').update({ subtasks, complete: allDone }).eq('id', todo.id)
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks, complete: allDone } : t))
  }

  async function addSubtask(todo, text) {
    if (!text.trim()) return
    const subtasks = [...(todo.subtasks || []), { id: Date.now().toString(), text: text.trim(), complete: false }]
    await supabase.from('daily_todos').update({ subtasks }).eq('id', todo.id)
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, subtasks } : t))
  }

  const filtered = todos.filter(t => {
    if (filter === 'complete' && !t.complete) return false
    if (filter === 'incomplete' && t.complete) return false
    if (categoryFilter && t.category !== categoryFilter) return false
    return true
  })

  const doneCount = todos.filter(t => t.complete).length
  const totalCount = todos.length

  return (
    <div className="card card-career">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3>Today's to-dos</h3>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {doneCount}/{totalCount} done · {format(new Date(), 'EEE d MMM')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'incomplete', 'complete'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm ${filter === f ? 'btn-career' : 'btn-ghost'}`} style={filter === f ? { color: '#fff' } : {}}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 mb-4 wrap">
        <button onClick={() => setCategoryFilter('')} className={`btn btn-xs ${!categoryFilter ? 'btn-career' : 'btn-ghost'}`} style={!categoryFilter ? { color: '#fff' } : {}}>All</button>
        {categories.map(c => (
          <button key={c} onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)} className={`btn btn-xs ${categoryFilter === c ? 'btn-career' : 'btn-ghost'}`} style={categoryFilter === c ? { color: '#fff' } : {}}>
            {c}
          </button>
        ))}
      </div>

      {/* Quick-add input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a task… press Enter"
          onKeyDown={e => e.key === 'Enter' && addTodo()}
          style={{ flex: 1 }}
        />
        <button className="btn btn-career btn-sm" style={{ color: '#fff', flexShrink: 0 }} onClick={addTodo}>
          <Plus size={14} />
        </button>
      </div>

      {/* Todo list */}
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0', fontStyle: 'italic', fontSize: 13 }}>
          {filter === 'complete' ? 'Nothing completed yet today.' : 'No tasks here — add something above.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              categories={categories}
              expanded={!!expanded[todo.id]}
              onToggleExpand={() => setExpanded(p => ({ ...p, [todo.id]: !p[todo.id] }))}
              onToggle={() => toggleTodo(todo)}
              onDelete={() => deleteTodo(todo.id)}
              onUpdateField={(field, val) => updateField(todo.id, field, val)}
              onToggleSubtask={(sid) => toggleSubtask(todo, sid)}
              onAddSubtask={(text) => addSubtask(todo, text)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TodoItem({ todo, categories, expanded, onToggleExpand, onToggle, onDelete, onUpdateField, onToggleSubtask, onAddSubtask }) {
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [subtaskInput, setSubtaskInput] = useState('')
  const subtasks = todo.subtasks || []
  const catColor = CATEGORY_COLORS[todo.category] || 'var(--career)'

  function submitSubtask() {
    if (subtaskInput.trim()) { onAddSubtask(subtaskInput.trim()); setSubtaskInput(''); setAddingSubtask(false) }
  }

  return (
    <div style={{
      background: todo.complete ? 'var(--bg-2)' : 'var(--bg)',
      border: '1.5px solid var(--border)',
      borderLeft: `3px solid ${catColor}`,
      borderRadius: 'var(--radius)',
      padding: '10px 12px',
      transition: 'all 0.2s',
      opacity: todo.complete ? 0.65 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Expand toggle if has subtasks */}
        {subtasks.length > 0 ? (
          <button className="btn-icon btn" style={{ padding: 2 }} onClick={onToggleExpand}>
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : <div style={{ width: 19 }} />}

        {/* Check */}
        <div className={`toggle-dot ${todo.complete ? 'done' : ''}`} onClick={onToggle} style={{ borderColor: catColor }}>
          {todo.complete && <Check size={11} color="white" strokeWidth={3} />}
        </div>

        {/* Text */}
        <span style={{
          flex: 1, fontSize: 13, fontWeight: 500,
          textDecoration: todo.complete ? 'line-through' : 'none',
          color: todo.complete ? 'var(--text-3)' : 'var(--text)',
          transition: 'all 0.2s',
        }}>
          {todo.text}
          {todo.carried_from && (
            <span className="badge badge-warning" style={{ marginLeft: 8, fontSize: 9 }}>from yesterday</span>
          )}
        </span>

        {/* Metadata pills */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
          {todo.time_allocation && (
            <span style={{ fontSize: 10, color: 'var(--text-3)', background: 'var(--bg-3)', borderRadius: 10, padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-mono)' }}>
              <Clock size={9} /> {todo.time_allocation}
            </span>
          )}
          <span style={{ fontSize: 10, color: catColor, background: `${catColor}18`, borderRadius: 10, padding: '2px 7px', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {todo.category}
          </span>

          {/* Options */}
          <select
            value={todo.time_allocation || ''}
            onChange={e => onUpdateField('time_allocation', e.target.value || null)}
            style={{ width: 'auto', padding: '2px 6px', fontSize: 10, background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}
            title="Set time allocation"
          >
            <option value="">⏱</option>
            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={todo.category || 'Personal'}
            onChange={e => onUpdateField('category', e.target.value)}
            style={{ width: 'auto', padding: '2px 6px', fontSize: 10, background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}
            title="Set category"
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <button className="btn-icon btn" style={{ padding: 2, color: 'var(--text-3)' }} onClick={() => setAddingSubtask(v => !v)} title="Add subtask">+</button>
          <button className="btn-icon btn" style={{ padding: 2 }} onClick={onDelete}><Trash2 size={12} /></button>
        </div>
      </div>

      {/* Subtasks */}
      {(expanded && subtasks.length > 0) && (
        <div style={{ marginTop: 8, paddingLeft: 28, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {subtasks.map(sub => (
            <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => onToggleSubtask(sub.id)}>
              <div className={`toggle-dot ${sub.complete ? 'done' : ''}`} style={{ width: 16, height: 16, cursor: 'pointer' }}>
                {sub.complete && <Check size={9} color="white" strokeWidth={3} />}
              </div>
              <span style={{ fontSize: 12, color: sub.complete ? 'var(--text-3)' : 'var(--text-2)', textDecoration: sub.complete ? 'line-through' : 'none' }}>{sub.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add subtask input */}
      {addingSubtask && (
        <div style={{ marginTop: 8, paddingLeft: 28, display: 'flex', gap: 8 }}>
          <input
            value={subtaskInput}
            onChange={e => setSubtaskInput(e.target.value)}
            placeholder="Subtask…"
            style={{ fontSize: 12, flex: 1 }}
            onKeyDown={e => { if (e.key === 'Enter') submitSubtask(); if (e.key === 'Escape') setAddingSubtask(false) }}
            autoFocus
          />
          <button className="btn btn-career btn-xs" style={{ color: '#fff' }} onClick={submitSubtask}>Add</button>
        </div>
      )}
    </div>
  )
}
