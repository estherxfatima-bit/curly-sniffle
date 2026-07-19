import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import TaskExpansion from './TaskExpansion'

export default function TaskDetailPanel({ task, goals, onClose, onUpdateField, onDismiss, onToggleSubtask, onAddSubtask, onEditSubtask, onRemoveSubtask, onReorderSubtasks, onPushNextWeek }) {
  if (!task) return null
  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, height: '100vh', background: 'var(--bg)', overflowY: 'auto', boxShadow: '-4px 0 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1 }}>
          <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{task.specific_task}</p>
          <button className="btn-icon btn" onClick={onClose}><X size={15} /></button>
        </div>
        <div style={{ padding: '16px 20px 32px' }}>
          <TaskExpansion
            task={task}
            goals={goals}
            onUpdateField={onUpdateField}
            onDismiss={onDismiss}
            onToggleSubtask={onToggleSubtask}
            onAddSubtask={onAddSubtask}
            onEditSubtask={onEditSubtask}
            onRemoveSubtask={onRemoveSubtask}
            onReorderSubtasks={onReorderSubtasks}
            onPushNextWeek={onPushNextWeek}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
