import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  DndContext, closestCenter,
  KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { GripVertical } from 'lucide-react'

// Individual sortable card wrapper
export function SortableCard({ id, onClick, children }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.38 : 1,
        position: 'relative',
        zIndex: isDragging ? 10 : 'auto',
      }}
    >
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
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        {children}
      </div>
    </div>
  )
}

// Container — provides DnD context + sortable context for a view's card list
export function DraggableCardList({ cardOrder, onReorder, children }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const oldIdx = cardOrder.indexOf(active.id)
    const newIdx = cardOrder.indexOf(over.id)
    if (oldIdx !== -1 && newIdx !== -1) {
      onReorder(arrayMove(cardOrder, oldIdx, newIdx))
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={cardOrder} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}
