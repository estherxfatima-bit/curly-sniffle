import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { generatePlan } from '../../lib/aiLog'
import { format, startOfWeek, subWeeks, subDays } from 'date-fns'
import { X, Send, Sparkles, Plus, ChevronDown, Check } from 'lucide-react'
import { getCurrentQuarter } from '../../lib/constants'
import PriorityDot from '../shared/PriorityDot'

// Pull a trailing ```json ... ``` block with a "suggested_tasks" array out of an AI
// response, returning the cleaned display text and the parsed task list (if any).
function parseSuggestedTasks(text) {
  const match = text.match(/```json\s*([\s\S]*?)```/)
  if (!match) return { text, tasks: [] }
  try {
    const parsed = JSON.parse(match[1])
    if (!Array.isArray(parsed.suggested_tasks)) return { text, tasks: [] }
    return { text: text.slice(0, match.index).trim(), tasks: parsed.suggested_tasks }
  } catch {
    return { text, tasks: [] }
  }
}

export default function AIPlanningPanel({ onClose }) {
  const { user } = useAuth()
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState(null)
  const [suggestedTasks, setSuggestedTasks] = useState([])
  const [taskPriorities, setTaskPriorities] = useState({})
  const [addedTasks, setAddedTasks] = useState(new Set())
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
    const quarter = getCurrentQuarter()
    const year = new Date().getFullYear()

    // Last 14 days, for habit streak calculation
    const days = Array.from({ length: 14 }, (_, i) => format(subDays(new Date(), 13 - i), 'yyyy-MM-dd'))

    const [goalsRes, tasksRes, habitsRes, logsRes, moodRes, todosRes, winsRes, profileRes, goalTasksRes, goalTodosRes] = await Promise.all([
      supabase.from('goals').select('id, category, primary_goal, tracking_type, metric_start, metric_target').eq('user_id', user.id).eq('quarter', quarter).eq('year', year),
      supabase.from('weekly_tasks').select('area, specific_task, complete, carried_forward').eq('user_id', user.id).gte('week_start', twoWeeksAgo),
      supabase.from('habits').select('id, name').eq('user_id', user.id),
      supabase.from('habit_logs').select('habit_id, log_date').eq('user_id', user.id).gte('log_date', days[0]),
      supabase.from('mood_logs').select('mood_score').eq('user_id', user.id).gte('log_date', weekStart),
      supabase.from('daily_todos').select('text, category, complete').eq('user_id', user.id).eq('date', today),
      supabase.from('quarterly_wins').select('text').eq('user_id', user.id).eq('quarter', `${quarter} ${year}`),
      supabase.from('profiles').select('personal_context').eq('id', user.id).maybeSingle(),
      supabase.from('weekly_tasks').select('goal_id, complete').eq('user_id', user.id).not('goal_id', 'is', null),
      supabase.from('daily_todos').select('goal_id, complete').eq('user_id', user.id).not('goal_id', 'is', null),
    ])

    const moods = moodRes.data || []
    const moodAvg = moods.length ? moods.reduce((s, m) => s + m.mood_score, 0) / moods.length : null

    const habitsData = habitsRes.data || []
    const logsByHabit = {}
    habitsData.forEach(h => { logsByHabit[h.id] = new Set() })
    ;(logsRes.data || []).forEach(l => { logsByHabit[l.habit_id]?.add(l.log_date) })
    const habitsWithStreaks = habitsData.map(h => {
      let streak = 0
      for (let i = days.length - 1; i >= 0; i--) {
        if (logsByHabit[h.id]?.has(days[i])) streak++
        else break
      }
      return { name: h.name, streak }
    })

    const goalTasks = [...(goalTasksRes.data || []), ...(goalTodosRes.data || [])]
    const goalsWithStatus = (goalsRes.data || []).map(g => {
      if (g.tracking_type === 'metric') {
        return { category: g.category, primary_goal: g.primary_goal, status: `${g.metric_start ?? 0} → ${g.metric_target ?? '?'} (metric)` }
      }
      const linked = goalTasks.filter(t => t.goal_id === g.id)
      const done = linked.filter(t => t.complete).length
      const status = linked.length ? `${done}/${linked.length} tasks done` : 'no tasks linked'
      return { category: g.category, primary_goal: g.primary_goal, status }
    })

    setContext({
      goals: goalsWithStatus,
      tasks: tasksRes.data || [],
      habits: habitsWithStreaks,
      moodAvg,
      todayTodos: todosRes.data || [],
      quarterlyWins: (winsRes.data || []).map(w => w.text),
      personalContext: profileRes.data?.personal_context || '',
    })
  }

  async function submit() {
    if (!question.trim() || loading || !context) return
    setLoading(true)
    setResponse(null)
    setSuggestedTasks([])
    setTaskPriorities({})
    setAddedTasks(new Set())
    try {
      const { response: res } = await generatePlan(user.id, { ...context, question })
      const { text, tasks } = parseSuggestedTasks(res)
      setResponse(text)
      setSuggestedTasks(tasks)
      setTaskPriorities(Object.fromEntries(tasks.map((t, i) => [i, t.priority_level || null])))
      loadRecentEntries()
    } catch (e) {
      setResponse(`Error: ${e.message}. Check your Claude API key in settings.`)
    } finally {
      setLoading(false)
    }
  }

  async function addSuggestedTask(task, index) {
    const priority_level = taskPriorities[index] ?? task.priority_level ?? null
    if (task.type === 'weekly') {
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      await supabase.from('weekly_tasks').insert({
        user_id: user.id, week_start: weekStart,
        area: task.area, action: task.action, frequency: task.frequency, specific_task: task.specific_task,
        complete: false, carried_forward: false, priority_level,
      })
    } else if (task.type === 'daily') {
      await supabase.from('daily_todos').insert({
        user_id: user.id, text: task.title, date: task.due_date, complete: false, priority_level,
      })
    }
    setAddedTasks(prev => new Set(prev).add(index))
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
      background: 'var(--card-bg)',
      borderLeft: '1px solid var(--border)',
      boxShadow: 'var(--shadow-lg)',
      display: 'flex', flexDirection: 'column',
      zIndex: 200,
      animation: 'slideRight 0.22s ease',
    }}>
      {/* Header */}
      <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            {suggestedTasks.length === 0 ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="btn btn-sm btn-ghost" onClick={() => addToWeeklyPlan(response.split('\n')[0])}>
                  <Plus size={12} /> Add to weekly plan
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => addToDailyTodo(response.split('\n')[0])}>
                  <Plus size={12} /> Add to today's todos
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                {suggestedTasks.map((task, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '10px 12px', border: '1px solid var(--border)' }}>
                    <span className={`badge ${task.type === 'weekly' ? 'badge-career' : 'badge-finance'}`} style={{ fontSize: 9, flexShrink: 0 }}>
                      {task.type === 'weekly' ? 'Weekly' : 'Daily'}
                    </span>
                    <span style={{ fontSize: 12, flex: 1, color: 'var(--text)' }}>
                      {task.type === 'weekly' ? task.specific_task : task.title}
                    </span>
                    <PriorityDot
                      priority={taskPriorities[i] ?? null}
                      onChange={v => setTaskPriorities(prev => ({ ...prev, [i]: v }))}
                    />
                    <button
                      className={`btn btn-xs ${addedTasks.has(i) ? 'btn-ghost' : 'btn-career'}`}
                      style={addedTasks.has(i) ? {} : { color: '#fff' }}
                      onClick={() => addSuggestedTask(task, i)}
                      disabled={addedTasks.has(i)}
                    >
                      {addedTasks.has(i) ? (<><Check size={12} /> Added</>) : (<><Plus size={12} /> Add to plan</>)}
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                <div key={e.id} style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '10px 14px', border: '1px solid var(--border)' }}>
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
