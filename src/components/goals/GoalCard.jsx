import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { Edit2, Trash2, RefreshCw, Check, Circle, Lock, Unlock, Flag } from 'lucide-react'
import ArcRing from '../ui/ArcRing'
import PriorityDot from '../shared/PriorityDot'
import { PRIORITY_COLORS } from '../../lib/constants'

const STATUS_BADGE = {
  'Not started': 'badge-muted',
  'In progress': 'badge-warning',
  'On track':    'badge-career',
  'Complete':    'badge-success',
}

export default function GoalCard({
  goal, color, linkedTasks, milestones = [], metricHistory, parentGoal,
  onEdit, onDelete, onAddMetric, onUpdatePriority, onTogglePrivate,
  onToggleMilestone, onToggleLinkedTask, onAssignTaskMilestone, onReassignLinkedTask,
  readOnly = false,
}) {
  const [updating, setUpdating] = useState(false)
  const [newValue, setNewValue] = useState('')
  const isMetric = goal.tracking_type === 'metric'

  let pct = 0, current = null, status = 'Not started', lastUpdated = goal.updated_at || goal.created_at

  if (isMetric) {
    const start = Number(goal.metric_start ?? 0)
    const target = Number(goal.metric_target ?? 0)
    current = metricHistory.length ? Number(metricHistory[metricHistory.length - 1].value) : start
    const span = target - start
    pct = span !== 0 ? Math.round(Math.min(Math.max((current - start) / span, 0), 1) * 100) : 0
    if (metricHistory.length === 0) status = 'Not started'
    else if (pct >= 100) status = 'Complete'
    else if (pct >= 50) status = 'On track'
    else status = 'In progress'
    if (metricHistory.length) lastUpdated = metricHistory[metricHistory.length - 1].recorded_at
  } else if (milestones.length > 0) {
    // Milestones give a more accurate read on progress than "% of linked tasks
    // done" — a goal can have lots of small tasks and few real checkpoints.
    const total = milestones.length
    const done = milestones.filter(m => m.complete).length
    pct = Math.round((done / total) * 100)
    if (done === 0) status = 'Not started'
    else if (pct >= 100) status = 'Complete'
    else if (pct >= 50) status = 'On track'
    else status = 'In progress'
  } else {
    const total = linkedTasks.length
    const done = linkedTasks.filter(t => t.complete || t.completed_on).length
    pct = total ? Math.round((done / total) * 100) : 0
    if (total === 0) status = 'Not started'
    else if (pct >= 100) status = 'Complete'
    else if (pct >= 50) status = 'On track'
    else status = 'In progress'
  }

  async function submitUpdate() {
    const v = parseFloat(newValue)
    if (isNaN(v)) return
    await onAddMetric(goal, v)
    setNewValue('')
    setUpdating(false)
  }

  const chartData = metricHistory.map(m => ({
    date: format(new Date(m.recorded_at), 'd MMM'),
    value: Number(m.value),
  }))

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
            <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{goal.primary_goal}</p>
          </div>
          <div className="flex items-center gap-2 mt-1 wrap">
            <span className={`badge ${STATUS_BADGE[status]}`} style={{ fontSize: 9 }}>{status}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
              Updated {format(new Date(lastUpdated), 'd MMM yyyy')}
            </span>
            {parentGoal && (
              <span style={{ fontSize: 9, color: 'var(--text-3)', fontStyle: 'italic' }}>
                Part of: {parentGoal.primary_goal}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
          <ArcRing value={pct} max={100} size={64} strokeWidth={6} color={color} label={`${pct}%`} fontSize={13} />
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

      {goal.key_actions && (
        <div className="mb-2">
          <p className="mono mb-1">Key actions</p>
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{goal.key_actions}</p>
        </div>
      )}
      {goal.success_metrics && (
        <div className="mb-2">
          <p className="mono mb-1">Success metrics</p>
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{goal.success_metrics}</p>
        </div>
      )}
      {goal.tasks?.length > 0 && (
        <div className="mb-2">
          <p className="mono mb-1">Task bucket ({goal.tasks.length})</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
            {goal.tasks.length} task{goal.tasks.length === 1 ? '' : 's'} ready to pull into your weekly plan or daily to-dos.
          </p>
        </div>
      )}

      {!isMetric && milestones.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="mono">Milestones ({milestones.filter(m => m.complete).length}/{milestones.length})</p>
            {!readOnly && (
              <button className="btn btn-xs btn-ghost" onClick={() => onEdit(goal)} title="Manage milestones">
                Manage
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {milestones.map(m => (
              <div key={m.id} className="flex items-center gap-2">
                <button
                  onClick={() => !readOnly && onToggleMilestone(m)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: readOnly ? 'default' : 'pointer', display: 'flex' }}
                  title={m.complete ? 'Mark incomplete' : 'Mark complete'}
                >
                  {m.complete ? <Check size={12} color="var(--success)" /> : <Flag size={11} color="var(--text-3)" />}
                </button>
                <span style={{ fontSize: 12, flex: 1, color: m.complete ? 'var(--text-3)' : 'var(--text-2)', textDecoration: m.complete ? 'line-through' : 'none' }}>{m.title}</span>
                {m.target_date && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>{format(new Date(m.target_date), 'd MMM')}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {isMetric ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="mono">{goal.metric_name || 'Metric'}: {current} / {goal.metric_target}</p>
            {!readOnly && !updating && (
              <button className="btn btn-xs btn-ghost" onClick={() => { setUpdating(true); setNewValue(String(current ?? '')) }}>
                <RefreshCw size={11} /> Update
              </button>
            )}
          </div>
          {updating && (
            <div className="flex items-center gap-2 mb-3">
              <input
                type="number"
                autoFocus
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitUpdate(); if (e.key === 'Escape') setUpdating(false) }}
                placeholder="New value"
                style={{ fontSize: 12, padding: '4px 8px', width: 120 }}
              />
              <button className="btn btn-xs btn-career" style={{ color: '#fff' }} onClick={submitUpdate}>Save</button>
              <button className="btn btn-xs btn-ghost" onClick={() => setUpdating(false)}>Cancel</button>
            </div>
          )}
          {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-3)' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-3)' }} width={32} />
                <Tooltip
                  contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                  labelStyle={{ color: 'var(--text-3)' }}
                  itemStyle={{ color }}
                />
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>Log at least two updates to see a trend.</p>
          )}
        </div>
      ) : (
        <div>
          <p className="mono mb-2">Linked tasks ({linkedTasks.filter(t => t.complete || t.completed_on).length}/{linkedTasks.length})</p>
          {linkedTasks.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No tasks linked yet. Link weekly tasks or daily to-dos via the "linked goal" dropdown.</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
                {linkedTasks.map((t, i) => (
                  <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: (t.complete || t.completed_on) ? color : 'var(--bg-3)' }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {linkedTasks.map((t, i) => {
                const done = t.complete || !!t.completed_on
                return (
                <div key={t.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => !readOnly && onToggleLinkedTask && onToggleLinkedTask(t)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: (readOnly || !onToggleLinkedTask) ? 'default' : 'pointer', display: 'flex' }}
                    title={done ? 'Mark not done' : 'Mark done'}
                  >
                    {done ? <Check size={12} color="var(--success)" /> : <Circle size={10} color="var(--text-3)" />}
                  </button>
                  <span style={{ fontSize: 12, flex: 1, color: done ? 'var(--text-3)' : 'var(--text-2)', textDecoration: done ? 'line-through' : 'none' }}>{t.text}</span>
                  {done && t.completed_on && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>{format(new Date(t.completed_on), 'd MMM')}</span>
                  )}
                  {!readOnly && !done && onReassignLinkedTask && (
                    <button className="btn btn-xs btn-ghost" style={{ fontSize: 9, padding: '2px 6px' }} onClick={() => onReassignLinkedTask(t)} title="Reassign to a new day">
                      Reassign
                    </button>
                  )}
                  {!readOnly && onAssignTaskMilestone && milestones.length > 0 && (
                    <select
                      value={t.milestone_id || ''}
                      onChange={e => onAssignTaskMilestone(t, e.target.value)}
                      style={{ fontSize: 9, padding: '2px 4px', maxWidth: 90 }}
                      title="Link to milestone"
                    >
                      <option value="">No milestone</option>
                      {milestones.map(m => <option key={m.id} value={m.id}>{m.title.slice(0, 20)}</option>)}
                    </select>
                  )}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase' }}>{t.area}</span>
                </div>
              )})}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
