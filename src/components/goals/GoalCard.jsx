import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { Edit2, Trash2, RefreshCw, Check, Circle } from 'lucide-react'
import ArcRing from '../ui/ArcRing'

const STATUS_BADGE = {
  'Not started': 'badge-muted',
  'In progress': 'badge-warning',
  'On track':    'badge-career',
  'Complete':    'badge-success',
}

export default function GoalCard({ goal, color, linkedTasks, metricHistory, onEdit, onDelete, onAddMetric }) {
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
  } else {
    const total = linkedTasks.length
    const done = linkedTasks.filter(t => t.complete).length
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
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{goal.primary_goal}</p>
          <div className="flex items-center gap-2 mt-1 wrap">
            <span className={`badge ${STATUS_BADGE[status]}`} style={{ fontSize: 9 }}>{status}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
              Updated {format(new Date(lastUpdated), 'd MMM yyyy')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
          <ArcRing value={pct} max={100} size={44} strokeWidth={4} color={color} label={`${pct}%`} fontSize={9} />
          <button className="btn-icon btn btn-sm" onClick={() => onEdit(goal)}><Edit2 size={12} /></button>
          <button className="btn-icon btn btn-sm" onClick={() => onDelete(goal.id)}><Trash2 size={12} /></button>
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

      {isMetric ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="mono">{goal.metric_name || 'Metric'}: {current} / {goal.metric_target}</p>
            {!updating && (
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
          <p className="mono mb-2">Linked tasks ({linkedTasks.filter(t => t.complete).length}/{linkedTasks.length})</p>
          {linkedTasks.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No tasks linked yet. Link weekly tasks or daily to-dos via the "linked goal" dropdown.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {linkedTasks.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {t.complete ? <Check size={12} color="var(--success)" /> : <Circle size={10} color="var(--text-3)" />}
                  <span style={{ fontSize: 12, flex: 1, color: t.complete ? 'var(--text-3)' : 'var(--text-2)', textDecoration: t.complete ? 'line-through' : 'none' }}>{t.text}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase' }}>{t.area}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
