import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { GOAL_CATEGORIES, QUARTERS, getCurrentQuarter, priorityRank, priorityFilterOptions, PRIORITY_COLORS } from '../lib/constants'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'
import QuarterlyWins from '../components/goals/QuarterlyWins'
import GoalCard from '../components/goals/GoalCard'
import GoalModal from '../components/goals/GoalModal'

const CATEGORY_COLORS = {
  Career:    'var(--career)',
  Creative:  'var(--creative)',
  Financial: 'var(--finance)',
  Personal:  'var(--personal)',
  Wellness:  'var(--wellness)',
}
const CATEGORY_CLASSES = {
  Career:    'card-career',
  Creative:  'card-creative',
  Financial: 'card-finance',
  Personal:  'card-personal',
  Wellness:  'card-wellness',
}

function GoalsDecoration() {
  return (
    <svg width="100" height="70" viewBox="0 0 100 70" fill="none">
      <circle cx="70" cy="35" r="28" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
      <circle cx="70" cy="35" r="18" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
      <circle cx="70" cy="35" r="6" fill="currentColor" opacity="0.15"/>
      <line x1="10" y1="35" x2="42" y2="35" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
      <circle cx="10" cy="35" r="3" fill="currentColor" opacity="0.3"/>
    </svg>
  )
}

