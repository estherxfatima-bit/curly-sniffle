import { useState } from 'react'
import { format } from 'date-fns'
import { Edit2, Trash2, Lock, Unlock, Check, Circle, ChevronRight, ChevronDown, Plus, Link2 } from 'lucide-react'
import ArcRing from '../ui/ArcRing'
import PriorityDot from '../shared/PriorityDot'
import { PRIORITY_COLORS, TRACKING_TYPE_LABELS } from '../../lib/constants'

const STATUS_BADGE = {
  'Not started': 'badge-muted',
  'In progress': 'badge-warning',
  'On track':    'badge-career',
  'Complete':    'badge-success',
  'Smashed it':  'badge-success',
}

function statusFor(pct) {
  if (pct <= 0) return 'Not started'
  if (pct > 100) return 'Smashed it'
  if (pct >= 100) return 'Complete'
  if (pct >= 50) return 'On track'
  return 'In progress'
}

function fmtNum(n) {
  return Number(n ?? 0).toLocaleString()
}

// `progress` is precomputed by the page (it needs cross-goal context for
// theme sub-goal percentages) — this component is presentational.
export default function GoalCard({
  goal, color, progress, milestones = [], subGoals = [], linkableQuarterlyGoals = [], parentGoal,
  onEdit, onDelete, onUpdatePriority, onTogglePrivate, onUpdateMetric,
  onToggleMilestone, onAddMilestoneTask, onToggleMilestoneTask, onDeleteMilestoneTask,
  onLinkQuarterlyGoal,
  readOnly = false,
}) {
  const [expandedMilestone, setExpandedMilestone] = useState(null)
  const [addingTaskFor, setAddingTaskFor] = useState(null)
  const [taskText, setTaskText] = useState('')
  const [linking, setLinking] = useState(false)

  const isYearly = goal.quarter === 'Year'
  const trackingType = goal.tracking_type
  const isMetric = trackingType === 'metric'
  const isTheme = trackingType === 'theme'
  const lastUpdated = goal.updated_at || goal.created_at
  const { pct, done, total } = progress

  function submitTask(milestoneId) {
    if (!taskText.trim()) return
    onAddMilestoneTask(milestoneId, taskText)
    setTaskText('')
    setAddingTaskFor(null)
  }

  return (
    <div style={{
      background: 'var(--bg-2)',
      borderRadius: 'var(--radius)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${goal.priority_level === 'urgent' ? PRIORITY_COLORS.urgent : color}`,
      padding: 14,
    }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2">
            <PriorityDot priority={goal.priority_level} onChange={readOnly ? undefined : onUpdatePriority} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color }}>
              {goal.category}{isYearly && ` · ${TRACKING_TYPE_LABELS[trackingType] || trackingType}`}
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, lineHeight: 1.35, marginTop: 2 }}>{goal.primary_goal}</p>
          <div className="flex items-center gap-2 mt-1 wrap">
            <span className={`badge ${STATUS_BADGE[statusFor(pct)]}`} style={{ fontSize: 9 }}>{statusFor(pct).toUpperCase()}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
              {isTheme ? `${done} quarterly sub-goal${total === 1 ? '' : 's'}` : isMetric ? null : `${done} of ${total} milestones`}
              {!isMetric && ' · '}updated {format(new Date(lastUpdated), 'd MMM')}
            </span>
            {parentGoal && (
              <span style={{ fontSize: 9, color: 'var(--text-3)', fontStyle: 'italic' }}>
                Part of: {parentGoal.primary_goal}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
          {isTheme ? (
            <div style={{ textAlign: 'center', minWidth: 44 }}>
              <p style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 22, lineHeight: 1 }}>
                {done}<span style={{ fontSize: 14, color: 'var(--text-3)' }}>/{total}</span>
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.06em', color: 'var(--text-3)' }}>DONE</p>
            </div>
          ) : (
            <ArcRing value={Math.min(pct, 100)} max={100} size={64} strokeWidth={6} color={color} label={`${pct}%`} fontSize={13} />
          )}
          {!readOnly && (
            <div className="flex flex-col items-center gap-1">
              <button
                className="btn-icon btn btn-sm"
                onClick={() => onTogglePrivate(goal)}
                title={goal.is_private ? 'Private — hidden from accountability partners. Click to share.' : 'Shared with accepted accountability partners. Click to make private.'}
                style={{ color: goal.is_private ? 'var(--text-3)' : 'var(--career)' }}
              >
                {goal.is_private ? <Lock size={12} /> : <Unlock size={12} />}
              </button>
              <button className="btn-icon btn btn-sm" onClick={() => onEdit(goal)} title="Edit goal"><Edit2 size={12} /></button>
              <button className="btn-icon btn btn-sm" onClick={() => onDelete(goal.id)} title="Delete goal"><Trash2 size={12} /></button>
            </div>
          )}
        </div>
      </div>

      {isMetric && (
        <MetricBody goal={goal} progress={progress} color={color} readOnly={readOnly} onUpdateMetric={onUpdateMetric} />
      )}

      {!isMetric && !isTheme && (
        <div>
          {milestones.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
              No milestones yet — add checkpoints via the edit pencil to track this goal's progress.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {milestones.map(m => {
                const isOpen = expandedMilestone === m.id
                const tasks = m.tasks || []
                const taskDone = tasks.filter(t => t.complete).length
                const taskPct = tasks.length ? Math.round((taskDone / tasks.length) * 100) : 0
                return (
                  <div key={m.id} style={{ borderRadius: 6, background: isOpen ? 'var(--bg-3)' : 'transparent', padding: isOpen ? 8 : '4px 4px' }}>
                    <div className="flex items-center gap-2" style={{ cursor: 'pointer' }} onClick={() => setExpandedMilestone(isOpen ? null : m.id)}>
                      <button
                        onClick={e => { e.stopPropagation(); !readOnly && onToggleMilestone(m) }}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: readOnly ? 'default' : 'pointer', display: 'flex' }}
                        title={m.complete ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {m.complete ? <Check size={13} color="var(--success)" /> : (isOpen ? <ChevronDown size={13} color="var(--text-3)" /> : <ChevronRight size={13} color="var(--text-3)" />)}
                      </button>
                      <span style={{ fontSize: 13, flex: 1, color: m.complete ? 'var(--text-3)' : 'var(--text-2)', textDecoration: m.complete ? 'line-through' : 'none' }}>{m.title}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>{taskDone}/{tasks.length}</span>
                    </div>
                    {isOpen && (
                      <div style={{ marginTop: 6, paddingLeft: 21 }}>
                        {tasks.length > 0 && (
                          <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-1)', marginBottom: 8, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${taskPct}%`, background: color, transition: 'width 0.3s' }} />
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {tasks.map(t => (
                            <div key={t.id} className="flex items-center gap-2">
                              <button
                                onClick={() => !readOnly && onToggleMilestoneTask(t)}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: readOnly ? 'default' : 'pointer', display: 'flex' }}
                              >
                                {t.complete ? <Check size={11} color="var(--success)" /> : <Circle size={9} color="var(--text-3)" />}
                              </button>
                              <span style={{ fontSize: 12, flex: 1, color: t.complete ? 'var(--text-3)' : 'var(--text-2)', textDecoration: t.complete ? 'line-through' : 'none' }}>{t.text}</span>
                              {!readOnly && (
                                <button className="btn-icon btn btn-xs" onClick={() => onDeleteMilestoneTask(t.id)}><Trash2 size={10} /></button>
                              )}
                            </div>
                          ))}
                        </div>
                        {!readOnly && (
                          addingTaskFor === m.id ? (
                            <div className="flex items-center gap-2 mt-2">
                              <input
                                autoFocus
                                value={taskText}
                                onChange={e => setTaskText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') submitTask(m.id); if (e.key === 'Escape') setAddingTaskFor(null) }}
                                placeholder="Task…"
                                style={{ fontSize: 12, padding: '3px 6px', flex: 1 }}
                              />
                              <button className="btn btn-xs btn-career" style={{ color: '#fff' }} onClick={() => submitTask(m.id)}>Add</button>
                            </div>
                          ) : (
                            <button className="btn btn-xs btn-ghost mt-2" style={{ fontSize: 11 }} onClick={() => setAddingTaskFor(m.id)}>
                              <Plus size={10} /> add task
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {goal.success_metrics && (
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>
              <span className="mono" style={{ marginRight: 4 }}>Done when:</span>{goal.success_metrics}
            </p>
          )}
        </div>
      )}

      {isTheme && (
        <div>
          {subGoals.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No quarterly goals linked yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {subGoals.map(sg => (
                <div key={sg.id} className="flex items-center gap-2">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', width: 20, flexShrink: 0 }}>{sg.quarter}</span>
                  <span style={{ fontSize: 12, flex: 1, color: sg.pct >= 100 ? 'var(--text-3)' : 'var(--text-2)', textDecoration: sg.pct >= 100 ? 'line-through' : 'none' }}>{sg.primary_goal}</span>
                  <div style={{ width: 60, height: 4, borderRadius: 2, background: 'var(--bg-3)', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ height: '100%', width: `${Math.min(sg.pct, 100)}%`, background: color }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', width: 32, textAlign: 'right', flexShrink: 0 }}>{sg.pct}%</span>
                </div>
              ))}
            </div>
          )}
          {!readOnly && onLinkQuarterlyGoal && (
            linking ? (
              <div className="flex items-center gap-2 mt-2">
                <select
                  autoFocus
                  defaultValue=""
                  onChange={e => { if (e.target.value) { onLinkQuarterlyGoal(goal, e.target.value); setLinking(false) } }}
                  style={{ fontSize: 11, padding: '3px 6px', flex: 1 }}
                >
                  <option value="" disabled>Choose a quarterly goal…</option>
                  {linkableQuarterlyGoals.map(g => <option key={g.id} value={g.id}>{g.quarter} {g.year}: {g.primary_goal}</option>)}
                </select>
                <button className="btn btn-xs btn-ghost" onClick={() => setLinking(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn-xs btn-ghost mt-2" style={{ fontSize: 11 }} onClick={() => setLinking(true)}>
                <Link2 size={10} /> link a quarterly goal
              </button>
            )
          )}
          {goal.key_actions && (
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10, fontStyle: 'italic' }}>{goal.key_actions}</p>
          )}
        </div>
      )}
    </div>
  )
}

function MetricBody({ goal, progress, color, readOnly, onUpdateMetric }) {
  const current = Number(goal.metric_current ?? 0)
  const target = Number(goal.metric_target ?? 0)
  const unit = goal.metric_unit || ''
  const { pct } = progress
  const overshoot = pct > 100
  const barTargetPct = overshoot && current > 0 ? Math.min(100, Math.round((target / current) * 100)) : pct

  return (
    <div>
      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700 }}>
        {unit}{fmtNum(current)} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-3)' }}>/ {unit}{fmtNum(target)} target</span>
      </p>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden', marginTop: 8, display: 'flex' }}>
        <div style={{ height: '100%', width: `${overshoot ? barTargetPct : Math.min(pct, 100)}%`, background: color }} />
        {overshoot && <div style={{ height: '100%', width: `${100 - barTargetPct}%`, background: color, opacity: 0.4 }} />}
      </div>
      {overshoot && (
        <div className="flex items-center justify-between mt-1">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>target reached at {barTargetPct}%</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>+{unit}{fmtNum(current - target)} over</span>
        </div>
      )}
      {!readOnly && (
        <button className="btn btn-xs btn-ghost mt-2" onClick={() => onUpdateMetric(goal)}>Update current amount</button>
      )}
    </div>
  )
}
