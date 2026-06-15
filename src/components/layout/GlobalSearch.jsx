import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Search, X, CalendarDays, CheckSquare, Target, Film, Lightbulb, Heart, Utensils, BookOpen } from 'lucide-react'

const TYPE_META = {
  weekly_task: { label: 'Weekly task', icon: CalendarDays, color: 'var(--career)', to: '/weekly' },
  daily_todo:  { label: 'To-do',       icon: CheckSquare,  color: 'var(--career)', to: '/' },
  goal:        { label: 'Goal',        icon: Target,       color: 'var(--career)', to: '/goals' },
  content_idea:{ label: 'Content idea', icon: Film,        color: 'var(--creative)', to: '/content' },
  brain_dump:  { label: 'Idea',        icon: Lightbulb,    color: 'var(--wellness)', to: '/goals' },
  habit:       { label: 'Habit',       icon: Heart,        color: 'var(--personal)', to: '/habits' },
  meal:        { label: 'Meal',        icon: Utensils,     color: 'var(--wellness)', to: '/wellness' },
  book:        { label: 'Book',        icon: BookOpen,     color: 'var(--creative)', to: '/books' },
}

export default function GlobalSearch({ onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!user) return
    const q = query.trim()

    const handle = setTimeout(async () => {
      if (q.length < 2) { setResults([]); return }
      setLoading(true)
      const term = `%${q}%`
      const [tasks, todos, goals, ideas, brainDump, habits, meals, books] = await Promise.all([
        supabase.from('weekly_tasks').select('id, specific_task, area, week_start').eq('user_id', user.id).ilike('specific_task', term).limit(5),
        supabase.from('daily_todos').select('id, text, date').eq('user_id', user.id).ilike('text', term).limit(5),
        supabase.from('goals').select('id, primary_goal, category').eq('user_id', user.id).ilike('primary_goal', term).limit(5),
        supabase.from('content_ideas').select('id, title, status').eq('user_id', user.id).ilike('title', term).limit(5),
        supabase.from('idea_parking_lot').select('id, text, category').eq('user_id', user.id).ilike('text', term).limit(5),
        supabase.from('habits').select('id, name').eq('user_id', user.id).ilike('name', term).limit(5),
        supabase.from('saved_meals').select('id, name').eq('user_id', user.id).ilike('name', term).limit(5),
        supabase.from('books').select('id, title, author, status').eq('user_id', user.id).ilike('title', term).limit(5),
      ])

      setResults([
        ...(tasks.data || []).map(r => ({ type: 'weekly_task', id: r.id, title: r.specific_task, subtitle: r.area })),
        ...(todos.data || []).map(r => ({ type: 'daily_todo', id: r.id, title: r.text, subtitle: r.date })),
        ...(goals.data || []).map(r => ({ type: 'goal', id: r.id, title: r.primary_goal, subtitle: r.category })),
        ...(ideas.data || []).map(r => ({ type: 'content_idea', id: r.id, title: r.title, subtitle: r.status })),
        ...(brainDump.data || []).map(r => ({ type: 'brain_dump', id: r.id, title: r.text, subtitle: r.category })),
        ...(habits.data || []).map(r => ({ type: 'habit', id: r.id, title: r.name })),
        ...(meals.data || []).map(r => ({ type: 'meal', id: r.id, title: r.name })),
        ...(books.data || []).map(r => ({ type: 'book', id: r.id, title: r.title, subtitle: r.author })),
      ])
      setLoading(false)
    }, 300)

    return () => clearTimeout(handle)
  }, [query, user])

  function go(result) {
    const meta = TYPE_META[result.type]
    onClose()
    navigate(meta.to)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '10vh 16px' }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 520, padding: 0, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <Search size={16} color="var(--text-3)" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose() }}
            placeholder="Search tasks, todos, goals, ideas, habits, meals, books…"
            style={{ flex: 1, border: 'none', fontSize: 14, padding: '4px 0' }}
          />
          <button className="btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {query.trim().length < 2 ? (
            <p style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
              Type at least 2 characters to search.
            </p>
          ) : loading ? (
            <p style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>Searching…</p>
          ) : results.length === 0 ? (
            <p style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No results.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', padding: 8 }}>
              {results.map(r => {
                const meta = TYPE_META[r.type]
                const Icon = meta.icon
                return (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => go(r)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--radius)', background: 'transparent', textAlign: 'left', width: '100%' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Icon size={14} color={meta.color} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                    <span className="badge" style={{ fontSize: 9, flexShrink: 0, background: `${meta.color}1a`, color: meta.color }}>{meta.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
