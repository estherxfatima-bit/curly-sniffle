import { Check, ChevronDown, ChevronRight, MessageSquare, Trash2 } from 'lucide-react'
import TaskExpansion from './TaskExpansion'

const DAY_SHORT_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function WeeklyTaskCard({ task, areaColor, goals, expanded, onToggleExpand, onToggle, onUpdateField, onToggleSubtask, onAddSubtask, onPushNextWeek, onDelete }) {
  const goal = goals.find(g => g.id === task.goal_id)

  return (
    <div className="card-sm" style={{
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${areaColor(task.area)}`,
      borderRadius: 'var(--radius)',
      opacity: task.complete ? 0.6 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <div className={`toggle-dot ${task.complete ? 'done' : ''}`} onClick={() => onToggle(task)}
          style={{ flexShrink: 0, cursor: 'pointer', marginTop: 2 }}>
          {task.complete && <Check size={11} color="white" strokeWidth={3} />}
        </div>

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
          {task.specific_task}
        </span>

        {task.notes && <MessageSquare size={12} color="var(--creative)" style={{ flexShrink: 0, marginTop: 2 }} />}

        <button className="btn-icon" style={{ padding: 2, flexShrink: 0, color: 'var(--text-3)' }} onClick={() => onToggleExpand(task.id)} title="Show details">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 wrap" style={{ marginTop: 8, paddingLeft: 25 }}>
        <span className="badge" style={{ background: `${areaColor(task.area)}22`, color: areaColor(task.area), fontSize: 9 }}>{task.area}</span>
        <span className="mono" style={{ fontSize: 9 }}>{task.frequency}</span>
        {task.carried_forward && <span className="badge badge-warning" style={{ fontSize: 9 }}>carried</span>}
        {task.day_of_week != null && <span className="badge" style={{ fontSize: 9, background: 'var(--career-tint)', color: 'var(--career)' }}>{DAY_SHORT_LABELS[task.day_of_week]}</span>}
        {task.complete ? <span className="badge badge-success" style={{ fontSize: 9 }}>Done</span> : <span className="badge badge-muted" style={{ fontSize: 9 }}>Open</span>}
        {goal && <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{goal.primary_goal?.slice(0, 20)}</span>}
        <div style={{ flex: 1 }} />
        {!task.complete && (
          <button className="btn-icon btn" title="Push to next week" onClick={() => onPushNextWeek(task)}><ChevronRight size={13} /></button>
        )}
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
          />
        </div>
      )}
    </div>
  )
}
