import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable, useDraggable } from '@dnd-kit/core'
import { useState } from 'react'
import { AREA_COLORS } from '../../lib/constants'
import PriorityDot from '../shared/PriorityDot'

function areaColor(area) {
  return AREA_COLORS[area] || AREA_COLORS.Other
}

const COLUMNS = [
  { id: 'open', label: 'Open', color: '#ef4444' },
  { id: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'done', label: 'Done', color: '#10b981' },
]

function KanbanCard({ task, onOpenDetail, isDragging }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id })
  const color = areaColor(task.area)
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onOpenDetail(task)}
      style={{
        background: 'var(--bg)',
        borderRadius: 'var(--radius)',
        borderLeft: `3px solid ${color}`,
        padding: '10px 12px',
        cursor: 'grab',
        opacity: isDragging ? 0.4 : task.complete ? 0.6 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.4 }}>{task.specific_task}</p>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: color + '22', color, borderRadius: 4, padding: '1px 5px' }}>{task.area}</span>
        {task.priority_level && <PriorityDot level={task.priority_level} size={10} />}
      </div>
    </div>
  )
}

function KanbanColumn({ col, tasks, onOpenDetail, activeId }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
        background: col.color + '18', borderRadius: 'var(--radius) var(--radius) 0 0',
        borderBottom: `2px solid ${col.color}`,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: col.color }}>{col.label}</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: col.color + '25', color: col.color, borderRadius: 10, padding: '1px 7px' }}>{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          minHeight: 200,
          padding: '10px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: isOver ? col.color + '08' : 'var(--bg-2)',
          borderRadius: '0 0 var(--radius) var(--radius)',
          transition: 'background 0.15s',
        }}
      >
        {tasks.map(task => (
          <KanbanCard key={task.id} task={task} onOpenDetail={onOpenDetail} isDragging={activeId === task.id} />
        ))}
        {tasks.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', textAlign: 'center', paddingTop: 20 }}>Drop tasks here</p>
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
    if (targetCol === 'open') onUpdateField(task.id, 'complete', false)
    if (targetCol === 'in_progress') onUpdateField(task.id, 'complete', false)
  }

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null

  return (
    <DndContext sensors={sensors} onDragStart={({ active }) => setActiveId(active.id)} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {COLUMNS.map(col => (
          <KanbanColumn key={col.id} col={col} tasks={colTasks(col.id)} onOpenDetail={onOpenDetail} activeId={activeId} />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <div style={{
            background: 'var(--bg)',
            borderRadius: 'var(--radius)',
            borderLeft: `3px solid ${areaColor(activeTask.area)}`,
            padding: '10px 12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            fontSize: 13,
            fontWeight: 500,
          }}>
            {activeTask.specific_task}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
