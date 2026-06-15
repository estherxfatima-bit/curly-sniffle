import { ChevronDown, ChevronRight, MessageSquare, Repeat, Star, Trash2, Lock, Unlock } from 'lucide-react'
import TaskExpansion from './TaskExpansion'
import PriorityDot from '../shared/PriorityDot'
import { PRIORITY_COLORS } from '../../lib/constants'

const DAY_SHORT_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function WeeklyTaskCard({ task, areaColor, goals, expanded, onToggleExpand, onToggle, onUpdateField, onToggleSubtask, onAddSubtask, onPushNextWeek, onTogglePriority, onDelete }) {
  const goal = goals.find(g => g.id === task.goal_id)

  return (
    <div className="card-sm" style={{
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${task.priority_level === 'urgent' ? PRIORITY_COLORS.urgent : areaColor(task.area)}`,
      borderRadius: 'var(--radius)',
      opacity: task.complete ? 0.6 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <button
          onClick={() => onToggle(task)}
          title={task.complete ? 'Mark as not done' : 'Mark as done'}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 17, lineHeight: 1, flexShrink: 0 }}
        >
          {task.complete ? '✅' : '⬜'}
        </button>

        <span style={{
          flex: 1,
          fontSize: 13,
          fontWeight: 500,
          textDecoration: task.complete ? 'line-through' : 'none',
          minWidth: 0,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {task.priority && <Star size={12} color="var(--warning)" fill="var(--warning)" style={{ marginRight: 5, verticalAlign: -1 }} />}
          {task.specific_task}
        </span>

        {task.notes && <MessageSquare size={12} color="var(--creative)" style={{ flexShrink: 0, marginTop: 2 }} />}

        <PriorityDot priority={task.priority_level} onChange={v => onUpdateField('priority_level', v)} />

        <button className="btn-icon" style={{ padding: 2, flexShrink: 0, color: 'var(--text-3)' }} onClick={() => onToggleExpand(task.id)} title="Show notes, comments and details">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 wrap" style={{ marginTop: 8, paddingLeft: 25 }}>
        <span className="badge" style={{ background: `${areaColor(task.area)}22`, color: areaColor(task.area), fontSize: 9 }}>{task.area}</span>
        <span className="mono" style={{ fontSize: 9 }}>{task.frequency}</span>
        {task.recurring && <Repeat size={11} color="var(--career)" title="Recurring every week" />}
        {task.carried_forward && <span className="badge badge-warning" style={{ fontSize: 9 }}>carried</span>}
        {task.day_of_week != null && <span className="badge" style={{ fontSize: 9, background: 'var(--career-tint)', color: 'var(--career)' }}>{DAY_SHORT_LABELS[task.day_of_week]}</span>}
        {task.complete ? <span className="badge badge-success" style={{ fontSize: 9 }}>Done</span> : <span className="badge badge-muted" style={{ fontSize: 9 }}>Open</span>}
        {goal && <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{goal.primary_goal?.slice(0, 20)}</span>}
        <div style={{ flex: 1 }} />
        <button
          className="btn-icon btn"
          onClick={() => onUpdateField('is_private', !task.is_private)}
          title={task.is_private ? 'Private — hidden from accountability partners. Click to share.' : 'Shared with accepted accountability partners. Click to make private.'}
          style={{ color: task.is_private ? 'var(--text-3)' : 'var(--career)' }}
        >
          {task.is_private ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
        <button
          className="btn-icon btn"
          onClick={() => onTogglePriority(task)}
          title={task.priority ? 'Remove from this week\'s priorities' : 'Mark as a priority for this week'}
          style={{ color: task.priority ? 'var(--warning)' : undefined }}
        >
          <Star size={13} fill={task.priority ? 'var(--warning)' : 'none'} />
        </button>
        <button className="btn-icon btn" onClick={() => onDelete(task.id)}><Trash2 size={13} /></button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: 10, paddingLeft: 25 }}>
          <TaskExpansion
            task={task}
            goals={goals}
            onUpdateField={onUpdateField}
            onToggleSubtask={onToggleSubtask}
            onAddSubtask={onAddSubtask}
            onPushNextWeek={onPushNextWeek}
          />
        </div>
      )}
    </div>
  )
}
