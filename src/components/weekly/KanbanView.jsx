import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable, useDraggable } from '@dnd-kit/core'
import { useState } from 'react'
import { AREA_COLORS, PRIORITY_COLORS } from '../../lib/constants'

function areaColor(area) {
  return AREA_COLORS[area] || AREA_COLORS.Other
}

const COLUMNS = [
  { id: 'open', label: 'Open', color: '#ef4444' },
  { id: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'done', label: 'Done', color: '#10b981' },
]

const PRIORITY_LABEL = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' }

function KanbanCard({ task, onOpenDetail, isDragging }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id })
  const color = areaColor(task.area)
  const pColor = task.priority_level ? (PRIORITY_COLORS[task.priority_level] || null) : null

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpenDetail(task)}
      style={{
        background: 'var(--bg)',
        borderRadius: 10,
        padding: '12px 14px',
        cursor: 'grab',
        opacity: isDragging ? 0.35 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        userSelect: 'none',
        touchAction: 'none',
        border: '1px solid var(--border)',
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>
        {task.specific_task}
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, background: color + '20', color, borderRadius: 20, padding: '2px 9px' }}>{task.area}</span>
        {pColor && task.priority_level && (
          <span style={{ fontSize: 11, fontWeight: 600, color: pColor, background: pColor + '18', borderRadius: 20, padding: '2px 9px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: pColor, display: 'inline-block' }} />
            {PRIORITY_LABEL[task.priority_level]}
          </span>
        )}
      </div>
    </div>
  )
}

function KanbanColumn({ col, tasks, onOpenDetail, activeId }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px 12px',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: col.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{col.label}</span>
        <span style={{
          fontSize: 11, fontFamily: 'var(--font-mono)',
          background: 'var(--bg-3)',
          color: 'var(--text-3)',
          borderRadius: '50%',
          width: 22, height: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 600,
        }}>{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          minHeight: 240,
          padding: '6px 8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: isOver ? col.color + '0a' : 'var(--bg-2)',
          borderRadius: 12,
          border: `1px solid ${isOver ? col.color + '40' : 'var(--border)'}`,
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {tasks.map(task => (
          <KanbanCard key={task.id} task={task} onOpenDetail={onOpenDetail} isDragging={activeId === task.id} />
        ))}
        {tasks.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', textAlign: 'center', paddingTop: 24 }}>No tasks</p>
        )}
      </div>
    </div>
  )
}

export default function KanbanView({ tasks, onOpenDetail, onUpdateField }) {
  const [activeId, setActiveId] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function colTasks(colId) {
    return tasks.filter(t => {
      const status = t.wk_status || (t.complete ? 'done' : 'open')
      return status === colId
    })
  }

  function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return
    const targetCol = over.id
    const task = tasks.find(t => t.id === active.id)
    if (!task) return
    const currentStatus = task.wk_status || (task.complete ? 'done' : 'open')
    if (currentStatus === targetCol) return

    onUpdateField(task.id, 'wk_status', targetCol)
    if (targetCol === 'done') onUpdateField(task.id, 'complete', true)
    if (targetCol !== 'done') onUpdateField(task.id, 'complete', false)
  }

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null

  return (
    <DndContext sensors={sensors} onDragStart={({ active }) => setActiveId(active.id)} onDragEnd={handleDragEnd}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, alignItems: 'flex-start' }}>
        {COLUMNS.map(col => (
          <KanbanColumn key={col.id} col={col} tasks={colTasks(col.id)} onOpenDetail={onOpenDetail} activeId={activeId} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <div style={{
            background: 'var(--bg)',
            borderRadius: 10,
            padding: '12px 14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            fontSize: 14,
            fontWeight: 600,
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}>
            {activeTask.specific_task}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