export default function GoalsPage() {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [weeklyTasks, setWeeklyTasks] = useState([])
  const [dailyTodos, setDailyTodos] = useState([])
  const [metrics, setMetrics] = useState([])
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [createCtx, setCreateCtx] = useState(null) // { year, quarter, category }

  const currentYear = new Date().getFullYear()
  const currentQuarter = getCurrentQuarter()

  const [expandedYears, setExpandedYears] = useState(() => new Set([currentYear]))
  const [expandedQuarters, setExpandedQuarters] = useState(() => new Set([`${currentYear}-${currentQuarter}`]))
  const [priorityFilter, setPriorityFilter] = useState('')

  useEffect(() => { if (user) loadAll() }, [user])

  async function loadAll() {
    setLoading(true)
    const [goalsRes, weeklyRes, dailyRes, metricsRes, milestonesRes] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', user.id).order('year', { ascending: false }).order('quarter').order('category'),
      supabase.from('weekly_tasks').select('id, goal_id, area, specific_task, complete, milestone_id, completed_on').eq('user_id', user.id).not('goal_id', 'is', null),
      supabase.from('daily_todos').select('id, goal_id, category, text, complete, milestone_id, completed_on').eq('user_id', user.id).not('goal_id', 'is', null),
      supabase.from('goal_metrics').select('*').eq('user_id', user.id).order('recorded_at'),
      supabase.from('milestones').select('*').eq('user_id', user.id).order('sort_order'),
    ])
    setGoals(goalsRes.data || [])
    setWeeklyTasks(weeklyRes.data || [])
    setDailyTodos(dailyRes.data || [])
    setMetrics(metricsRes.data || [])
    setMilestones(milestonesRes.data || [])
    setLoading(false)
  }

  function toggleYear(year) {
    setExpandedYears(prev => {
      const next = new Set(prev)
      next.has(year) ? next.delete(year) : next.add(year)
      return next
    })
  }

  function toggleQuarter(key) {
    setExpandedQuarters(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function deleteGoal(id) {
    if (!confirm('Delete this goal?')) return
    await supabase.from('goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
    setMetrics(prev => prev.filter(m => m.goal_id !== id))
  }

  async function addMetric(goal, value) {
    const { data } = await supabase.from('goal_metrics').insert({
      goal_id: goal.id, user_id: user.id, value,
    }).select().single()
    if (data) setMetrics(prev => [...prev, data])
    await supabase.from('goals').update({ updated_at: new Date().toISOString() }).eq('id', goal.id)
    setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, updated_at: new Date().toISOString() } : g))
  }

  async function updateGoalField(id, field, value) {
    await supabase.from('goals').update({ [field]: value }).eq('id', id)
    setGoals(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g))
  }

  async function addMilestone(goalId, title, targetDate) {
    if (!title.trim()) return
    const sortOrder = milestones.filter(m => m.goal_id === goalId).length
    const { data, error } = await supabase.from('milestones').insert({
      user_id: user.id, goal_id: goalId, title: title.trim(), target_date: targetDate || null, sort_order: sortOrder,
    }).select().single()
    if (error) { alert(`Couldn't add milestone: ${error.message}`); return }
    setMilestones(prev => [...prev, data])
  }

  async function toggleMilestone(milestone) {
    const { error } = await supabase.from('milestones').update({ complete: !milestone.complete }).eq('id', milestone.id)
    if (error) { alert(`Couldn't update milestone: ${error.message}`); return }
    setMilestones(prev => prev.map(m => m.id === milestone.id ? { ...m, complete: !milestone.complete } : m))
  }

  async function deleteMilestone(id) {
    if (!confirm('Delete this milestone? Tasks linked to it will be unlinked, not deleted.')) return
    const { error } = await supabase.from('milestones').delete().eq('id', id)
    if (error) { alert(`Couldn't delete milestone: ${error.message}`); return }
    setMilestones(prev => prev.filter(m => m.id !== id))
    setWeeklyTasks(prev => prev.map(t => t.milestone_id === id ? { ...t, milestone_id: null } : t))
    setDailyTodos(prev => prev.map(t => t.milestone_id === id ? { ...t, milestone_id: null } : t))
  }

  async function assignTaskMilestone(item, milestoneId) {
    const table = item.source === 'weekly' ? 'weekly_tasks' : 'daily_todos'
    const { error } = await supabase.from(table).update({ milestone_id: milestoneId || null }).eq('id', item.id)
    if (error) { alert(`Couldn't link task to milestone: ${error.message}`); return }
    const updater = prev => prev.map(t => t.id === item.id ? { ...t, milestone_id: milestoneId || null } : t)
    if (item.source === 'weekly') setWeeklyTasks(updater)
    else setDailyTodos(updater)
  }

  // Toggle a goal-linked task's completion directly from the Goals page. When marking
  // complete, ask which day it actually happened — completing something late shouldn't
  // get attributed to today if it was actually finished on an earlier day.
  async function toggleLinkedTask(item) {
    const newVal = !item.complete
    let completedOn = null
    if (newVal) {
      const input = window.prompt('Date this was actually completed (YYYY-MM-DD)?', format(new Date(), 'yyyy-MM-dd'))
      if (input === null) return
      completedOn = input.trim() || format(new Date(), 'yyyy-MM-dd')
    }
    const table = item.source === 'weekly' ? 'weekly_tasks' : 'daily_todos'
    const { error } = await supabase.from(table).update({ complete: newVal, completed_on: completedOn }).eq('id', item.id)
    if (error) { alert(`Couldn't update task: ${error.message}`); return }
    const updater = prev => prev.map(t => t.id === item.id ? { ...t, complete: newVal, completed_on: completedOn } : t)
    if (item.source === 'weekly') setWeeklyTasks(updater)
    else setDailyTodos(updater)
  }

  // Goals matching the priority filter, sorted by priority within each category.
  const byPriority = (a, b) => priorityRank(a.priority_level) - priorityRank(b.priority_level)
  function visibleSorted(list) {
    return list
      .filter(g => {
        if (priorityFilter === 'none') return !g.priority_level
        if (priorityFilter) return g.priority_level === priorityFilter
        return true
      })
      .sort(byPriority)
  }

  function linkedTasksFor(goalId) {
    return [
      ...weeklyTasks.filter(t => t.goal_id === goalId).map(t => ({ id: t.id, source: 'weekly', text: t.specific_task, complete: t.complete, area: t.area, milestone_id: t.milestone_id, completed_on: t.completed_on })),
      ...dailyTodos.filter(t => t.goal_id === goalId).map(t => ({ id: t.id, source: 'daily', text: t.text, complete: t.complete, area: t.category, milestone_id: t.milestone_id, completed_on: t.completed_on })),
    ]
  }

  function milestonesFor(goalId) {
    return milestones.filter(m => m.goal_id === goalId)
  }

  // Group goals: year -> quarter -> category
  const years = [...new Set(goals.map(g => g.year))].sort((a, b) => b - a)
  if (!years.includes(currentYear)) years.unshift(currentYear)
  years.sort((a, b) => b - a)

  return (
    <div>
      <div className="page-header header-career mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>Goals</h1>
            <p>Year → quarter → progress, all in one place</p>
          </div>
          <button className="btn btn-career btn-sm" style={{ color: '#fff', flexShrink: 0 }} onClick={() => { setEditing(null); setCreateCtx({ year: currentYear, quarter: currentQuarter, category: GOAL_CATEGORIES[0] }); setShowModal(true) }}>
            <Plus size={14} /> Add goal
          </button>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--career)' }}><GoalsDecoration /></div>
      </div>

      {/* Priority filter bar */}
      <div className="flex items-center gap-2 mb-5" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
        {priorityFilterOptions().map(opt => (
          <button key={opt.value || 'all'} onClick={() => setPriorityFilter(priorityFilter === opt.value ? '' : opt.value)}
            className={`btn btn-xs ${priorityFilter === opt.value ? '' : 'btn-ghost'}`}
            style={{
              flexShrink: 0,
              ...(priorityFilter === opt.value
                ? { background: PRIORITY_COLORS[opt.value] || 'var(--career)', color: '#fff', border: 'none' }
                : {}),
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {years.map(year => {
            const yearGoals = goals.filter(g => g.year === year)
            const isOpen = expandedYears.has(year)
            return (
              <div key={year} className="card">
                <button
                  onClick={() => toggleYear(year)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <h2 style={{ fontSize: '1.2rem' }}>{year}</h2>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{yearGoals.length} goal{yearGoals.length === 1 ? '' : 's'}</span>
                </button>

                {isOpen && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {(() => {
                      const yearlyGoals = yearGoals.filter(g => g.quarter === 'Year')
                      if (!yearlyGoals.length) return null
                      return (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                          <div className="flex items-center justify-between mb-2">
                            <h3 style={{ fontSize: '0.95rem' }}>Year goals — {year}</h3>
                            <button
                              className="btn-icon btn btn-sm"
                              onClick={() => { setEditing(null); setCreateCtx({ year, quarter: 'Year', category: GOAL_CATEGORIES[0] }); setShowModal(true) }}
                              title={`Add yearly goal for ${year}`}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <div className="grid-2 mt-1">
                            {GOAL_CATEGORIES.map(cat => {
                              const catGoals = visibleSorted(yearlyGoals.filter(g => g.category === cat))
                              if (catGoals.length === 0) return null
                              const color = CATEGORY_COLORS[cat]
                              const cardClass = CATEGORY_CLASSES[cat]
                              return (
                                <div key={cat} className={`card ${cardClass}`}>
                                  <h3 className="mb-4" style={{ color }}>{cat}</h3>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                    {catGoals.map(goal => {
                                      const children = yearGoals.filter(g => g.parent_goal_id === goal.id)
                                      return (
                                        <div key={goal.id}>
                                          <GoalCard
                                            goal={goal}
                                            color={color}
                                            linkedTasks={linkedTasksFor(goal.id)}
                                            milestones={milestonesFor(goal.id)}
                                            metricHistory={metrics.filter(m => m.goal_id === goal.id)}
                                            onEdit={g => { setEditing(g); setCreateCtx(null); setShowModal(true) }}
                                            onDelete={deleteGoal}
                                            onAddMetric={addMetric}
                                            onUpdatePriority={v => updateGoalField(goal.id, 'priority_level', v)}
                                            onTogglePrivate={g => updateGoalField(g.id, 'is_private', !g.is_private)}
                                            onAddMilestone={(title, date) => addMilestone(goal.id, title, date)}
                                            onToggleMilestone={toggleMilestone}
                                            onDeleteMilestone={deleteMilestone}
                                            onToggleLinkedTask={toggleLinkedTask}
                                            onAssignTaskMilestone={assignTaskMilestone}
                                          />
                                          <div style={{ marginTop: 10 }}>
                                            <p className="mono mb-1">Broken down into</p>
                                            {children.length === 0 ? (
                                              <p style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
                                                No quarterly goals linked yet — when adding a goal, set "Break down from yearly goal" to this goal.
                                              </p>
                                            ) : (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {QUARTERS.map(q => children.filter(c => c.quarter === q).map(c => (
                                                  <div key={c.id} className="flex items-center gap-2">
                                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase' }}>{q}</span>
                                                    <span style={{ fontSize: 12, color: c.tracking_type !== 'metric' && linkedTasksFor(c.id).length > 0 && linkedTasksFor(c.id).every(t => t.complete) ? 'var(--text-3)' : 'var(--text-2)', textDecoration: c.tracking_type !== 'metric' && linkedTasksFor(c.id).length > 0 && linkedTasksFor(c.id).every(t => t.complete) ? 'line-through' : 'none' }}>{c.primary_goal}</span>
                                                  </div>
                                                )))}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
                    {QUARTERS.map(q => {
                      const qGoals = yearGoals.filter(g => g.quarter === q)
                      const key = `${year}-${q}`
                      const qOpen = expandedQuarters.has(key)
                      return (
                        <div key={q} style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                          <button
                            onClick={() => toggleQuarter(key)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                          >
                            <div className="flex items-center gap-2">
                              {qOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              <h3 style={{ fontSize: '0.95rem' }}>{q} {year}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>{qGoals.length} goal{qGoals.length === 1 ? '' : 's'}</span>
                              <button
                                className="btn-icon btn btn-sm"
                                onClick={e => { e.stopPropagation(); setEditing(null); setCreateCtx({ year, quarter: q, category: GOAL_CATEGORIES[0] }); setShowModal(true) }}
                                title={`Add goal for ${q} ${year}`}
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </button>

                          {qOpen && (
                            qGoals.length === 0 ? (
                              <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', marginTop: 12 }}>No goals for {q} {year}.</p>
                            ) : (
                              <div className="grid-2 mt-3">
                                {GOAL_CATEGORIES.map(cat => {
                                  const catGoals = visibleSorted(qGoals.filter(g => g.category === cat))
                                  if (catGoals.length === 0) return null
                                  const color = CATEGORY_COLORS[cat]
                                  const cardClass = CATEGORY_CLASSES[cat]
                                  return (
                                    <div key={cat} className={`card ${cardClass}`}>
                                      <h3 className="mb-4" style={{ color }}>{cat}</h3>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                        {catGoals.map(goal => (
                                          <GoalCard
                                            key={goal.id}
                                            goal={goal}
                                            color={color}
                                            linkedTasks={linkedTasksFor(goal.id)}
                                            metricHistory={metrics.filter(m => m.goal_id === goal.id)}
                                            parentGoal={goals.find(g => g.id === goal.parent_goal_id)}
                                            onEdit={g => { setEditing(g); setCreateCtx(null); setShowModal(true) }}
                                            onDelete={deleteGoal}
                                            onAddMetric={addMetric}
                                            onUpdatePriority={v => updateGoalField(goal.id, 'priority_level', v)}
                                            onTogglePrivate={g => updateGoalField(g.id, 'is_private', !g.is_private)}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6">
        <QuarterlyWins quarter={`${currentQuarter} ${currentYear}`} />
      </div>

      {showModal && (
        <GoalModal
          goal={editing}
          defaults={createCtx}
          goals={goals}
          onClose={() => setShowModal(false)}
          onSave={goal => {
            setGoals(prev => { const idx = prev.findIndex(g => g.id === goal.id); if (idx >= 0) { const n = [...prev]; n[idx] = goal; return n } return [...prev, goal] })
            setExpandedYears(prev => new Set(prev).add(goal.year))
            setExpandedQuarters(prev => new Set(prev).add(`${goal.year}-${goal.quarter}`))
            setShowModal(false)
          }}
        />
      )}
    </div>
  )
}
