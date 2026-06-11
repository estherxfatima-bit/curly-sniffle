import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  DndContext, closestCenter,
  KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { GripVertical, Square, RectangleHorizontal, X } from 'lucide-react'

// Individual sortable card wrapper
export function SortableCard({ id, size = 'wide', onClick, onResize, onRemove, editing, children }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      className={size === 'wide' ? 'span-2' : ''}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.38 : 1,
        position: 'relative',
        zIndex: isDragging ? 10 : 'auto',
        height: '100%',
        outline: editing ? '1px dashed var(--border)' : 'none',
        outlineOffset: 4,
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {/* Edit-mode toolbar: resize + remove */}
      {editing && (
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 4, display: 'flex', gap: 4 }}>
          <button
            className="btn-icon"
            title={size === 'wide' ? 'Make square' : 'Make wide'}
            onClick={() => onResize?.(size === 'wide' ? 'square' : 'wide')}
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
          >
            {size === 'wide' ? <Square size={12} /> : <RectangleHorizontal size={12} />}
          </button>
          <button
            className="btn-icon"
            title="Remove widget"
            onClick={() => onRemove?.()}
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--danger, #c44)' }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Grip handle — touch-safe drag zone */}
      <div
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        style={{
          position: 'absolute', top: 12, right: 12,
          color: 'var(--border)',
          cursor: 'grab',
          zIndex: 3,
          padding: 4,
          borderRadius: 4,
          touchAction: 'none',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-3)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}
      >
        <GripVertical size={13} />
      </div>

      {/* Clickable card body */}
      <div
        onClick={editing ? undefined : onClick}
        style={{ cursor: !editing && onClick ? 'pointer' : 'default', height: '100%' }}
      >
        {children}
      </div>
    </div>
  )
}

// Container — provides DnD context + sortable context for a view's card grid
// cardOrder: array of { id, size }
export function DraggableCardList({ cardOrder, onReorder, children }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const ids = cardOrder.map(c => c.id)

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const oldIdx = ids.indexOf(active.id)
    const newIdx = ids.indexOf(over.id)
    if (oldIdx !== -1 && newIdx !== -1) {
      onReorder(arrayMove(cardOrder, oldIdx, newIdx))
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="dashboard-grid">
          {children}
        </div>
      </SortableContext>
    </DndContext>
  )
}
