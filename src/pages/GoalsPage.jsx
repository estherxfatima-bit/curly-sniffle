import { useState, useEffect } from 'react'
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
  const [milestones, setMilestones] = useState([])
  const [milestoneTasks, setMilestoneTasks] = useState([])
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
    const [goalsRes, milestonesRes, milestoneTasksRes] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', user.id).order('year', { ascending: false }).order('quarter').order('category'),
      supabase.from('milestones').select('*').eq('user_id', user.id).order('sort_order'),
      supabase.from('milestone_tasks').select('*').eq('user_id', user.id).order('sort_order'),
    ])
    setGoals(goalsRes.data || [])
    setMilestones(milestonesRes.data || [])
    setMilestoneTasks(milestoneTasksRes.data || [])
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
  }

  async function updateGoalField(id, field, value) {
    await supabase.from('goals').update({ [field]: value }).eq('id', id)
    setGoals(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g))
  }

  async function updateMetricCurrent(goal) {
    const input = window.prompt('Current value:', goal.metric_current ?? '0')
    if (input == null) return
    const value = Number(input)
    if (Number.isNaN(value)) return
    const updated_at = new Date().toISOString()
    const { error } = await supabase.from('goals').update({ metric_current: value, updated_at }).eq('id', goal.id)
    if (error) { alert(`Couldn't update metric: ${error.message}`); return }
    setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, metric_current: value, updated_at } : g))
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
    if (!confirm('Delete this milestone? Its tasks will be deleted too.')) return
    const { error } = await supabase.from('milestones').delete().eq('id', id)
    if (error) { alert(`Couldn't delete milestone: ${error.message}`); return }
    setMilestones(prev => prev.filter(m => m.id !== id))
    setMilestoneTasks(prev => prev.filter(t => t.milestone_id !== id))
  }

  async function addMilestoneTask(milestoneId, text) {
    if (!text.trim()) return
    const sortOrder = milestoneTasks.filter(t => t.milestone_id === milestoneId).length
    const { data, error } = await supabase.from('milestone_tasks').insert({
      user_id: user.id, milestone_id: milestoneId, text: text.trim(), sort_order: sortOrder,
    }).select().single()
    if (error) { alert(`Couldn't add task: ${error.message}`); return }
    setMilestoneTasks(prev => [...prev, data])
  }

  async function toggleMilestoneTask(task) {
    const { error } = await supabase.from('milestone_tasks').update({ complete: !task.complete }).eq('id', task.id)
    if (error) { alert(`Couldn't update task: ${error.message}`); return }
    setMilestoneTasks(prev => prev.map(t => t.id === task.id ? { ...t, complete: !task.complete } : t))
  }

  async function deleteMilestoneTask(id) {
    const { error } = await supabase.from('milestone_tasks').delete().eq('id', id)
    if (error) { alert(`Couldn't delete task: ${error.message}`); return }
    setMilestoneTasks(prev => prev.filter(t => t.id !== id))
  }

  async function linkQuarterlyGoal(themeGoal, quarterlyGoalId) {
    const { error } = await supabase.from('goals').update({ parent_goal_id: themeGoal.id }).eq('id', quarterlyGoalId)
    if (error) { alert(`Couldn't link goal: ${error.message}`); return }
    setGoals(prev => prev.map(g => g.id === quarterlyGoalId ? { ...g, parent_goal_id: themeGoal.id } : g))
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

  function milestonesFor(goalId) {
    return milestones.filter(m => m.goal_id === goalId).map(m => ({
      ...m,
      tasks: milestoneTasks.filter(t => t.milestone_id === m.id),
    }))
  }

  // Computes { pct, done, total } for any goal given its tracking type.
  function computeProgress(goal) {
    if (goal.tracking_type === 'metric') {
      const target = Number(goal.metric_target ?? 0)
      const current = Number(goal.metric_current ?? 0)
      const pct = target > 0 ? Math.round((current / target) * 100) : 0
      return { pct, done: 0, total: 0 }
    }
    if (goal.tracking_type === 'theme') {
      const subGoals = goals.filter(g => g.parent_goal_id === goal.id)
      const done = subGoals.filter(g => computeProgress(g).pct >= 100).length
      return { pct: 0, done, total: subGoals.length }
    }
    // milestone
    const ms = milestones.filter(m => m.goal_id === goal.id)
    const done = ms.filter(m => m.complete).length
    const pct = ms.length ? Math.round((done / ms.length) * 100) : 0
    return { pct, done, total: ms.length }
  }

  function subGoalsFor(themeGoalId) {
    return goals
      .filter(g => g.parent_goal_id === themeGoalId)
      .map(g => ({ ...g, pct: computeProgress(g).pct }))
  }

  function linkableQuarterlyGoalsFor(themeGoal) {
    return goals.filter(g => g.quarter !== 'Year' && g.year === themeGoal.year && g.parent_goal_id !== themeGoal.id)
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
                                    {catGoals.map(goal => (
                                      <GoalCard
                                        key={goal.id}
                                        goal={goal}
                                        color={color}
                                        progress={computeProgress(goal)}
                                        milestones={milestonesFor(goal.id)}
                                        subGoals={goal.tracking_type === 'theme' ? subGoalsFor(goal.id) : []}
                                        linkableQuarterlyGoals={goal.tracking_type === 'theme' ? linkableQuarterlyGoalsFor(goal) : []}
                                        onEdit={g => { setEditing(g); setCreateCtx(null); setShowModal(true) }}
                                        onDelete={deleteGoal}
                                        onUpdateMetric={updateMetricCurrent}
                                        onUpdatePriority={v => updateGoalField(goal.id, 'priority_level', v)}
                                        onTogglePrivate={g => updateGoalField(g.id, 'is_private', !g.is_private)}
                                        onToggleMilestone={toggleMilestone}
                                        onAddMilestoneTask={addMilestoneTask}
                                        onToggleMilestoneTask={toggleMilestoneTask}
                                        onDeleteMilestoneTask={deleteMilestoneTask}
                                        onLinkQuarterlyGoal={linkQuarterlyGoal}
                                      />
                                    ))}
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
                                            progress={computeProgress(goal)}
                                            milestones={milestonesFor(goal.id)}
                                            parentGoal={goals.find(g => g.id === goal.parent_goal_id)}
                                            onEdit={g => { setEditing(g); setCreateCtx(null); setShowModal(true) }}
                                            onDelete={deleteGoal}
                                            onUpdateMetric={updateMetricCurrent}
                                            onUpdatePriority={v => updateGoalField(goal.id, 'priority_level', v)}
                                            onTogglePrivate={g => updateGoalField(g.id, 'is_private', !g.is_private)}
                                            onToggleMilestone={toggleMilestone}
                                            onAddMilestoneTask={addMilestoneTask}
                                            onToggleMilestoneTask={toggleMilestoneTask}
                                            onDeleteMilestoneTask={deleteMilestoneTask}
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
          milestones={editing ? milestonesFor(editing.id) : []}
          onAddMilestone={(title, date) => addMilestone(editing.id, title, date)}
          onToggleMilestone={toggleMilestone}
          onDeleteMilestone={deleteMilestone}
          onAddMilestoneTask={addMilestoneTask}
          onToggleMilestoneTask={toggleMilestoneTask}
          onDeleteMilestoneTask={deleteMilestoneTask}
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
