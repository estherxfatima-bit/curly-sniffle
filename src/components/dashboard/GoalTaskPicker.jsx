import { createPortal } from 'react-dom'
import { X, Target } from 'lucide-react'
import useLockBodyScroll from '../../hooks/useLockBodyScroll'

export default function GoalTaskPicker({ goals, onSelect, onClose }) {
  useLockBodyScroll()
  const goalsWithTasks = goals.filter(g => g.tasks?.length > 0)

  // Portal to document.body so this fixed overlay isn't clipped by .app-layout's `overflow: clip`.
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: 420, maxHeight: '70vh', overflow: 'auto', padding: 18 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: '0.95rem' }}>Pull from a goal's task bucket</h3>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>
        {goalsWithTasks.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
            No tasks in any goal's bucket. Add some via Goals → edit goal.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {goalsWithTasks.map(goal => (
              <div key={goal.id}>
                <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--career)' }}>
                  <Target size={12} />
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {goal.category}: {goal.primary_goal?.slice(0, 32)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {goal.tasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => onSelect(goal, task)}
                      className="btn btn-ghost"
                      style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '8px 10px', fontSize: 13 }}
                    >
                      {task.text}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
