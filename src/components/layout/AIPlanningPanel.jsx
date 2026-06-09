import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { generatePlan } from '../../lib/aiLog'
import { format, startOfWeek, subWeeks } from 'date-fns'
import { X, Send, Sparkles, Plus, ChevronDown } from 'lucide-react'

export default function AIPlanningPanel({ onClose }) {
  const { user } = useAuth()
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState(null)
  const [recentEntries, setRecentEntries] = useState([])
  const [context, setContext] = useState(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (user) { loadRecentEntries(); loadContext() }
    textareaRef.current?.focus()
  }, [user])

  async function loadRecentEntries() {
    const { data } = await supabase.from('ai_log').select('id, type, title, response, created_at')
      .eq('user_id', user.id).eq('dismissed', false).order('created_at', { ascending: false }).limit(5)
    setRecentEntries(data || [])
  }

  async function loadContext() {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const twoWeeksAgo = format(startOfWeek(subWeeks(new Date(), 2), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const today = format(new Date(), 'yyyy-MM-dd')

    const [goalsRes, tasksRes, habitsRes, logsRes, moodRes, todosRes] = await Promise.all([
      supabase.from('goals').select('category, primary_goal').eq('user_id', user.id),
      supabase.from('weekly_tasks').select('area, specific_task, complete, carried_forward').eq('user_id', user.id).gte('week_start', twoWeeksAgo),
      supabase.from('habits').select('id, name').eq('user_id', user.id),
      supabase.from('habit_logs').select('habit_id').eq('user_id', user.id).eq('log_date', today),
      supabase.from('mood_logs').select('mood_score').eq('user_id', user.id).gte('log_date', weekStart),
      supabase.from('daily_todos').select('text, category, complete').eq('user_id', user.id).eq('date', today),
    ])

    const moods = moodRes.data || []
    const moodAvg = moods.length ? moods.reduce((s, m) => s + m.mood_score, 0) / moods.length : null
    const loggedIds = new Set((logsRes.data || []).map(l => l.habit_id))

    setContext({
      goals: goalsRes.data || [],
      tasks: tasksRes.data || [],
      habits: habitsRes.data || [],
      habitLogs: loggedIds.size,
      moodAvg,
      todayTodos: todosRes.data || [],
    })
  }

  async function submit() {
    if (!question.trim() || loading || !context) return
    setLoading(true)
    setResponse(null)
    try {
      const { response: res, record } = await generatePlan(user.id, { ...context, question })
      setResponse(res)
      loadRecentEntries()
    } catch (e) {
      setResponse(`Error: ${e.message}. Check your Claude API key in settings.`)
    } finally {
      setLoading(false)
    }
  }

  async function addToWeeklyPlan(text) {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    await supabase.from('weekly_tasks').insert({
      user_id: user.id, week_start: weekStart,
      area: 'Personal', specific_task: text, complete: false, carried_forward: false,
    })
    alert(`Added to weekly plan: "${text.slice(0, 40)}"`)
  }

  async function addToDailyTodo(text) {
    const today = format(new Date(), 'yyyy-MM-dd')
    await supabase.from('daily_todos').insert({
      user_id: user.id, text, date: today, category: 'Personal', complete: false,
    })
    alert(`Added to today's to-dos: "${text.slice(0, 40)}"`)
  }

  const TYPE_LABELS = { weekly_plan: 'Weekly', finance_summary: 'Finance', content_analysis: 'Content', smart_batch: 'Batch', brain_dump: 'Brain dump', custom: 'Custom' }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: 420, maxWidth: '100vw',
      background: 'var(--bg)',
      borderLeft: '1.5px solid var(--border)',
      boxShadow: 'var(--shadow-lg)',
      display: 'flex', flexDirection: 'column',
      zIndex: 200,
      animation: 'slideRight 0.2s ease',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={18} color="var(--career)" />
          <h3 style={{ fontSize: '1rem' }}>AI Planning</h3>
        </div>
        <button className="btn-icon btn" onClick={onClose}><X size={16} /></button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Input */}
        <div>
          <p className="mono mb-2">Ask anything about your week, goals, priorities…</p>
          <textarea
            ref={textareaRef}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="e.g. What should I focus on today? / Help me prioritise this week / What's getting in the way of my goals?"
            style={{ minHeight: 100, fontSize: 13 }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
          />
          <button
            className="btn btn-career w-full mt-2"
            style={{ color: '#fff', justifyContent: 'center' }}
            onClick={submit}
            disabled={loading || !question.trim() || !context}
          >
            <Send size={14} />
            {loading ? 'Thinking…' : 'Ask Claude ⌘↵'}
          </button>
        </div>

        {/* Response */}
        {response && (
          <div style={{ background: 'var(--career-tint)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', borderLeft: '3px solid var(--career)' }}>
            <p className="mono mb-2" style={{ color: 'var(--career)' }}>Response</p>
            <p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{response}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-ghost" onClick={() => addToWeeklyPlan(response.split('\n')[0])}>
                <Plus size={12} /> Add to weekly plan
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => addToDailyTodo(response.split('\n')[0])}>
                <Plus size={12} /> Add to today's todos
              </button>
            </div>
          </div>
        )}

        {/* Recent AI log entries */}
        <div>
          <p className="mono mb-3">Recent AI log</p>
          {recentEntries.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No entries yet — your AI responses will appear here.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentEntries.map(e => (
                <div key={e.id} style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '10px 14px', border: '1.5px solid var(--border)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge badge-career" style={{ fontSize: 9 }}>{TYPE_LABELS[e.type] || e.type}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>{format(new Date(e.created_at), 'd MMM')}</span>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{e.title}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
                    {e.response.slice(0, 100)}{e.response.length > 100 ? '…' : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
