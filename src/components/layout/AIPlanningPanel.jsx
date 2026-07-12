import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { generatePlan } from '../../lib/aiLog'
import { parseSuggestedTasks, insertSuggestedTask } from '../../lib/suggestedTasks'
import { format, startOfWeek, subWeeks, subDays } from 'date-fns'
import { X, Send, Sparkles, Plus, ChevronDown, Check } from 'lucide-react'
import { getCurrentQuarter } from '../../lib/constants'
import PriorityDot from '../shared/PriorityDot'
import FormattedAiText from '../shared/FormattedAiText'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

const QUICK_PROMPTS = [
  "What should I focus on today?",
  "Help me plan this week",
  "What am I avoiding?",
  "What should I drop or deprioritise?",
  "How am I tracking against my goals?",
  "What's one thing that would move the needle most?",
]

export default function AIPlanningPanel({ onClose }) {
  useLockBodyScroll()
  const { user } = useAuth()
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([]) // { role: 'user'|'assistant', text, suggestedTasks }
  const [suggestedTasks, setSuggestedTasks] = useState([])
  const [taskPriorities, setTaskPriorities] = useState({})
  const [addedTasks, setAddedTasks] = useState(new Set())
  const [recentEntries, setRecentEntries] = useState([])
  const [context, setContext] = useState(null)
  const textareaRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (user) { loadRecentEntries(); loadContext() }
    textareaRef.current?.focus()
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function loadRecentEntries() {
    // Fetch pinned entries (always relevant) + last 8 non-pinned for memory
    const [pinnedRes, recentRes] = await Promise.all([
      supabase.from('ai_log').select('id, type, title, response, created_at, pinned')
        .eq('user_id', user.id).eq('dismissed', false).eq('pinned', true)
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('ai_log').select('id, type, title, response, created_at, pinned')
        .eq('user_id', user.id).eq('dismissed', false).eq('pinned', false)
        .order('created_at', { ascending: false }).limit(8),
    ])
    const pinned = pinnedRes.data || []
    const recent = recentRes.data || []
    // Merge: pinned first, then recent, dedup by id
    const seen = new Set(pinned.map(e => e.id))
    const merged = [...pinned, ...recent.filter(e => !seen.has(e.id))]
    setRecentEntries(merged)
  }

  async function loadContext() {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const twoWeeksAgo = format(startOfWeek(subWeeks(new Date(), 2), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const today = format(new Date(), 'yyyy-MM-dd')
    const quarter = getCurrentQuarter()
    const year = new Date().getFullYear()

    // Last 14 days, for habit streak calculation
    const days = Array.from({ length: 14 }, (_, i) => format(subDays(new Date(), 13 - i), 'yyyy-MM-dd'))

    const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd')

    const [goalsRes, tasksRes, habitsRes, logsRes, moodRes, todosRes, winsRes, profileRes, goalTasksRes, goalTodosRes, reflectionsRes] = await Promise.all([
      supabase.from('goals').select('id, category, primary_goal, tracking_type, metric_start, metric_target').eq('user_id', user.id).eq('quarter', quarter).eq('year', year),
      supabase.from('weekly_tasks').select('area, specific_task, complete, carried_forward, notes').eq('user_id', user.id).gte('week_start', twoWeeksAgo),
      supabase.from('habits').select('id, name').eq('user_id', user.id),
      supabase.from('habit_logs').select('habit_id, log_date').eq('user_id', user.id).gte('log_date', days[0]),
      supabase.from('mood_logs').select('mood_score').eq('user_id', user.id).gte('log_date', weekStart),
      supabase.from('daily_todos').select('text, category, complete').eq('user_id', user.id).eq('date', today),
      supabase.from('quarterly_wins').select('text').eq('user_id', user.id).eq('quarter', `${quarter} ${year}`),
      supabase.from('profiles').select('personal_context').eq('id', user.id).maybeSingle(),
      supabase.from('weekly_tasks').select('goal_id, complete').eq('user_id', user.id).not('goal_id', 'is', null),
      supabase.from('daily_todos').select('goal_id, complete').eq('user_id', user.id).not('goal_id', 'is', null),
      supabase.from('daily_reflections').select('date, content').eq('user_id', user.id).gte('date', sevenDaysAgo).order('date', { ascending: false }).limit(7),
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
      recentReflections: reflectionsRes.data || [],
    })
  }

  async function submit(overrideQuestion) {
    const q = (overrideQuestion ?? question).trim()
    if (!q || loading || !context) return
    setLoading(true)
    setQuestion('')
    const newMessages = [...messages, { role: 'user', text: q }]
    setMessages(newMessages)
    try {
      const { response: res } = await generatePlan(user.id, { ...context, question: q, history: messages, aiMemory: recentEntries })
      const { text, tasks } = parseSuggestedTasks(res)
      const taskOffset = suggestedTasks.length
      setSuggestedTasks(prev => [...prev, ...tasks])
      setTaskPriorities(prev => ({
        ...prev,
        ...Object.fromEntries(tasks.map((t, i) => [taskOffset + i, t.priority_level || null])),
      }))
      setMessages([...newMessages, { role: 'assistant', text, tasks, taskOffset }])
      loadRecentEntries()
    } catch (e) {
      setMessages([...newMessages, { role: 'assistant', text: `Error: ${e.message}. Check your Claude API key in settings.`, tasks: [], taskOffset: 0 }])
    } finally {
      setLoading(false)
    }
  }

  async function addSuggestedTask(task, index) {
    const priority_level = taskPriorities[index] ?? task.priority_level ?? null
    const { error } = await insertSuggestedTask(user.id, task, priority_level)
    if (error) {
      console.error('addSuggestedTask failed:', error)
      alert('Could not add task: ' + error.message)
      return
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

  // Portal to document.body so this fixed overlay isn't clipped by .app-layout's `overflow: clip`.
  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(13,8,5,0.45)', zIndex: 1100, backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, maxWidth: '100vw',
        zIndex: 1200,
        background: 'var(--card-bg)',
        borderLeft: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex', flexDirection: 'column',
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

        {/* Quick-start chips — only show when no conversation yet */}
        {messages.length === 0 && (
          <div>
            <p className="mono mb-2" style={{ fontSize: 10 }}>Quick start</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p}
                  className="btn btn-xs btn-ghost"
                  style={{ fontSize: 11, borderRadius: 20, border: '1px solid var(--border)' }}
                  onClick={() => submit(p)}
                  disabled={loading || !context}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation thread */}
        {messages.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((msg, idx) => (
              <div key={idx}>
                {msg.role === 'user' ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ background: 'var(--career)', color: '#fff', borderRadius: '12px 12px 4px 12px', padding: '10px 14px', maxWidth: '85%', fontSize: 13, lineHeight: 1.5 }}>
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'var(--career-tint)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', borderLeft: '3px solid var(--career)' }}>
                    <div style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text)' }}>
                      <FormattedAiText text={msg.text} />
                    </div>
                    {msg.tasks && msg.tasks.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
                        {msg.tasks.map((task, ti) => {
                          const globalIdx = msg.taskOffset + ti
                          return (
                            <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '8px 10px', border: '1px solid var(--border)' }}>
                              <span className={`badge ${task.type === 'weekly' ? 'badge-career' : 'badge-finance'}`} style={{ fontSize: 9, flexShrink: 0 }}>
                                {task.type === 'weekly' ? 'Weekly' : 'Daily'}
                              </span>
                              <span style={{ fontSize: 12, flex: 1, color: 'var(--text)' }}>
                                {task.type === 'weekly' ? task.specific_task : task.title}
                              </span>
                              <PriorityDot
                                priority={taskPriorities[globalIdx] ?? null}
                                onChange={v => setTaskPriorities(prev => ({ ...prev, [globalIdx]: v }))}
                              />
                              <button
                                className={`btn btn-xs ${addedTasks.has(globalIdx) ? 'btn-ghost' : 'btn-career'}`}
                                style={addedTasks.has(globalIdx) ? {} : { color: '#fff' }}
                                onClick={() => addSuggestedTask(task, globalIdx)}
                                disabled={addedTasks.has(globalIdx)}
                              >
                                {addedTasks.has(globalIdx) ? (<><Check size={12} /> Added</>) : (<><Plus size={12} /> Add</>)}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 6, padding: '12px 0', alignItems: 'center' }}>
                <Sparkles size={13} color="var(--career)" />
                <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>Thinking…</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input area */}
        <div style={{ position: 'sticky', bottom: 0, background: 'var(--card-bg)', paddingTop: 8 }}>
          {messages.length === 0 && (
            <p className="mono mb-2" style={{ fontSize: 10 }}>Ask anything about your week, goals, priorities…</p>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder={messages.length === 0 ? "e.g. What should I focus on today?" : "Follow up…"}
              style={{ minHeight: 60, fontSize: 13, flex: 1, resize: 'vertical' }}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
            />
            <button
              className="btn btn-career"
              style={{ color: '#fff', padding: '10px 14px', alignSelf: 'flex-end', flexShrink: 0 }}
              onClick={() => submit()}
              disabled={loading || !question.trim() || !context}
            >
              <Send size={14} />
            </button>
          </div>
          {messages.length === 0 && (
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>⌘↵ to send</p>
          )}
        </div>

        {/* Recent AI log entries — only show when no active conversation */}
        {messages.length === 0 && (
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
        )}
      </div>
      </div>
    </>,
    document.body
  )
}
