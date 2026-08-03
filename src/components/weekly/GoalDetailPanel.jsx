import { createPortal } from 'react-dom'
import { X, ChevronRight, ChevronDown, Check, Circle } from 'lucide-react'
import { AREA_COLORS } from '../../lib/constants'
import ArcRing from '../ui/ArcRing'

function goalColor(goal) {
  const area = goal.category === 'Wellness' ? 'Health/Wellness' : goal.category
  return AREA_COLORS[area] || AREA_COLORS.Other
}

const STATUS_LABEL = pct => {
  if (pct <= 0) return { label: 'Not started', cls: 'badge-muted' }
  if (pct >= 100) return { label: 'Complete', cls: 'badge-success' }
  if (pct >= 50) return { label: 'On track', cls: 'badge-career' }
  return { label: 'In progress', cls: 'badge-warning' }
}

export default function GoalDetailPanel({ goal, milestones, weekTasks, onClose }) {
  if (!goal) return null

  const color = goalColor(goal)
  const goalMilestones = milestones.filter(m => m.goal_id === goal.id)
  const linkedWeekTasks = weekTasks.filter(t => t.goal_id === goal.id && !t.dismissed)

  const done = goalMilestones.filter(m => m.complete).length
  const total = goalMilestones.length
  const isMetric = goal.tracking_type === 'metric'
  const pct = isMetric
    ? (goal.metric_target > 0 ? Math.round((Number(goal.metric_current || 0) / Number(goal.metric_target)) * 100) : 0)
    : total > 0 ? Math.round((done / total) * 100) : 0

  const { label: statusLabel, cls: statusCls } = STATUS_LABEL(pct)

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, height: '100vh', background: 'var(--bg)', overflowY: 'auto', boxShadow: '-4px 0 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', borderLeft: `4px solid ${color}`, display: 'flex', alignItems: 'flex-start', gap: 12, position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color, marginBottom: 4 }}>{goal.category}</p>
            <p style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35, color: 'var(--text)' }}>{goal.primary_goal}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`badge ${statusCls}`} style={{ fontSize: 9 }}>{statusLabel.toUpperCase()}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)' }}>Q{goal.quarter} {goal.year}</span>
            </div>
          </div>
          <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
            <ArcRing value={Math.min(pct, 100)} max={100} size={56} strokeWidth={5} color={color} label={`${pct}%`} fontSize={11} />
            <button className="btn-icon btn" onClick={onClose}><X size={15} /></button>
          </div>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Description */}
          {goal.description && (
            <div>
              <p className="mono mb-2" style={{ fontSize: 10 }}>About this goal</p>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, fontStyle: 'italic' }}>{goal.description}</p>
            </div>
          )}

          {/* Key actions */}
          {goal.key_actions && (
            <div>
              <p className="mono mb-2" style={{ fontSize: 10 }}>Key actions</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {goal.key_actions.split('\n').filter(l => l.trim()).map((line, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color, fontSize: 10, marginTop: 3, flexShrink: 0 }}>▸</span>
                    <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>{line.replace(/^[-•·▸*]\s*/, '')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success metrics */}
          {goal.success_metrics && (
            <div style={{ padding: '10px 14px', background: color + '10', borderRadius: 8, borderLeft: `3px solid ${color}` }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.07em', color, marginBottom: 4 }}>Done when</p>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{goal.success_metrics}</p>
            </div>
          )}

          {/* Metric tracker */}
          {isMetric && (
            <div>
              <p className="mono mb-2" style={{ fontSize: 10 }}>Progress</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                {goal.metric_unit}{Number(goal.metric_current || 0).toLocaleString()}
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-3)', marginLeft: 6 }}>/ {goal.metric_unit}{Number(goal.metric_target || 0).toLocaleString()} target</span>
              </p>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden', marginTop: 8 }}>
                <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          {/* Milestones */}
          {!isMetric && goalMilestones.length > 0 && (
            <div>
              <p className="mono mb-2" style={{ fontSize: 10 }}>Milestones — {done}/{total}</p>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-3)', overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {goalMilestones.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-2)', borderRadius: 8 }}>
                    {m.complete
                      ? <Check size={13} color="var(--success)" />
                      : <Circle size={11} color="var(--text-3)" />
                    }
                    <span style={{ fontSize: 13, flex: 1, color: m.complete ? 'var(--text-3)' : 'var(--text-2)', textDecoration: m.complete ? 'line-through' : 'none' }}>{m.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!isMetric && goalMilestones.length === 0 && (
            <div>
              <p className="mono mb-2" style={{ fontSize: 10 }}>Milestones</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No milestones set — add them on the Goals page.</p>
            </div>
          )}

          {/* This week's tasks */}
          <div>
            <p className="mono mb-2" style={{ fontSize: 10 }}>This week's tasks for this goal</p>
            {linkedWeekTasks.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>No tasks linked this week.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {linkedWeekTasks.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-2)', borderRadius: 8 }}>
                    {t.complete
                      ? <Check size={13} color="var(--success)" />
                      : <Circle size={11} color="var(--text-3)" />
                    }
                    <span style={{ fontSize: 13, color: t.complete ? 'var(--text-3)' : 'var(--text)', textDecoration: t.complete ? 'line-through' : 'none' }}>{t.specific_task}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>,
    document.body
  )
}
